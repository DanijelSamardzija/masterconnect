import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const BOOST_COST       = 30
const BOOST_SCORE      = 15
const BOOST_DAYS       = 7

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

// GET /api/ai-match/boost — returns current boost status for the authenticated user
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = serviceClient()

  const { data: activeBoost } = await supabase
    .from('matchmaking_boosts')
    .select('id, boost_score, valid_until, created_at')
    .eq('profile_id', user.id)
    .gt('valid_until', new Date().toISOString())
    .order('valid_until', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: balance } = await supabase
    .from('credits_balance')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    active_boost: activeBoost ?? null,
    balance:      balance?.balance ?? 0,
    boost_cost:   BOOST_COST,
  })
}

// POST /api/ai-match/boost — buys a 7-day boost (30 credits)
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = serviceClient()

  // Check if already has active boost
  const { data: existing } = await supabase
    .from('matchmaking_boosts')
    .select('id, valid_until')
    .eq('profile_id', user.id)
    .gt('valid_until', new Date().toISOString())
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'boost_already_active', valid_until: existing.valid_until },
      { status: 409 },
    )
  }

  // Atomic deduction — raises 'insufficient_credits' if balance < 30
  const { error: deductErr } = await supabase.rpc('deduct_credits_atomic', {
    p_user_id:     user.id,
    p_amount:      BOOST_COST,
    p_type:        'spend',
    p_description: 'ai_match_boost',
  })

  if (deductErr) {
    if (deductErr.message === 'insufficient_credits') {
      return NextResponse.json(
        { error: 'insufficient_credits', required: BOOST_COST },
        { status: 402 },
      )
    }
    return NextResponse.json({ error: 'credit_deduction_failed' }, { status: 500 })
  }

  // Create boost
  const validUntil = new Date(Date.now() + BOOST_DAYS * 86_400_000).toISOString()
  const { data: boost, error: boostErr } = await supabase
    .from('matchmaking_boosts')
    .insert({
      profile_id:    user.id,
      credits_spent: BOOST_COST,
      boost_score:   BOOST_SCORE,
      valid_until:   validUntil,
    })
    .select()
    .single()

  if (boostErr) {
    return NextResponse.json({ error: 'boost_creation_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, boost, credits_spent: BOOST_COST })
}
