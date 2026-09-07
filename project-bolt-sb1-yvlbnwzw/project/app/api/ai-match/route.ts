import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { runMatchingPipeline } from '@/lib/matching/pipeline'

export const runtime = 'nodejs'

const CACHE_TTL_HOURS        = 24
const MAX_RUNS_PER_USER_DAY  = 20
const MAX_RUNS_PER_POST_DAY  = 5
const REFRESH_COST_NON_PRO   = 10  // credits deducted for non-PRO force refresh

const ELIGIBLE_POST_TYPES = ['hiring_post', 'service_request']

const bodySchema = z.object({
  post_id:       z.string().uuid(),
  force_refresh: z.boolean().default(false),
})

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getAuthUser(request: NextRequest) {
  const header = request.headers.get('Authorization') ?? ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user }, error } = await client.auth.getUser()
  return error || !user ? null : user
}

export async function POST(request: NextRequest) {
  // Kill switch — no deploy needed to disable
  if (process.env.AI_MATCH_DISABLED === 'true') {
    return NextResponse.json({ error: 'matching_disabled' }, { status: 503 })
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // ── Validate body ─────────────────────────────────────────────────────────
  const raw    = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { post_id, force_refresh } = parsed.data

  const supabase = serviceClient()

  // ── Verify post ownership and eligibility ─────────────────────────────────
  const { data: post } = await supabase
    .from('posts')
    .select('id, user_id, post_type, text, job_title, profession, category, city, country')
    .eq('id', post_id)
    .maybeSingle()

  if (!post) return NextResponse.json({ error: 'post_not_found' }, { status: 404 })
  if (post.user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!ELIGIBLE_POST_TYPES.includes(post.post_type)) {
    return NextResponse.json({ error: 'post_type_not_eligible' }, { status: 400 })
  }

  // ── PRO check (needed for refresh credit cost) ────────────────────────────
  const { data: requesterProfile } = await supabase
    .from('profiles')
    .select('preferred_language, is_premium')
    .eq('id', user.id)
    .maybeSingle()

  const isPro = (requesterProfile as any)?.is_premium === true
  const requesterLang = (requesterProfile?.preferred_language as string | null) ?? 'sr'

  // ── Check unlock status ───────────────────────────────────────────────────
  const { data: unlockRow } = await supabase
    .from('matchmaking_unlock_log')
    .select('id')
    .eq('user_id', user.id)
    .eq('post_id', post_id)
    .maybeSingle()

  const isUnlocked = !!unlockRow

  // ── Cache check ───────────────────────────────────────────────────────────
  if (!force_refresh) {
    const { data: cached } = await supabase
      .from('matchmaking_results')
      .select('extraction, ranked_profiles, candidate_count, expires_at, created_at')
      .eq('post_id', post_id)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (cached) {
      await supabase.from('matchmaking_runs_log').insert({
        post_id,
        user_id:   user.id,
        cache_hit: true,
        post_type: post.post_type,
        category:  post.category,
      })
      return NextResponse.json({ ok: true, cached: true, is_unlocked: isUnlocked, data: cached })
    }
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()

  const { count: userRuns } = await supabase
    .from('matchmaking_runs_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('cache_hit', false)
    .gte('created_at', dayAgo)

  if ((userRuns ?? 0) >= MAX_RUNS_PER_USER_DAY) {
    return NextResponse.json({ error: 'rate_limit_user', retry_after: '24h' }, { status: 429 })
  }

  const { count: postRuns } = await supabase
    .from('matchmaking_runs_log')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', post_id)
    .eq('cache_hit', false)
    .gte('created_at', dayAgo)

  if ((postRuns ?? 0) >= MAX_RUNS_PER_POST_DAY) {
    return NextResponse.json({ error: 'rate_limit_post', retry_after: '24h' }, { status: 429 })
  }

  // ── Non-PRO force refresh: deduct 10 credits ──────────────────────────────
  if (force_refresh && !isPro) {
    const { data: balance } = await supabase
      .from('credits_balance')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!balance || balance.balance < REFRESH_COST_NON_PRO) {
      return NextResponse.json({ error: 'insufficient_credits', required: REFRESH_COST_NON_PRO }, { status: 402 })
    }

    const newBalance = balance.balance - REFRESH_COST_NON_PRO
    await supabase
      .from('credits_balance')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)

    await supabase.from('credit_transactions').insert({
      user_id:     user.id,
      amount:      -REFRESH_COST_NON_PRO,
      type:        'spend',
      description: 'ai_match_refresh',
      reference_id: post_id,
    })
  }

  // ── Exclude blocked users ─────────────────────────────────────────────────
  const { data: blocks } = await supabase
    .from('blocks')
    .select('blocker_user_id, blocked_user_id')
    .or(`blocker_user_id.eq.${user.id},blocked_user_id.eq.${user.id}`)

  const excludeIds: string[] = (blocks ?? []).flatMap((b) =>
    b.blocker_user_id === user.id ? [b.blocked_user_id] : [b.blocker_user_id],
  )

  // ── Run matching pipeline ─────────────────────────────────────────────────
  let result
  try {
    result = await runMatchingPipeline(supabase, {
      post_id,
      post_text:     post.text     ?? '',
      post_category: post.category ?? null,
      post_city:     post.city     ?? null,
      post_country:  post.country  ?? null,
      post_type:     post.post_type,
      exclude_ids:   excludeIds,
      requester_lang: requesterLang,
      // forward extra fields for combined text building
      ...(post.job_title   ? { job_title:   post.job_title }   : {}),
      ...(post.profession  ? { profession:  post.profession }   : {}),
    } as any)
  } catch (err: any) {
    console.error('[ai-match] pipeline error', err?.message)
    return NextResponse.json({ error: 'pipeline_error', message: err?.message ?? 'unknown' }, { status: 500 })
  }

  // ── Store in cache (upsert on post_id conflict) ───────────────────────────
  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 3_600_000).toISOString()

  await supabase.from('matchmaking_results').upsert(
    {
      post_id,
      user_id:         user.id,
      extraction:      result.extraction,
      ranked_profiles: result.ranked_profiles,
      candidate_count: result.candidate_count,
      expires_at:      expiresAt,
    },
    { onConflict: 'post_id' },
  )

  // ── Log run (analytics + rate limiting) ───────────────────────────────────
  await supabase.from('matchmaking_runs_log').insert({
    post_id,
    user_id:       user.id,
    cache_hit:     false,
    input_tokens:  result.totalInputTokens,
    output_tokens: result.totalOutputTokens,
    cost_usd:      result.costUsd,
    duration_ms:   result.durationMs,
    post_type:     post.post_type,
    category:      post.category,
  })

  return NextResponse.json({
    ok:          true,
    cached:      false,
    is_unlocked: isUnlocked,
    data: {
      extraction:      result.extraction,
      ranked_profiles: result.ranked_profiles,
      candidate_count: result.candidate_count,
      expires_at:      expiresAt,
    },
  })
}
