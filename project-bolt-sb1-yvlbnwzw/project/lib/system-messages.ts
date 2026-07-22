import { supabase } from './supabase/client';
import enTranslations from './translations/en';
import srTranslations from './translations/sr';

export type SystemMessageType =
  | 'job_created'
  | 'pro_contacted'
  | 'job_completed'
  | 'review_submitted'
  | 'completion_requested'
  | 'completion_request_canceled'
  | 'completion_reminder'
  | 'completion_declined'
  | 'payment_placeholder';

const MESSAGE_KEY_MAP: Record<SystemMessageType, string> = {
  job_created: 'systemMessage.jobCreated',
  pro_contacted: 'systemMessage.proContacted',
  job_completed: 'systemMessage.jobCompleted',
  review_submitted: 'systemMessage.reviewSubmitted',
  completion_requested: 'systemMessage.completionRequested',
  completion_request_canceled: 'systemMessage.completionRequestCanceled',
  completion_reminder: 'systemMessage.completionReminder',
  completion_declined: 'systemMessage.completionDeclined',
  payment_placeholder: 'systemMessage.paymentPlaceholder',
};

function getTranslation(key: string, language: 'en' | 'sr' | 'de' = 'sr'): string {
  const translations = language === 'en' || language === 'de' ? enTranslations : srTranslations;
  return (translations[key as keyof typeof translations] as string) || key;
}

export function getSystemMessageText(messageType: SystemMessageType | null | undefined, language: 'en' | 'sr' | 'de' = 'sr'): string | null {
  if (!messageType) return null;
  const translationKey = MESSAGE_KEY_MAP[messageType];
  return translationKey ? getTranslation(translationKey, language) : null;
}

export async function createSystemMessage(
  threadId: string,
  messageType: SystemMessageType,
  customMessage?: string,
  language: 'en' | 'sr' | 'de' = 'sr'
): Promise<{ success: boolean; error?: string }> {
  try {
    const translationKey = MESSAGE_KEY_MAP[messageType];
    const message = customMessage || getTranslation(translationKey, language);
    const currentUser = (await supabase.auth.getUser()).data.user;

    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    const { data: thread, error: threadError } = await supabase
      .from('threads')
      .select('user1_id, user2_id')
      .eq('id', threadId)
      .single();

    if (threadError || !thread) {
      console.error('Error fetching thread:', threadError);
      return { success: false, error: threadError?.message || 'Thread not found' };
    }

    const receiverId = currentUser.id === thread.user1_id ? thread.user2_id : thread.user1_id;

    const { error } = await supabase
      .from('messages')
      .insert({
        thread_id: threadId,
        text: message,
        is_system: true,
        system_message_type: messageType,
        sender_id: currentUser.id,
        receiver_id: receiverId,
      });

    if (error) {
      console.error('Error creating system message:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating system message:', error);
    return { success: false, error: String(error) };
  }
}

export async function createJobCreatedMessage(threadId: string, language: 'en' | 'sr' | 'de' = 'sr'): Promise<void> {
  await createSystemMessage(threadId, 'job_created', undefined, language);
}

export async function createProContactedMessage(threadId: string, language: 'en' | 'sr' | 'de' = 'sr'): Promise<void> {
  await createSystemMessage(threadId, 'pro_contacted', undefined, language);
}

export async function createJobCompletedMessage(threadId: string, language: 'en' | 'sr' | 'de' = 'sr'): Promise<void> {
  await createSystemMessage(threadId, 'job_completed', undefined, language);
}

export async function createReviewSubmittedMessage(threadId: string, language: 'en' | 'sr' | 'de' = 'sr'): Promise<void> {
  await createSystemMessage(threadId, 'review_submitted', undefined, language);
}

export async function createCompletionRequestedMessage(threadId: string, language: 'en' | 'sr' | 'de' = 'sr'): Promise<void> {
  await createSystemMessage(threadId, 'completion_requested', undefined, language);
}

export async function createCompletionRequestCanceledMessage(threadId: string, language: 'en' | 'sr' | 'de' = 'sr'): Promise<void> {
  await createSystemMessage(threadId, 'completion_request_canceled', undefined, language);
}

export async function createCompletionReminderMessage(threadId: string, language: 'en' | 'sr' | 'de' = 'sr'): Promise<void> {
  await createSystemMessage(threadId, 'completion_reminder', undefined, language);
}

export async function createCompletionDeclinedMessage(threadId: string, language: 'en' | 'sr' | 'de' = 'sr'): Promise<void> {
  await createSystemMessage(threadId, 'completion_declined', undefined, language);
}

export async function createPaymentPlaceholderMessage(threadId: string, language: 'en' | 'sr' | 'de' = 'sr'): Promise<void> {
  await createSystemMessage(threadId, 'payment_placeholder', undefined, language);
}

export async function isFirstProMessage(threadId: string, proId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('messages')
    .select('id')
    .eq('thread_id', threadId)
    .eq('sender_id', proId)
    .eq('is_system', false)
    .limit(1);

  if (error) {
    console.error('Error checking first pro message:', error);
    return false;
  }

  return !data || data.length === 0;
}
