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

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return { threadId: null, error: 'Not authenticated' };
    }

    const threadType = jobId ? 'job' : 'direct';

    // Filter directly by both users — avoids fetching all threads and hitting row limits
    let query = supabase
      .from('threads')
      .select('id')
      .eq('thread_type', threadType)
      .or(
        `and(user1_id.eq.${customerId},user2_id.eq.${proId}),and(user1_id.eq.${proId},user2_id.eq.${customerId})`
      );

    if (jobId) {
      query = query.eq('job_id', jobId);
    } else {
      query = query.is('job_id', null);
    }

    const { data: existingThreads, error: searchError } = await query.limit(1);

    if (searchError) {
      return { threadId: null, error: searchError.message };
    }

    if (existingThreads && existingThreads.length > 0) {
      return { threadId: existingThreads[0].id, error: null, isNewThread: false };
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
      // If unique constraint violation, the thread was created concurrently — fetch it
      if (createError.code === '23505') {
        const { data: retryThreads } = await query;
        if (retryThreads && retryThreads.length > 0) {
          return { threadId: retryThreads[0].id, error: null, isNewThread: false };
        }
      }
      return { threadId: null, error: createError.message };
    }

    try {
      await ensureThreadParticipants(newThread.id, customerId, proId);
    } catch (participantErr) {
      // Trigger may have already added participants — not fatal
      console.warn('ensureThreadParticipants failed (trigger may have handled it):', participantErr);
    }

    return { threadId: newThread.id, error: null, isNewThread: true };
  } catch (err: any) {
    return { threadId: null, error: err.message || 'Failed to create or find thread' };
  }
}
