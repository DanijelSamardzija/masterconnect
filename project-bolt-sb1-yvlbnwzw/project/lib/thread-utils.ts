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

interface RpcResult {
  ok: boolean;
  thread_id?: string;
  error?: string;
  is_new?: boolean;
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

    const currentUserId = session.user.id;

    // ── Direct thread ────────────────────────────────────────────────────────
    // Must go through the SECURITY DEFINER RPC — direct INSERT into threads is
    // blocked by RLS for thread_type='direct'. No fallback to direct INSERT.
    if (!jobId) {
      // Determine target: the participant who is not the current user
      const targetUserId = currentUserId === customerId ? proId : customerId;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
        'create_direct_thread_safe',
        { p_target_user_id: targetUserId }
      );

      if (rpcError) {
        return { threadId: null, error: (rpcError as { message: string }).message };
      }

      const result = rpcData as RpcResult | null;

      if (!result?.ok) {
        return { threadId: null, error: result?.error ?? 'failed_to_create_thread' };
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
          .eq('user_id', currentUserId)
          .maybeSingle();

        if (senderParticipant?.deleted_at) {
          await supabase
            .from('thread_participants')
            .update({
              hidden_before: senderParticipant.hidden_before ?? senderParticipant.deleted_at,
              deleted_at: null,
            })
            .eq('thread_id', threadId)
            .eq('user_id', currentUserId);
        }
      }

      return { threadId, error: null, isNewThread };
    }

    // ── Job thread ───────────────────────────────────────────────────────────
    // Job threads are not subject to the direct-thread rate limit and continue
    // to use direct INSERT (thread_type='job' is allowed by RLS).
    const query = supabase
      .from('threads')
      .select('id')
      .eq('thread_type', 'job')
      .or(
        `and(user1_id.eq.${customerId},user2_id.eq.${proId}),and(user1_id.eq.${proId},user2_id.eq.${customerId})`
      )
      .eq('job_id', jobId);

    const { data: existingThreads, error: searchError } = await query.limit(1);

    if (searchError) {
      return { threadId: null, error: searchError.message };
    }

    if (existingThreads && existingThreads.length > 0) {
      const threadId = existingThreads[0].id;

      const { data: senderParticipant } = await supabase
        .from('thread_participants')
        .select('deleted_at, hidden_before')
        .eq('thread_id', threadId)
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (senderParticipant?.deleted_at) {
        await supabase
          .from('thread_participants')
          .update({
            hidden_before: senderParticipant.hidden_before ?? senderParticipant.deleted_at,
            deleted_at: null,
          })
          .eq('thread_id', threadId)
          .eq('user_id', currentUserId);
      }

      return { threadId, error: null, isNewThread: false };
    }

    const { data: newThread, error: createError } = await supabase
      .from('threads')
      .insert({
        user1_id: customerId,
        user2_id: proId,
        job_id: jobId,
        thread_type: 'job',
      })
      .select('id')
      .single();

    if (createError) {
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create or find thread';
    return { threadId: null, error: message };
  }
}
