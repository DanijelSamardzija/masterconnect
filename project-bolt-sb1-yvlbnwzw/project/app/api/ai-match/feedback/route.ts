import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

export const runtime = 'nodejs'

const bodySchema = z.object({
  post_id:              z.string().uuid(),
  candidate_profile_id: z.string().uuid(),
  feedback:             z.enum(['positive', 'negative']).default('negative'),
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

// POST /api/ai-match/feedback
// Records thumbs-down (negative) feedback on a candidate for future prompt fine-tuning
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const raw    = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  const { post_id, candidate_profile_id, feedback } = parsed.data

  const supabase = serviceClient()

  // Verify the user owns the post
  const { data: post } = await supabase
    .from('posts')
    .select('user_id')
    .eq('id', post_id)
    .maybeSingle()

  if (!post) return NextResponse.json({ error: 'post_not_found' }, { status: 404 })
  if (post.user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Upsert feedback (idempotent)
  const { error: insertErr } = await supabase
    .from('matchmaking_feedback_log')
    .upsert(
      { user_id: user.id, post_id, candidate_profile_id, feedback },
      { onConflict: 'user_id,post_id,candidate_profile_id' },
    )

  if (insertErr) {
    return NextResponse.json({ error: 'feedback_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
