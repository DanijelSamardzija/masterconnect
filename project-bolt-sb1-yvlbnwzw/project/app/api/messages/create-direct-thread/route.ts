import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

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

    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });
    }

    // Find existing direct thread between these two users — regardless of deleted_at.
    // Deletion is per-user (hidden_before cutoff); we never create a second thread
    // between the same pair. The message INSERT trigger handles restoring visibility.
    const { data: existingThread, error: searchError } = await supabase
      .from('threads')
      .select('id')
      .eq('thread_type', 'direct')
      .is('job_id', null)
      .is('post_id', null)
      .or(
        `and(user1_id.eq.${user.id},user2_id.eq.${targetUserId}),` +
        `and(user1_id.eq.${targetUserId},user2_id.eq.${user.id})`
      )
      .limit(1)
      .maybeSingle();

    if (searchError) {
      console.error('Error searching for threads:', searchError);
      return NextResponse.json({ error: 'Failed to search for threads' }, { status: 500 });
    }

    let threadId: string;

    if (existingThread) {
      threadId = existingThread.id;

      // If sender had previously deleted this thread, restore their participation
      // so the messages RLS policy (requires deleted_at IS NULL) passes on INSERT.
      // Preserve hidden_before so they only see messages after their deletion cutoff.
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
    } else {
      const { data: newThread, error: createError } = await supabase
        .from('threads')
        .insert({
          user1_id: user.id,
          user2_id: targetUserId,
          thread_type: 'direct',
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Error creating thread:', createError);
        return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
      }

      threadId = newThread.id;

      await supabase.from('thread_participants').insert({ thread_id: threadId, user_id: user.id });
      await supabase.from('thread_participants').insert({ thread_id: threadId, user_id: targetUserId });
    }

    return NextResponse.json({ threadId });
  } catch (error) {
    console.error('Error in create-direct-thread:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
