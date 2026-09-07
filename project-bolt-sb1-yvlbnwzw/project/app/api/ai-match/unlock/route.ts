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
// Deducts 50 credits to reveal all 5 candidates for a post (non-PRO alternative)
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

  // Already unlocked? Return success without charging
  const { data: existing } = await supabase
    .from('matchmaking_unlock_log')
    .select('id')
    .eq('user_id', user.id)
    .eq('post_id', post_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, already_unlocked: true })
  }

  // Check credits
  const { data: balance } = await supabase
    .from('credits_balance')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!balance || balance.balance < UNLOCK_COST) {
    return NextResponse.json(
      { error: 'insufficient_credits', required: UNLOCK_COST, current: balance?.balance ?? 0 },
      { status: 402 },
    )
  }

  // Deduct credits
  const newBalance = balance.balance - UNLOCK_COST
  const { error: updateErr } = await supabase
    .from('credits_balance')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  if (updateErr) {
    return NextResponse.json({ error: 'credit_deduction_failed' }, { status: 500 })
  }

  await supabase.from('credit_transactions').insert({
    user_id:      user.id,
    amount:       -UNLOCK_COST,
    type:         'spend',
    description:  'ai_match_unlock',
    reference_id: post_id,
  })

  // Record unlock
  await supabase.from('matchmaking_unlock_log').insert({
    user_id:       user.id,
    post_id,
    credits_spent: UNLOCK_COST,
  })

  return NextResponse.json({ ok: true, already_unlocked: false, credits_spent: UNLOCK_COST })
}
