import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { runMatchingPipeline } from '@/lib/matching/pipeline'

export const runtime = 'nodejs'

const CACHE_TTL_HOURS             = 24
const MAX_RUNS_PER_USER_DAY       = 20
const MAX_RUNS_PER_POST_DAY       = 5
const REFRESH_COST_NON_PRO        = 10  // credits for non-PRO force refresh
const PRO_FREE_MONTHLY_REFRESHES  = 60  // above this PRO also pays 10 credits

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
      const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
      const { count: cachedUserRuns } = await supabase
        .from('matchmaking_runs_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('pipeline_type', 'forward')
        .eq('cache_hit', false)
        .gte('created_at', dayAgo)

      await supabase.from('matchmaking_runs_log').insert({
        post_id,
        user_id:       user.id,
        cache_hit:     true,
        pipeline_type: 'forward',
        post_type:     post.post_type,
        category:      post.category,
      })
      return NextResponse.json({
        ok: true,
        cached: true,
        is_unlocked: isUnlocked,
        runs_left: Math.max(0, MAX_RUNS_PER_USER_DAY - (cachedUserRuns ?? 0)),
        data: cached,
      })
    }
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()

  const { count: userRuns } = await supabase
    .from('matchmaking_runs_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('pipeline_type', 'forward')
    .eq('cache_hit', false)
    .gte('created_at', dayAgo)

  if ((userRuns ?? 0) >= MAX_RUNS_PER_USER_DAY) {
    return NextResponse.json({ error: 'rate_limit_user', retry_after: '24h' }, { status: 429 })
  }

  const { count: postRuns } = await supabase
    .from('matchmaking_runs_log')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', post_id)
    .eq('pipeline_type', 'forward')
    .eq('cache_hit', false)
    .gte('created_at', dayAgo)

  if ((postRuns ?? 0) >= MAX_RUNS_PER_POST_DAY) {
    return NextResponse.json({ error: 'rate_limit_post', retry_after: '24h' }, { status: 429 })
  }

  // ── Determine force-refresh charge (deduction runs after pipeline succeeds) ─
  // Keeping the deduction after the pipeline ensures a pipeline failure never
  // results in the user being charged.  The actual atomic deduction (with the
  // overdraft guard) happens after runMatchingPipeline returns successfully.
  let refreshChargeDescription: string | null = null

  if (force_refresh) {
    if (isPro) {
      // PRO: 60 free refreshes/month; above that costs 10 credits
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const { count: monthlyRefreshes } = await supabase
        .from('matchmaking_runs_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('pipeline_type', 'forward')
        .eq('cache_hit', false)
        .gte('created_at', monthStart.toISOString())

      if ((monthlyRefreshes ?? 0) >= PRO_FREE_MONTHLY_REFRESHES) {
        refreshChargeDescription = 'ai_match_refresh_pro_over_quota'
      }
      // else: within PRO free monthly quota — no charge
    } else {
      refreshChargeDescription = 'ai_match_refresh'
    }

    // Pre-check balance to avoid running the pipeline for users who clearly
    // cannot pay.  The real overdraft guard is in deduct_credits_atomic below.
    if (refreshChargeDescription !== null) {
      const { data: balRow } = await supabase
        .from('credits_balance')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle()

      if ((balRow?.balance ?? 0) < REFRESH_COST_NON_PRO) {
        return NextResponse.json(
          { error: 'insufficient_credits', required: REFRESH_COST_NON_PRO },
          { status: 402 },
        )
      }
    }
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
    pipeline_type: 'forward',
    input_tokens:  result.totalInputTokens,
    output_tokens: result.totalOutputTokens,
    cost_usd:      result.costUsd,
    duration_ms:   result.durationMs,
    post_type:     post.post_type,
    category:      post.category,
  })

  // ── Post-pipeline credit deduction ────────────────────────────────────────
  // Runs only after the pipeline has succeeded and results are cached.  A
  // pipeline failure above returns before reaching this point, leaving the
  // user's balance untouched.
  //
  // If deduction fails here (balance changed between pre-check and now), the
  // result is already cached and logged.  Log the billing anomaly for manual
  // review and return the result — do not attempt a rollback.
  if (refreshChargeDescription !== null) {
    const { error: deductError } = await supabase.rpc('deduct_credits_atomic', {
      p_user_id:      user.id,
      p_amount:       REFRESH_COST_NON_PRO,
      p_type:         'spend',
      p_description:  refreshChargeDescription,
      p_reference_id: post_id,
    })

    if (deductError) {
      console.error('[ai-match] post-pipeline deduction failed — billing anomaly', {
        user_id:     user.id,
        post_id,
        description: refreshChargeDescription,
        error:       deductError.message,
      })
      return NextResponse.json({
        ok:            true,
        cached:        false,
        is_unlocked:   isUnlocked,
        runs_left:     Math.max(0, MAX_RUNS_PER_USER_DAY - (userRuns ?? 0) - 1),
        billing_error: 'deduction_failed',
        data: {
          extraction:      result.extraction,
          ranked_profiles: result.ranked_profiles,
          candidate_count: result.candidate_count,
          expires_at:      expiresAt,
        },
      })
    }
  }

  return NextResponse.json({
    ok:          true,
    cached:      false,
    is_unlocked: isUnlocked,
    runs_left:   Math.max(0, MAX_RUNS_PER_USER_DAY - (userRuns ?? 0) - 1),
    data: {
      extraction:      result.extraction,
      ranked_profiles: result.ranked_profiles,
      candidate_count: result.candidate_count,
      expires_at:      expiresAt,
    },
  })
}
