import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const ALLOWED_MEDIA_TYPES = ['image', 'video'] as const
type MediaType = typeof ALLOWED_MEDIA_TYPES[number]

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

// POST /api/rewards/post-reward
// Awards credits for posting with media. p_user_id is taken from the
// validated session — never from the request body — so a caller cannot
// claim rewards on behalf of another account.
// earn_post_reward is REVOKED from authenticated; only service_role may call it.
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const raw        = await request.json().catch(() => null)
  const media_type = raw?.media_type as string | undefined

  if (!media_type || !(ALLOWED_MEDIA_TYPES as readonly string[]).includes(media_type)) {
    return NextResponse.json({ error: 'invalid_media_type' }, { status: 400 })
  }

  const supabase = serviceClient()
  const { data, error } = await supabase.rpc('earn_post_reward', {
    p_user_id:    user.id,
    p_media_type: media_type as MediaType,
  })

  if (error) {
    console.error('[rewards/post-reward] earn_post_reward error:', error.message)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  return NextResponse.json({ earned: data ?? 0 })
}
