import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

interface RpcResult {
  ok: boolean;
  thread_id?: string;
  error?: string;
  is_new?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetUserId } = body;

    // Extract token — same pattern as /api/posts
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : request.headers.get('x-access-token') || '';

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (!user || userError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'Target user ID is required' }, { status: 400 });
    }

    // Delegate to SECURITY DEFINER RPC — handles existence check, block check,
    // new-account rate limit, advisory lock for race safety, and INSERT.
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'create_direct_thread_safe',
      { p_target_user_id: targetUserId }
    );

    if (rpcError) {
      console.error('Error calling create_direct_thread_safe:', rpcError);
      return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
    }

    const result = rpcData as RpcResult | null;

    if (!result?.ok) {
      switch (result?.error) {
        case 'new_account_limit_reached':
          return NextResponse.json(
            {
              error: 'Dostignut je privremeni limit za pokretanje novih razgovora. ' +
                     'Novi nalozi mogu pokrenuti do 3 nova direktna razgovora u 24h. ' +
                     'Pokušaj ponovo sutra.',
            },
            { status: 429 }
          );
        case 'cannot_message_self':
          return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });
        case 'blocked':
          return NextResponse.json({ error: 'Cannot message this user' }, { status: 403 });
        case 'target_not_found':
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        default:
          return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
      }
    }

    const threadId = result.thread_id!;
    const isNewThread = result.is_new ?? false;

    // Restore sender's participation if they had previously deleted this thread.
    // This makes the thread reappear in their list before they send the first message.
    // The on_message_reset_deleted trigger handles this on message INSERT as a fallback.
    if (!isNewThread) {
      const { data: senderParticipant } = await supabase
        .from('thread_participants')
        .select('deleted_at, hidden_before')
        .eq('thread_id', threadId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (senderParticipant?.deleted_at) {
        await supabase
          .from('thread_participants')
          .update({
            hidden_before: senderParticipant.hidden_before ?? senderParticipant.deleted_at,
            deleted_at: null,
          })
          .eq('thread_id', threadId)
          .eq('user_id', user.id);
      }
    }

    return NextResponse.json({ threadId });
  } catch (error) {
    console.error('Error in create-direct-thread:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
