import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

export const runtime = 'nodejs'

const UNLOCK_COST = 50

const bodySchema = z.object({
  post_id: z.string().uuid(),
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

// POST /api/ai-match/unlock
// Deducts 50 credits to reveal all candidates for a post (non-PRO alternative).
// All three DB operations (check / deduct / log) run inside purchase_ai_match_unlock,
// which holds a pg_advisory_xact_lock for the transaction duration, preventing
// concurrent double-charge — N3 fix (same pattern as H2 for boost).
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const raw    = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  const { post_id } = parsed.data

  const supabase = serviceClient()

  // Verify post ownership
  const { data: post } = await supabase
    .from('posts')
    .select('id, user_id')
    .eq('id', post_id)
    .maybeSingle()

  if (!post) return NextResponse.json({ error: 'post_not_found' }, { status: 404 })
  if (post.user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { data: rpcData, error } = await supabase.rpc('purchase_ai_match_unlock', {
    p_user_id: user.id,
    p_post_id: post_id,
  })

  if (error) {
    console.error('[ai-match/unlock] purchase_ai_match_unlock error:', error.message)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  const result = rpcData as {
    ok: boolean
    already_unlocked?: boolean
    error?: string
    balance?: number
    required?: number
    credits_spent?: number
  }

  if (!result.ok) {
    if (result.error === 'insufficient_credits') {
      return NextResponse.json(
        { error: 'insufficient_credits', required: UNLOCK_COST },
        { status: 402 },
      )
    }
    return NextResponse.json({ error: 'unlock_failed' }, { status: 500 })
  }

  return NextResponse.json({
    ok:              true,
    already_unlocked: result.already_unlocked ?? false,
    credits_spent:   result.already_unlocked ? 0 : UNLOCK_COST,
  })
}
