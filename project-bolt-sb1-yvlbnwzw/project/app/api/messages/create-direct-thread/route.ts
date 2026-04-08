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

    // Find existing direct thread between these two users
    const { data: existingThreads, error: searchError } = await supabase
      .from('thread_participants')
      .select(`
        thread_id,
        deleted_at,
        threads!inner(
          id,
          thread_type,
          job_id,
          post_id
        )
      `)
      .eq('user_id', user.id)
      .is('deleted_at', null);

    if (searchError) {
      console.error('Error searching for threads:', searchError);
      return NextResponse.json({ error: 'Failed to search for threads' }, { status: 500 });
    }

    let existingThread = null;
    if (existingThreads) {
      for (const tp of existingThreads) {
        const thread = Array.isArray(tp.threads) ? tp.threads[0] : tp.threads;
        if (thread?.thread_type === 'direct' && !thread?.job_id && !thread?.post_id) {
          const { data: otherParticipants } = await supabase
            .from('thread_participants')
            .select('user_id, deleted_at')
            .eq('thread_id', thread.id)
            .neq('user_id', user.id);

          const targetParticipant = otherParticipants?.find(p => p.user_id === targetUserId);
          if (targetParticipant && !targetParticipant.deleted_at) {
            existingThread = thread;
            break;
          }
        }
      }
    }

    let threadId: string;

    if (existingThread) {
      threadId = existingThread.id;
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
