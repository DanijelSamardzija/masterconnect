// Generic inquiry actions — workflow only (create, accept, decline, close, get).
// Payment is handled atomically inside the accept_inquiry DB RPC (SECURITY DEFINER).
// All other payment concerns (escrow, refund, payout) are deferred to future sprints.

import { supabase } from '@/lib/supabase/client';
import type { InquirySubjectMeta, InquiryRow, Inquiry } from './types';
import { toInquiry } from './types';

export type CreateInquiryParams = {
  subjectType: string;
  subjectId: string;
  subjectMeta: InquirySubjectMeta;
  senderId: string;
  receiverId: string;
  message: string;
  threadType: string;  // 'adult_inquiry', 'job_inquiry', … — controls Messages routing
};

type InquiryResult = { ok: boolean; threadId?: string; inquiryId?: string; error?: string };

// ─────────────────────────────────────────────────────────────
// createInquiry
// Sprint 3 injection point: credit check / deduction goes BEFORE this call,
// in the module adapter (lib/adult/inquiry.ts etc.), not here.
// ─────────────────────────────────────────────────────────────
export async function createInquiry(params: CreateInquiryParams): Promise<InquiryResult> {
  const { senderId, receiverId, subjectType, subjectId, subjectMeta, message, threadType } = params;

  // 1. Create thread. Trigger auto-creates thread_participants for user1 + user2.
  const { data: thread, error: threadErr } = await supabase
    .from('threads')
    .insert({ user1_id: senderId, user2_id: receiverId, thread_type: threadType })
    .select('id')
    .single();

  if (threadErr || !thread) return { ok: false, error: 'thread_create_failed' };

  // 2. Create inquiry row (inquiries table not yet in generated types — cast)
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { data: inquiry, error: inquiryErr } = await (supabase as any)
    .from('inquiries')
    .insert({
      subject_type: subjectType,
      subject_id:   subjectId,
      subject_meta: subjectMeta,
      sender_id:    senderId,
      receiver_id:  receiverId,
      thread_id:    thread.id,
      message,
      status:       'pending',
      expires_at:   expiresAt,
    })
    .select('id')
    .single();

  if (inquiryErr || !inquiry) return { ok: false, error: 'inquiry_create_failed' };

  // 3. First message in thread (plain text mirror of the inquiry message)
  await supabase.from('messages').insert({
    thread_id:   thread.id,
    sender_id:   senderId,
    receiver_id: receiverId,
    text:        message,
  });

  // 4. Notify receiver
  const [{ data: sender }, { data: receiverLangRow }] = await Promise.all([
    supabase.from('profiles').select('name').eq('id', senderId).single(),
    supabase.from('profiles').select('preferred_language').eq('id', receiverId).maybeSingle(),
  ]);

  const senderName = sender?.name ?? 'Someone';
  const receiverLang = (receiverLangRow?.preferred_language as string) || 'sr';

  const inquiryReceivedTitles: Record<string, string> = {
    en: `${senderName} sent you an inquiry`,
    de: `${senderName} hat Ihnen eine Anfrage gesendet`,
    es: `${senderName} te envió una consulta`,
    fr: `${senderName} vous a envoyé une demande`,
    sr: `${senderName} ti je poslao/la upit`,
  };

  await supabase.from('notifications').insert({
    user_id:     receiverId,
    type:        'inquiry',
    action_type: 'inquiry_received',
    title:       inquiryReceivedTitles[receiverLang] ?? inquiryReceivedTitles.sr,
    body:        `"${subjectMeta.title}" — ${message.slice(0, 100)}`,
    meta: {
      inquiry_id:   inquiry.id,
      thread_id:    thread.id,
      subject_type: subjectType,
      actor_name:   senderName,
    },
  });

  return { ok: true, threadId: thread.id, inquiryId: inquiry.id };
}

