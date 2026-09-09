import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@supabase/supabase-js'
import { runReversePipeline }       from '@/lib/matching/reverse-pipeline'

export const runtime     = 'nodejs'
export const maxDuration = 60

const MAX_FRESH_REVERSE_PER_DAY = 10
const REVERSE_CACHE_TTL_HOURS   = 1

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  // Kill switch — no deploy needed to disable
  if (process.env.AI_MATCH_DISABLED === 'true') {
    return NextResponse.json({ error: 'matching_disabled' }, { status: 503 })
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? ''
    const token      = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )

    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const requester_lang: string = body.lang ?? 'sr'

    const svc = serviceClient()

    // ── Server cache check (1h TTL) ───────────────────────────────────────
    const { data: cached } = await svc
      .from('matchmaking_reverse_cache')
      .select('ranked_posts, candidate_count, expires_at')
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (cached) {
      await svc.from('matchmaking_runs_log').insert({
        user_id:       user.id,
        cache_hit:     true,
        pipeline_type: 'reverse',
      })
      return NextResponse.json({
        ranked_posts:    cached.ranked_posts,
        candidate_count: cached.candidate_count,
        expires_at:      cached.expires_at,
        cached:          true,
        created_at:      new Date().toISOString(),
      })
    }

    // ── Rate limit: max 10 fresh reverse runs per 24h ─────────────────────
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString()

    const { count: freshToday } = await svc
      .from('matchmaking_runs_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('pipeline_type', 'reverse')
      .eq('cache_hit', false)
      .gte('created_at', dayAgo)

    if ((freshToday ?? 0) >= MAX_FRESH_REVERSE_PER_DAY) {
      return NextResponse.json(
        { error: 'rate_limit', message: 'daily_reverse_limit_reached', retry_after: '24h' },
        { status: 429 },
      )
    }

    // ── Exclude blocked users (same logic as forward pipeline) ───────────
    const { data: blocks } = await svc
      .from('blocks')
      .select('blocker_user_id, blocked_user_id')
      .or(`blocker_user_id.eq.${user.id},blocked_user_id.eq.${user.id}`)

    const excludeIds: string[] = (blocks ?? []).flatMap((b) =>
      b.blocker_user_id === user.id ? [b.blocked_user_id] : [b.blocker_user_id],
    )

    // ── Run reverse pipeline ──────────────────────────────────────────────
    const result = await runReversePipeline(svc, {
      profile_id:    user.id,
      requester_lang,
      exclude_ids:   excludeIds,
    })

    // ── Upsert server cache ───────────────────────────────────────────────
    const expiresAt = new Date(Date.now() + REVERSE_CACHE_TTL_HOURS * 3_600_000).toISOString()

    await svc.from('matchmaking_reverse_cache').upsert(
      {
        user_id:         user.id,
        ranked_posts:    result.ranked_posts,
        candidate_count: result.candidate_count,
        input_tokens:    result.totalInputTokens,
        output_tokens:   result.totalOutputTokens,
        cost_usd:        result.costUsd,
        expires_at:      expiresAt,
      },
      { onConflict: 'user_id' },
    )

    // ── Log fresh run (rate limiting + cost analytics) ────────────────────
    await svc.from('matchmaking_runs_log').insert({
      user_id:       user.id,
      cache_hit:     false,
      pipeline_type: 'reverse',
      input_tokens:  result.totalInputTokens,
      output_tokens: result.totalOutputTokens,
      cost_usd:      result.costUsd,
      duration_ms:   result.durationMs,
    })

    return NextResponse.json({
      ranked_posts:    result.ranked_posts,
      candidate_count: result.candidate_count,
      expires_at:      expiresAt,
      cached:          false,
      created_at:      new Date().toISOString(),
      costUsd:         result.costUsd,
      durationMs:      result.durationMs,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[ai-match/reverse]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
