import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Signed URLs expire after 60 minutes. The client caches them and won't
// re-request until they are within 5 minutes of expiry.
const SIGNED_URL_EXPIRY_SECONDS = 3600

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

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user }, error } = await anonClient.auth.getUser()
  return error || !user ? null : user
}

// POST /api/storage/signed-url
// Body: { file_paths: string[] }
// Returns: { urls: Record<string, string> }  (file_path → signedUrl)
//
// Security:
//   - Caller must be authenticated (Bearer token).
//   - Only file_paths that belong to messages in threads the caller participates
//     in are signed. Any other paths are silently excluded from the result.
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let file_paths: string[]
  try {
    const body = await request.json()
    file_paths = body.file_paths
    if (!Array.isArray(file_paths) || file_paths.length === 0) throw new Error()
  } catch {
    return NextResponse.json({ error: 'file_paths must be a non-empty array' }, { status: 400 })
  }

  // Clamp to 50 paths per request to prevent abuse
  const paths = file_paths.slice(0, 50)

  const admin = serviceClient()

  // 1. Resolve message_id for each file_path
  const { data: attachments, error: attErr } = await admin
    .from('message_attachments')
    .select('file_path, message_id')
    .in('file_path', paths)
    .not('file_path', 'is', null)

  if (attErr || !attachments || attachments.length === 0) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // 2. Resolve thread_id for each message_id
  const messageIds = [...new Set(attachments.map((a: any) => a.message_id as string))]

  const { data: msgs, error: msgErr } = await admin
    .from('messages')
    .select('id, thread_id')
    .in('id', messageIds)

  if (msgErr || !msgs) {
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  const messageToThread = new Map<string, string>(
    msgs.map((m: any) => [m.id as string, m.thread_id as string])
  )
  const threadIds = [...new Set(msgs.map((m: any) => m.thread_id as string))]

  // 3. Verify caller is a participant in those threads
  const { data: participantRows, error: pErr } = await admin
    .from('thread_participants')
    .select('thread_id')
    .in('thread_id', threadIds)
    .eq('user_id', user.id)
    .is('deleted_at', null)

  if (pErr) {
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  const allowedThreadIds = new Set<string>(
    (participantRows ?? []).map((r: any) => r.thread_id as string)
  )

  // 4. Build the list of authorized file_paths
  const authorizedPaths: string[] = []
  for (const att of attachments) {
    const threadId = messageToThread.get(att.message_id as string)
    if (threadId && allowedThreadIds.has(threadId) && att.file_path) {
      authorizedPaths.push(att.file_path as string)
    }
  }

  if (authorizedPaths.length === 0) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // 5. Generate signed URLs (service role bypasses storage RLS)
  const { data: signedData, error: signErr } = await admin.storage
    .from('message-attachments')
    .createSignedUrls(authorizedPaths, SIGNED_URL_EXPIRY_SECONDS)

  if (signErr || !signedData) {
    return NextResponse.json({ error: 'sign_failed' }, { status: 500 })
  }

  const urls: Record<string, string> = {}
  for (const item of signedData) {
    if (item.signedUrl && item.path) {
      urls[item.path] = item.signedUrl
    }
  }

  return NextResponse.json({ urls })
}