// ─────────────────────────────────────────────────────────────
// acceptInquiry — delegates entirely to the accept_inquiry RPC.
// The RPC runs as a single PostgreSQL transaction:
//   FOR UPDATE lock → status check → credit deduction → status update.
// If any step fails, the DB rolls back atomically — no partial state.
// ─────────────────────────────────────────────────────────────
export async function acceptInquiry(inquiryId: string): Promise<{ ok: boolean; error?: string }> {
  // Pre-fetch for system message + notification content only (read-only, not part of the atomic op).
  const { data: inquiry } = await (supabase as any)
    .from('inquiries')
    .select('thread_id, sender_id, receiver_id, subject_meta')
    .eq('id', inquiryId)
    .single();

  if (!inquiry) return { ok: false, error: 'not_found' };

  // Single atomic RPC: status check + payment + status update in one transaction.
  const { data, error } = await (supabase as any).rpc('accept_inquiry', {
    p_inquiry_id: inquiryId,
  });

  if (error) return { ok: false, error: error.message };

  const result = data as { ok?: boolean; error?: string; amount?: number };
  if (!result?.ok) return { ok: false, error: result?.error ?? 'accept_failed' };

  // Signal credit balance to re-fetch (creator's browser only).
  if (typeof window !== 'undefined' && (result.amount ?? 0) > 0) {
    window.dispatchEvent(new CustomEvent('credits-changed'));
  }

  // System message + notification are fire-and-forget; failure does not affect payment state.
  if (inquiry.thread_id) {
    const creditNote = (result.amount ?? 0) > 0 ? ` ${result.amount} credits transferred.` : '';
    await supabase.from('messages').insert({
      thread_id:           inquiry.thread_id,
      sender_id:           inquiry.receiver_id,
      receiver_id:         inquiry.sender_id,
      text:                `Inquiry accepted — let's get started!${creditNote}`,
      is_system:           true,
      system_message_type: 'inquiry_accepted',
    });
  }

  const [{ data: receiver }, { data: senderLangRow }] = await Promise.all([
    supabase.from('profiles').select('name').eq('id', inquiry.receiver_id).single(),
    supabase.from('profiles').select('preferred_language').eq('id', inquiry.sender_id).maybeSingle(),
  ]);

  const receiverName = receiver?.name ?? 'Creator';
  const senderLang = (senderLangRow?.preferred_language as string) || 'sr';
  const subjectTitle = (inquiry.subject_meta as InquirySubjectMeta).title;

  const acceptedTitles: Record<string, string> = {
    en: 'Your inquiry was accepted',
    de: 'Ihre Anfrage wurde angenommen',
    es: 'Tu consulta fue aceptada',
    fr: 'Votre demande a été acceptée',
    sr: 'Vaš upit je prihvaćen',
  };
  const acceptedBodies: Record<string, string> = {
    en: `${receiverName} accepted your inquiry for "${subjectTitle}"`,
    de: `${receiverName} hat Ihre Anfrage für „${subjectTitle}" angenommen`,
    es: `${receiverName} aceptó tu consulta para "${subjectTitle}"`,
    fr: `${receiverName} a accepté votre demande pour « ${subjectTitle} »`,
    sr: `${receiverName} je prihvatio/la vaš upit za „${subjectTitle}"`,
  };

  await supabase.from('notifications').insert({
    user_id:     inquiry.sender_id,
    type:        'inquiry',
    action_type: 'inquiry_accepted',
    title:       acceptedTitles[senderLang] ?? acceptedTitles.sr,
    body:        acceptedBodies[senderLang] ?? acceptedBodies.sr,
    meta: { inquiry_id: inquiryId, thread_id: inquiry.thread_id, actor_name: receiverName },
  });

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// declineInquiry
// Sprint 3: if a credit hold was placed, release it here.
// ─────────────────────────────────────────────────────────────
export async function declineInquiry(inquiryId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: inquiry } = await (supabase as any)
    .from('inquiries')
    .select('thread_id, sender_id, receiver_id, subject_meta')
    .eq('id', inquiryId)
    .single();

  if (!inquiry) return { ok: false, error: 'not_found' };

  const { data: declined, error } = await (supabase as any)
    .from('inquiries')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', inquiryId)
    .eq('status', 'pending')
    .select('id');

  if (error) return { ok: false, error: error.message };
  if (!declined?.length) return { ok: false, error: 'not_pending' };

  if (inquiry.thread_id) {
    await supabase.from('messages').insert({
      thread_id:           inquiry.thread_id,
      sender_id:           inquiry.receiver_id,
      receiver_id:         inquiry.sender_id,
      text:                'Inquiry declined.',
      is_system:           true,
      system_message_type: 'inquiry_declined',
    });
  }

  const [{ data: receiver }, { data: senderLangRow }] = await Promise.all([
    supabase.from('profiles').select('name').eq('id', inquiry.receiver_id).single(),
    supabase.from('profiles').select('preferred_language').eq('id', inquiry.sender_id).maybeSingle(),
  ]);

  const receiverName = receiver?.name ?? 'Creator';
  const senderLang = (senderLangRow?.preferred_language as string) || 'sr';
  const subjectTitle = (inquiry.subject_meta as InquirySubjectMeta).title;

  const declinedTitles: Record<string, string> = {
    en: 'Your inquiry was declined',
    de: 'Ihre Anfrage wurde abgelehnt',
    es: 'Tu consulta fue rechazada',
    fr: 'Votre demande a été refusée',
    sr: 'Vaš upit je odbijen',
  };
  const declinedBodies: Record<string, string> = {
    en: `${receiverName} declined your inquiry for "${subjectTitle}"`,
    de: `${receiverName} hat Ihre Anfrage für „${subjectTitle}" abgelehnt`,
    es: `${receiverName} rechazó tu consulta para "${subjectTitle}"`,
    fr: `${receiverName} a refusé votre demande pour « ${subjectTitle} »`,
    sr: `${receiverName} je odbio/la vaš upit za „${subjectTitle}"`,
  };

  await supabase.from('notifications').insert({
    user_id:     inquiry.sender_id,
    type:        'inquiry',
    action_type: 'inquiry_declined',
    title:       declinedTitles[senderLang] ?? declinedTitles.sr,
    body:        declinedBodies[senderLang] ?? declinedBodies.sr,
    meta: { inquiry_id: inquiryId, thread_id: inquiry.thread_id, actor_name: receiverName },
  });

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// closeInquiry — marks an accepted inquiry as completed
// ─────────────────────────────────────────────────────────────
export async function closeInquiry(inquiryId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await (supabase as any)
    .from('inquiries')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', inquiryId)
    .eq('status', 'accepted');

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// getInquiryByThread — used by thread view to render InquiryCard.
// Applies lazy expiry (pending + past expires_at → expired) and
// lazy auto-complete (accepted + 7+ days since responded_at → completed).
// Both use a status guard so concurrent calls are idempotent.
// ─────────────────────────────────────────────────────────────
export async function getInquiryByThread(threadId: string): Promise<Inquiry | null> {
  const { data } = await (supabase as any)
    .from('inquiries')
    .select('*')
    .eq('thread_id', threadId)
    .maybeSingle();

  if (!data) return null;

  const now = new Date();

  // Lazy expiry: pending inquiry past its expiry window.
  if (data.status === 'pending' && data.expires_at && new Date(data.expires_at) < now) {
    await (supabase as any)
      .from('inquiries')
      .update({ status: 'expired' })
      .eq('id', data.id)
      .eq('status', 'pending'); // guard: idempotent if already changed
    data.status = 'expired';
  }

  // Lazy auto-complete: accepted inquiry with no action for 7+ days.
  if (data.status === 'accepted' && data.responded_at) {
    const msSinceAccepted = now.getTime() - new Date(data.responded_at).getTime();
    const daysSinceAccepted = msSinceAccepted / (1000 * 60 * 60 * 24);
    if (daysSinceAccepted >= 7) {
      const completedAt = now.toISOString();
      await (supabase as any)
        .from('inquiries')
        .update({ status: 'completed', completed_at: completedAt })
        .eq('id', data.id)
        .eq('status', 'accepted'); // guard: idempotent if already changed
      data.status = 'completed';
      data.completed_at = completedAt;
    }
  }

  return toInquiry(data as InquiryRow);
}
