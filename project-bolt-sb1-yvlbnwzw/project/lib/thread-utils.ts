import { supabase } from './supabase/client';

export async function ensureThreadParticipants(threadId: string, customerId: string, proId: string) {
  const { error } = await supabase.rpc('add_thread_participants', {
    p_thread_id: threadId,
    p_customer_id: customerId,
    p_pro_id: proId,
  });

  if (error) {
    console.error('Error adding thread participants:', error);
    throw error;
  }
}

export async function findOrCreateThread(params: {
  customerId: string;
  proId: string;
  jobId?: string;
}): Promise<{ threadId: string | null; error: string | null; isNewThread?: boolean }> {
  try {
    const { customerId, proId, jobId } = params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { threadId: null, error: 'Not authenticated' };
    }

    const threadType = jobId ? 'job' : 'direct';

    let query = supabase
      .from('threads')
      .select('id, user1_id, user2_id')
      .eq('thread_type', threadType);

    if (jobId) {
      query = query.eq('job_id', jobId);
    } else {
      query = query.is('job_id', null);
    }

    const { data: allThreads, error: searchError } = await query;

    if (searchError) {
      return { threadId: null, error: searchError.message };
    }

    for (const thread of allThreads || []) {
      const isMatch =
        (thread.user1_id === customerId && thread.user2_id === proId) ||
        (thread.user1_id === proId && thread.user2_id === customerId);

      if (isMatch) {
        return { threadId: thread.id, error: null, isNewThread: false };
      }
    }

    const { data: newThread, error: createError } = await supabase
      .from('threads')
      .insert({
        user1_id: customerId,
        user2_id: proId,
        job_id: jobId || null,
        thread_type: threadType,
      })
      .select('id')
      .single();

    if (createError) {
      return { threadId: null, error: createError.message };
    }

    await ensureThreadParticipants(newThread.id, customerId, proId);

    return { threadId: newThread.id, error: null, isNewThread: true };
  } catch (err: any) {
    return { threadId: null, error: err.message || 'Failed to create or find thread' };
  }
}
