import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const BOOST_COST = 30

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
// All three DB operations (check / deduct / insert) are executed atomically
// inside create_ai_match_boost, which holds a pg_advisory_xact_lock for the
// duration of the transaction, preventing concurrent double-charge.
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = serviceClient()

  const { data: rpcData, error } = await supabase.rpc('create_ai_match_boost', {
    p_profile_id: user.id,
  })

  if (error) {
    console.error('[ai-match/boost] create_ai_match_boost error:', error.message)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  const result = rpcData as {
    ok: boolean
    error?: string
    valid_until?: string
    boost?: unknown
    credits_spent?: number
  }

  if (!result.ok) {
    if (result.error === 'boost_already_active') {
      return NextResponse.json(
        { error: 'boost_already_active', valid_until: result.valid_until },
        { status: 409 },
      )
    }
    if (result.error === 'insufficient_credits') {
      return NextResponse.json(
        { error: 'insufficient_credits', required: BOOST_COST },
        { status: 402 },
      )
    }
    return NextResponse.json({ error: 'boost_creation_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, boost: result.boost, credits_spent: result.credits_spent })
}
