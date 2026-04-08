import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest, createClientFromAuthHeader } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const { postId } = await params;
    console.log('[API] get-or-create-thread called for postId:', postId);

    const authHeader = request.headers.get('authorization');
    console.log('[API] Authorization header present:', !!authHeader);
    console.log('[API] Authorization header value:', authHeader?.substring(0, 20) + '...');

    const supabaseFromAuth = await createClientFromAuthHeader(request);
    const supabase = supabaseFromAuth || createClientFromRequest(request);

    console.log('[API] Using auth header client:', !!supabaseFromAuth);

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    console.log('[API] User authenticated:', user?.id);
    console.log('[API] Auth error:', authError);

    if (!user) {
      console.log('[API] No user found, returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .maybeSingle();

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (post.user_id === user.id) {
      return NextResponse.json(
        { error: 'Cannot apply to your own post' },
        { status: 400 }
      );
    }

    const postOwnerId = post.user_id;
    const contactUserId = user.id;

    const { data: existingThreads, error: searchError } = await supabase
      .from('thread_participants')
      .select(`
        thread_id,
        threads!inner(
          id,
          post_id,
          thread_type
        )
      `)
      .eq('user_id', contactUserId);

    if (searchError) {
      console.error('Error searching for threads:', searchError);
      return NextResponse.json(
        { error: 'Failed to search for threads' },
        { status: 500 }
      );
    }

    let existingThread = null;
    if (existingThreads) {
      for (const tp of existingThreads) {
        const thread = Array.isArray(tp.threads) ? tp.threads[0] : tp.threads;
        if (thread?.post_id === postId && thread?.thread_type === 'post') {
          const { data: otherParticipants } = await supabase
            .from('thread_participants')
            .select('user_id')
            .eq('thread_id', thread.id)
            .neq('user_id', contactUserId);

          if (otherParticipants?.some(p => p.user_id === postOwnerId)) {
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
          user1_id: contactUserId,
          user2_id: postOwnerId,
          post_id: postId,
          thread_type: 'post',
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Error creating thread:', createError);
        return NextResponse.json(
          { error: 'Failed to create thread' },
          { status: 500 }
        );
      }

      threadId = newThread.id;

      const { error: participant1Error } = await supabase
        .from('thread_participants')
        .insert({
          thread_id: threadId,
          user_id: contactUserId,
        });

      const { error: participant2Error } = await supabase
        .from('thread_participants')
        .insert({
          thread_id: threadId,
          user_id: postOwnerId,
        });

      if (participant1Error || participant2Error) {
        console.error('Error adding participants:', participant1Error || participant2Error);
      }
    }

    const { data: userMessages, error: messagesError } = await supabase
      .from('messages')
      .select('id')
      .eq('thread_id', threadId)
      .eq('sender_id', contactUserId)
      .eq('is_system', false)
      .eq('is_deleted', false)
      .limit(1);

    if (messagesError) {
      console.error('Error checking messages:', messagesError);
    }

    const hasApplied = userMessages && userMessages.length > 0;

    return NextResponse.json({
      threadId,
      hasApplied,
    });
  } catch (error) {
    console.error('Error in get-or-create-thread:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
