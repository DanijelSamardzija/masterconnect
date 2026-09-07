import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@supabase/supabase-js'
import { runReversePipeline }       from '@/lib/matching/reverse-pipeline'

export const runtime    = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? ''
    const token      = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const requester_lang: string = body.lang ?? 'sr'

    // ── Run reverse pipeline ──────────────────────────────────────────────
    const result = await runReversePipeline(supabase, {
      profile_id:     user.id,
      requester_lang,
    })

    return NextResponse.json({
      ranked_posts:    result.ranked_posts,
      candidate_count: result.candidate_count,
      expires_at:      new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1h cache hint
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
