import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Only onboarding types triggered from client UI are allowed here.
// 'registration' and 'referral' are exclusively handled by DB triggers.
const ALLOWED_TYPES = ['first_post', 'first_service', 'first_job', 'profile_completed'] as const
type AllowedType = typeof ALLOWED_TYPES[number]

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getAuthUser(request: NextRequest) {
  const header = request.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user }, error } = await client.auth.getUser()
  return error || !user ? null : user
}

// POST /api/rewards/claim
// Awards an onboarding credit reward to the authenticated caller.
// p_user_id is taken from the validated session — never from the request body.
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const raw = await request.json().catch(() => null)
  const reward_type = raw?.reward_type as string | undefined

  if (!reward_type || !(ALLOWED_TYPES as readonly string[]).includes(reward_type)) {
    return NextResponse.json({ error: 'invalid_reward_type' }, { status: 400 })
  }

  const supabase = serviceClient()
  const { data, error } = await supabase.rpc('earn_reward', {
    p_user_id: user.id,
    p_reward_type: reward_type as AllowedType,
  })

  if (error) {
    console.error('[rewards/claim] earn_reward error:', error.message)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  return NextResponse.json({ earned: data ?? 0 })
}
