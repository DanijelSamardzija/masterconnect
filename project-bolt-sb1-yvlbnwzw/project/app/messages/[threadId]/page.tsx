'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { notificationRepository } from '@/lib/repositories/notificationRepository';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { ProtectedRoute } from '@/components/protected-route';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Send,
  MessageSquare,
  AlertCircle,
  Trash2,
  Paperclip,
  X,
  FileIcon,
  Loader2,
  User,
  Briefcase,
  CheckCircle2,
  XCircle,
  Check,
  CheckCheck,
  UserX,
  MoreVertical,
} from 'lucide-react';
import { validateFile, uploadFile, formatFileSize, getFileType, uploadVideoToCloudinary } from '@/lib/attachment-utils';
import { usePresence } from '@/lib/hooks/use-presence';
import { isOnline, formatLastSeen } from '@/lib/online-status';
import { VideoMessage, ImageMessage } from '@/components/video-message';
import { toast } from 'sonner';
import { EmojiPicker } from '@/components/emoji-picker';
import { addRecentEmoji, loadRecentEmojisFromDatabase, syncRecentEmojisToDatabase } from '@/lib/emoji-tracking';
import { devLog } from '@/lib/dev-log';
import { TwemojiText, MessageText } from '@/components/twemoji';
import { ReviewModal } from '@/components/review-modal';
import { BlockUserModal } from '@/components/block-user-modal';
import { OfferCard } from '@/components/offer-card';
import { ApplicationMessageCard } from '@/components/application-message-card';
import {
  createJobCompletedMessage,
  createCompletionRequestedMessage,
  createCompletionRequestCanceledMessage,
  createCompletionDeclinedMessage,
  createPaymentPlaceholderMessage,
  getSystemMessageText,
  SystemMessageType,
} from '@/lib/system-messages';

type Attachment = {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
};

type Message = {
  id: string;
  text: string;
  sender_id: string | null;
  created_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
  is_system: boolean;
  system_message_type?: string;
  message_type?: string;
  offer_id?: string;
  delivered_at: string | null;
  seen_at: string | null;
  read_at: string | null;
  sender: {
    name: string;
  } | null;
  attachments?: Attachment[];
  offer?: {
    id: string;
    sender_id: string;
    receiver_id: string;
    offer_type: string;
    price: number;
    currency: string;
    price_type: string;
    estimated_start: string | null;
    duration_deadline: string | null;
    note: string | null;
    status: 'pending' | 'accepted' | 'declined';
    created_at: string;
    responded_at: string | null;
  };
};

type ThreadDetails = {
  id: string;
  customer_id: string;
  pro_id: string;
  user1_id?: string;
  user2_id?: string;
  job_id: string | null;
  post_id?: string | null;
  thread_type: 'direct' | 'job';
  job: {
    id: string;
    title: string;
    description: string;
    status: string;
    completion_requested: boolean;
    completion_requested_at: string | null;
    completion_request_dismissed_at: string | null;
    payment_placeholder_message_sent: boolean;
  } | null;
  customer: {
    name: string;
    email: string;
  } | null;
  pro: {
    name: string;
    email: string;

    avatar_url?: string;
    account_type?: string;
  } | null;
};

function MessagesContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const { language, t } = useLanguage();
  usePresence(user?.id);

  const [thread, setThread] = useState<ThreadDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [markingCompleted, setMarkingCompleted] = useState(false);
  const [requestingCompletion, setRequestingCompletion] = useState(false);
  const [dismissingRequest, setDismissingRequest] = useState(false);
  const [cancelingRequest, setCancelingRequest] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [hasMarkedAsRead, setHasMarkedAsRead] = useState(false);
  const [hiddenAt, setHiddenAt] = useState<string | null>(null);
  const hiddenAtRef = useRef<string | null>(null);
  const fetchMessagesRef = useRef<() => Promise<void>>(async () => {});
  const appendSingleMessageRef = useRef<(id: string) => Promise<void>>(async () => {});
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const threadId = params.threadId as string;

  useEffect(() => {
    const template = searchParams.get('template');
    if (template) {
      setNewMessage(decodeURIComponent(template));
      if (messageInputRef.current) {
        messageInputRef.current.focus();
      }
    }
  }, [searchParams]);

  const isInitialLoad = useRef(true);

  const scrollToBottom = (instant?: boolean) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' });
  };

  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      isInitialLoad.current = false;
      scrollToBottom(true);
    } else {
      scrollToBottom();
    }
  }, [messages]);

  useEffect(() => {
    if (otherUserTyping) scrollToBottom();
  }, [otherUserTyping]);

  useEffect(() => {
    if (messages.length > 0 && user && !hasMarkedAsRead) {
      const unreadMessages = messages.filter(
        (msg) => msg.sender_id !== user.id && !msg.read_at && !msg.is_system
      );

      if (unreadMessages.length > 0) {
        const timer = setTimeout(() => {
          markMessagesAsRead();
          setHasMarkedAsRead(true);
        }, 500);

        return () => clearTimeout(timer);
      }
    }
  }, [messages, user, hasMarkedAsRead]);

  useEffect(() => {
    if (threadId && user) {
      setHasMarkedAsRead(false);
      fetchThread();
    }
  }, [threadId, user]);

  // Heartbeat: update last_read_at every 20s while viewing this thread so the
  // push/email webhook knows the user is active and skips sending notifications.
  useEffect(() => {
    if (!threadId || !user) return;

    const ping = () =>
      supabase
        .from('thread_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('thread_id', threadId)
        .eq('user_id', user.id);

    ping();
    const interval = setInterval(ping, 20_000);
    return () => clearInterval(interval);
  }, [threadId, user]);

  // Typing indicator channel
  useEffect(() => {
    if (!threadId || !user) return;

    const ch = supabase.channel(`typing:${threadId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
        if (payload?.user_id !== user.id) {
          setOtherUserTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setOtherUserTyping(false), 3000);
        }
      })
      .subscribe();

    // Set ref immediately - send() will be ignored silently if not yet subscribed,
    // but interval will retry every 2s so it will eventually go through
    typingChannelRef.current = ch;

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingThrottleRef.current) clearTimeout(typingThrottleRef.current);
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
      typingThrottleRef.current = null;
      supabase.removeChannel(ch);
      typingChannelRef.current = null;
    };
  }, [threadId, user]);

  useEffect(() => {
    if (!threadId || !user) return;

    const messagesChannel = supabase
      .channel(`thread:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setHasMarkedAsRead(false);
            setOtherUserTyping(false);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            // Targeted single-message fetch + append instead of refetching the entire thread
            appendSingleMessageRef.current(payload.new.id);
          } else {
            // UPDATE/DELETE: full refetch needed (offer status, seen_at, is_deleted changes)
            fetchMessagesRef.current();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'offers',
          filter: `conversation_id=eq.${threadId}`,
        },
        () => {
          fetchMessagesRef.current();
        }
      )
      .subscribe((status) => {
        devLog('[Realtime] channel status:', status);
      });

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [threadId, user]);

  useEffect(() => {
    const loadRecentEmojis = async () => {
      if (user) {
        const emojis = await loadRecentEmojisFromDatabase(user.id);
        setRecentEmojis(emojis);
      }
    };

    loadRecentEmojis();
  }, [user]);


  const fetchThread = async () => {
    const { data, error } = await supabase
      .from('threads')
      .select(`
        id,
        user1_id,
        user2_id,
        job_id,
        thread_type,
        post_id,
        job:jobs(id, title, description, status, completion_requested, completion_requested_at, completion_request_dismissed_at),
        user1:profiles!threads_user1_id_fkey(name, email, avatar_url, account_type, last_seen),
        user2:profiles!threads_user2_id_fkey(name, email, avatar_url, account_type, last_seen)
      `)
      .eq('id', threadId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching thread:', error);
      setNotFound(true);
      setLoading(false);
      return;
    }

    if (!data) {
      console.error('No thread data found for threadId:', threadId);
      setNotFound(true);
      setLoading(false);
      return;
    }

    if (user && data.user1_id !== user.id && data.user2_id !== user.id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const threadWithLegacyStructure = {
      ...data,
      customer_id: data.user1_id,
      pro_id: data.user2_id,
      customer: data.user1,
      pro: data.user2,
    };

    if (user) {
      const { data: participantData, error: partError } = await supabase
        .from('thread_participants')
        .select('deleted_at, hidden_before')
        .eq('thread_id', threadId)
        .eq('user_id', user.id)
        .maybeSingle();

      // Only hide messages if participant record genuinely doesn't exist (not a DB error)
      const updateHiddenAt = (val: string | null) => {
        hiddenAtRef.current = val;
        setHiddenAt(val);
      };
      if (!partError && !participantData) {
        updateHiddenAt(new Date().toISOString());
      } else if (participantData) {
        const hiddenBefore = (participantData as any).hidden_before;
        if (hiddenBefore) {
          updateHiddenAt(hiddenBefore);
        } else if (participantData.deleted_at) {
          updateHiddenAt(participantData.deleted_at);
        }
      }
    }

    setThread(threadWithLegacyStructure as any);
    setLoading(false);
    fetchMessages();
  };

  const markMessagesAsRead = async () => {
    if (!user) return;

    const messagesToMark = messages
      .filter((msg) => msg.sender_id !== user.id && !msg.is_system && !msg.is_deleted)
      .map((msg) => msg.id);

    if (messagesToMark.length > 0) {
      await (supabase as any).rpc('mark_messages_read', { p_message_ids: messagesToMark });
    }

    const hasUnread = messages.some(
      (msg) => msg.sender_id !== user.id && !msg.read_at && !msg.is_system && !msg.is_deleted
    );

    if (hasUnread) {
      const now = new Date().toISOString();

      await supabase
        .from('thread_participants')
        .update({ last_read_at: now })
        .eq('thread_id', threadId)
        .eq('user_id', user.id);

      await notificationRepository.markThreadRead(user.id, threadId);

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('unreadCountChanged'));
      }, 200);
    }
  };

  const fetchMessages = async () => {
    let query = supabase
      .from('messages')
      .select(`
        id,
        text,
        sender_id,
        created_at,
        is_deleted,
        deleted_at,
        is_system,
        system_message_type,
        message_type,
        offer_id,
        delivered_at,
        seen_at,
        read_at,
        sender:profiles!messages_sender_id_fkey(name),
        offer:offers!messages_offer_id_fkey(
          id,
          sender_id,
          receiver_id,
          offer_type,
          price,
          currency,
          price_type,
          estimated_start,
          duration_deadline,
          note,
          status,
          created_at,
          responded_at
        )
      `)
      .eq('thread_id', threadId)
      .eq('is_deleted', false);

    if (hiddenAtRef.current) {
      query = query.gt('created_at', hiddenAtRef.current);
    }

    const { data: messagesData, error: messagesError } = await query.order('created_at', {
      ascending: true,
    });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return;
    }

    if (messagesData) {
      const messageIds = messagesData.map((m: any) => m.id);

      const { data: attachmentsData } = await supabase
        .from('message_attachments')
        .select('*')
        .in('message_id', messageIds);

      const messagesWithAttachments = messagesData.map((msg: any) => ({
        ...msg,
        attachments: attachmentsData?.filter((att: any) => att.message_id === msg.id) || [],
      }));

      // Only update state if messages actually changed - avoids re-renders that break typing indicator
      const prev = messagesRef.current;
      const changed =
        prev.length !== messagesWithAttachments.length ||
        messagesWithAttachments.some((m: any, i: number) => {
          const p = prev[i] as any;
          return !p || p.id !== m.id || p.is_deleted !== m.is_deleted ||
            (p.offer?.status !== m.offer?.status) ||
            p.seen_at !== m.seen_at || p.delivered_at !== m.delivered_at;
        });

      if (changed) {
        messagesRef.current = messagesWithAttachments as any;
        setMessages(messagesWithAttachments as any);
      }
    }
  };

  // On INSERT: fetch only the new message + attachments and append — avoids full thread refetch
  const appendSingleMessage = async (messageId: string) => {
    const { data } = await supabase
      .from('messages')
      .select(`
        id, text, sender_id, created_at, is_deleted, deleted_at,
        is_system, system_message_type, message_type, offer_id,
        delivered_at, seen_at, read_at,
        sender:profiles!messages_sender_id_fkey(name),
        offer:offers!messages_offer_id_fkey(
          id, sender_id, receiver_id, offer_type, price, currency,
          price_type, estimated_start, duration_deadline, note, status,
          created_at, responded_at
        )
      `)
      .eq('id', messageId)
      .maybeSingle();

    if (!data) return;

    const { data: attachments } = await supabase
      .from('message_attachments')
      .select('*')
      .eq('message_id', messageId);

    const message = { ...data, attachments: attachments || [] };

    setMessages(prev => {
      if ((prev as any[]).some((m: any) => m.id === messageId)) return prev;
      const updated = [...(prev as any[]), message];
      messagesRef.current = updated as any;
      return updated as any;
    });
  };

  // Keep refs always pointing to latest functions so subscriptions never go stale
  fetchMessagesRef.current = fetchMessages;
  appendSingleMessageRef.current = appendSingleMessage;

  const handleDeleteMessage = async (messageId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));

    const { error: deleteError } = await supabase
      .from('messages')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    if (deleteError) {
      fetchMessages();
    }
  };

  const handleMarkAsCompleted = async () => {
    if (!thread?.job?.id || !user) return;

    setMarkingCompleted(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completion_requested: false,
          completion_requested_at: null,
          completion_reminder_sent_at: null,
          completion_request_dismissed_at: null,
          payment_placeholder_message_sent: true,
        })
        .eq('id', thread.job.id);

      if (updateError) {
        setError(updateError.message);
        toast.error('Failed to mark job as completed');
        return;
      }

      await createJobCompletedMessage(threadId, language);

      if (!thread.job.payment_placeholder_message_sent) {
        await createPaymentPlaceholderMessage(threadId, language);
      }

      await fetchThread();
      await fetchMessages();

      toast.success('Job marked as completed!');
      setShowReviewModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to mark job as completed');
      toast.error('Failed to mark job as completed');
    } finally {
      setMarkingCompleted(false);
    }
  };

  const handleRequestCompletion = async () => {
    if (!thread?.job?.id || !user) return;

    setRequestingCompletion(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          completion_requested: true,
          completion_requested_at: new Date().toISOString(),
          completion_reminder_sent_at: null,
        })
        .eq('id', thread.job.id);

      if (updateError) {
        setError(updateError.message);
        toast.error('Failed to request completion');
        return;
      }

      await createCompletionRequestedMessage(threadId, language);

      await fetchThread();
      await fetchMessages();

      toast.success('Completion request sent!');
    } catch (err: any) {
      setError(err.message || 'Failed to request completion');
      toast.error('Failed to request completion');
    } finally {
      setRequestingCompletion(false);
    }
  };

  const handleDismissCompletionRequest = async () => {
    if (!thread?.job?.id || !user) return;

    setDismissingRequest(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          completion_requested: false,
          completion_requested_at: null,
          completion_request_dismissed_at: new Date().toISOString(),
          completion_reminder_sent_at: null,
        })
        .eq('id', thread.job.id);

      if (updateError) {
        setError(updateError.message);
        toast.error('Failed to decline request');
        return;
      }

      await createCompletionDeclinedMessage(threadId, language);

      await fetchThread();
      await fetchMessages();

      toast.success('Completion request declined');
    } catch (err: any) {
      setError(err.message || 'Failed to decline request');
      toast.error('Failed to decline request');
    } finally {
      setDismissingRequest(false);
    }
  };

  const handleCancelCompletionRequest = async () => {
    if (!thread?.job?.id || !user) return;

    setCancelingRequest(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          completion_requested: false,
          completion_requested_at: null,
          completion_request_dismissed_at: null,
          completion_reminder_sent_at: null,
        })
        .eq('id', thread.job.id);

      if (updateError) {
        setError(updateError.message);
        toast.error('Failed to cancel request');
        return;
      }

      await createCompletionRequestCanceledMessage(threadId, language);

      await fetchThread();
      await fetchMessages();

      toast.success('Completion request canceled');
    } catch (err: any) {
      setError(err.message || 'Failed to cancel request');
      toast.error('Failed to cancel request');
    } finally {
      setCancelingRequest(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: File[] = [];

    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        toast.error(t(validation.error as any));
      } else {
        validFiles.push(file);
      }
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEmojiSelect = async (emoji: string) => {
    const input = messageInputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const text = newMessage;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + emoji + after;

    setNewMessage(newText);

    const updatedRecents = addRecentEmoji(emoji);
    setRecentEmojis(updatedRecents);

    if (user) {
      syncRecentEmojisToDatabase(user.id, updatedRecents);
    }

    setTimeout(() => {
      const newCursorPos = start + emoji.length;
      input.focus();
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const sendTypingEvent = () => {
    if (!user || !typingChannelRef.current) return;
    typingChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { user_id: user.id } });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (!typingThrottleRef.current) {
      // First keystroke - send immediately and start interval
      sendTypingEvent();
      typingThrottleRef.current = setTimeout(() => {
        typingThrottleRef.current = null;
      }, 2000);

      // Keep sending every 2s while typing (receiver timeout is 3s)
      if (!typingIntervalRef.current) {
        typingIntervalRef.current = setInterval(() => {
          if (typingThrottleRef.current) {
            sendTypingEvent();
          } else {
            // No keystrokes in last 2s - stop interval
            clearInterval(typingIntervalRef.current!);
            typingIntervalRef.current = null;
          }
        }, 2000);
      }
    } else {
      // Reset throttle on each keystroke
      clearTimeout(typingThrottleRef.current);
      typingThrottleRef.current = setTimeout(() => {
        typingThrottleRef.current = null;
      }, 2000);
    }
  };

  const handleInputClick = () => {};

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((!newMessage.trim() && selectedFiles.length === 0) || !user || !thread) return;

    setSending(true);
    setUploading(true);
    setError('');

    try {
      const receiverId = user.id === thread.customer_id ? thread.pro_id : thread.customer_id;

      const { data: messageData, error: sendError } = await supabase
        .from('messages')
        .insert({
          thread_id: threadId,
          sender_id: user.id,
          receiver_id: receiverId,
          text: newMessage.trim() || '(Attachment)',
        })
        .select()
        .single();

      if (sendError) throw sendError;

      if (selectedFiles.length > 0 && messageData) {
        const totalFiles = selectedFiles.length;
        const uploadedAttachments = [];

        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          setUploadProgress(((i + 1) / totalFiles) * 100);

          const isVideo = file.type.startsWith('video/');
          let fileUrl: string | null = null;
          let filePath: string | null = null;

          if (isVideo) {
            const result = await uploadVideoToCloudinary(file, 'gigzone/messages', user.id);
            fileUrl = result?.url ?? null;
          } else {
            const result = await uploadFile(file, user.id);
            fileUrl = result?.url ?? null;
            filePath = result?.path ?? null;
          }

          if (fileUrl) {
            uploadedAttachments.push({
              message_id: messageData.id,
              file_url: fileUrl,
              file_path: filePath,
              file_name: file.name,
              file_type: file.type,
              file_size: file.size,
              uploaded_by: user.id,
            });
          } else {
            toast.error(`Failed to upload ${file.name}`);
          }
        }

        if (uploadedAttachments.length > 0) {
          const { error: attachError } = await supabase
            .from('message_attachments')
            .insert(uploadedAttachments);

          if (attachError) {
            toast.error('Failed to save some attachments');
          }
        }
      }

      setNewMessage('');
      setSelectedFiles([]);
      setUploadProgress(0);
      setHiddenAt(null);

      fetchMessages();

      try {
        localStorage.setItem('message-sent', Date.now().toString());
        localStorage.removeItem('message-sent');
      } catch (storageError) {
        console.warn('[Messages] localStorage access blocked:', storageError);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      toast.error('Failed to send message');
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl">
          <Skeleton className="mb-4 h-24 rounded-3xl" />
          <Skeleton className="h-[75vh] rounded-3xl" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-gray-950">
        <Card className="w-full max-w-md rounded-3xl border-0 shadow-xl">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-gray-800">
                <AlertCircle className="h-8 w-8 text-slate-400" />
              </div>
              <h2 className="mb-2 text-2xl font-bold">Conversation Not Found</h2>
              <p className="mb-6 text-muted-foreground">
                This conversation doesn&apos;t exist or you don&apos;t have access to it.
              </p>
              <div className="flex w-full gap-2">
                <Button onClick={() => router.push('/dashboard')} className="flex-1 rounded-full">
                  Go to Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!thread) return null;

  const isCurrentUserCustomer = user?.id === thread.customer_id;
  const otherPerson = isCurrentUserCustomer ? thread.pro : thread.customer;
  const otherPersonId = isCurrentUserCustomer ? thread.pro_id : thread.customer_id;
  const isCustomer = profile?.account_type === 'customer';

  const handleViewProfile = () => {
    // Compute target directly from raw DB columns to avoid customer/pro mapping issues
    const targetId =
      (thread as any).user1_id === user?.id
        ? (thread as any).user2_id
        : (thread as any).user1_id;

    const resolvedId = targetId || otherPersonId;
    if (!resolvedId || resolvedId === user?.id) return;

    const params = new URLSearchParams({
      from: 'chat',
      threadId,
    });

    router.push(`/profile/${resolvedId}?${params.toString()}`);
  };

  const handleViewJob = () => {
    if (thread?.job_id) {
      const params = new URLSearchParams({
        from: 'chat',
        threadId,
      });
      router.push(`/jobs/${thread.job_id}?${params.toString()}`);
    }
  };

  return (
    <>
      <div className="fixed inset-0 flex flex-col overflow-hidden bg-gray-100 dark:bg-gray-950">
        <div className="flex-shrink-0 border-b border-gray-200/80 bg-white/95 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
          <div className="w-full px-3 py-2.5 sm:px-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="h-10 w-10 flex-shrink-0 rounded-full"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>

              <div
                className="-ml-1 flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={handleViewProfile}
              >
                <div className="relative flex-shrink-0">
                  <Avatar className="h-10 w-10 shadow-sm ring-2 ring-white dark:ring-gray-900">
                    <AvatarImage src={(otherPerson as any)?.avatar_url || undefined} alt={otherPerson?.name} />
                    <AvatarFallback className="bg-orange-500 text-white">
                      {otherPerson?.name?.charAt(0).toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  {(otherPerson as any)?.account_type === 'professional' ? (
                    <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 p-0.5 shadow-lg ring-2 ring-white dark:ring-gray-900">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                  ) : isOnline((otherPerson as any)?.last_seen) ? (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500 dark:border-gray-900" />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {otherPerson?.name || otherPerson?.email || 'Nepoznato ime'}
                    </h2>
                    {(otherPerson as any)?.account_type === 'professional' && (
                      <Badge className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 px-1.5 py-0 text-[9px] font-bold text-white shadow-md">
                        PRO
                      </Badge>
                    )}
                  </div>
                  <p className={`truncate text-[11px] leading-tight font-medium ${
                    isOnline((otherPerson as any)?.last_seen)
                      ? 'text-green-500'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {formatLastSeen((otherPerson as any)?.last_seen)}
                  </p>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0 rounded-full">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl">
                  <DropdownMenuItem onClick={handleViewProfile}>
                    <User className="mr-2 h-4 w-4" />
                    View Profile
                  </DropdownMenuItem>
                  {thread.job_id && (
                    <DropdownMenuItem onClick={handleViewJob}>
                      <Briefcase className="mr-2 h-4 w-4" />
                      View Job
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setBlockModalOpen(true)} className="text-red-600">
                    <UserX className="mr-2 h-4 w-4" />
                    {t('block.blockUser')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full w-full min-h-0">
            <aside className="hidden w-60 flex-shrink-0 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 xl:flex xl:flex-col">
              <div className="p-5">
                <h3 className="mb-5 text-lg font-semibold dark:text-white">Contact Info</h3>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-12 w-12 shadow-sm">
                        <AvatarImage src={(otherPerson as any)?.avatar_url || undefined} alt={otherPerson?.name} />
                        <AvatarFallback className="bg-orange-500 text-white">
                          {otherPerson?.name?.charAt(0).toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      {(otherPerson as any)?.account_type === 'professional' && (
                        <div className="absolute -bottom-1 -right-1 rounded-full bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 p-1 shadow-lg ring-2 ring-white dark:ring-gray-900">
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">{otherPerson?.name}</p>
                        {(otherPerson as any)?.account_type === 'professional' && (
                          <Badge className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 px-2 py-0.5 text-xs font-bold text-white shadow-md">
                            PRO
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-sm text-gray-500 dark:text-gray-400">{otherPerson?.email}</p>
                    </div>
                  </div>


                  <Button variant="outline" className="w-full rounded-full" onClick={handleViewProfile}>
                    View Full Profile
                  </Button>
                </div>
              </div>
            </aside>

            <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#f3f4f6_100%)] dark:bg-[linear-gradient(180deg,#0f172a_0%,#020617_100%)]">
              {error && (
                <Alert variant="destructive" className="m-4 flex-shrink-0 rounded-2xl">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center">
                    <div className="rounded-3xl border border-gray-200 bg-white px-8 py-10 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                      <MessageSquare className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                      <p className="font-medium text-foreground">No messages yet</p>
                      <p className="text-sm text-muted-foreground">Start the conversation!</p>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto w-full max-w-5xl space-y-1">
                    {(() => {
                      // ID of the last message sent by current user (for seen/delivered label)
                      const ownMessages = messages.filter(m => m.sender_id === user?.id && !m.is_deleted && !m.is_system);
                      const lastOwnMsg = ownMessages[ownMessages.length - 1];
                      const lastOwnMessageId = lastOwnMsg?.id ?? null;
                      // Has any own message been seen?
                      const anySeenAfterLast = lastOwnMsg?.seen_at != null;
                      // Has the last own message been delivered?
                      const lastDelivered = lastOwnMsg?.delivered_at != null;

                      return messages.map((message) => {
                      const isOwn = message.sender_id === user?.id;
                      const isDeleted = message.is_deleted;
                      const isSystem = message.is_system;
                      const isOffer = message.message_type === 'offer' && message.offer;

                      if (isSystem) {
                        const translatedText = message.system_message_type
                          ? getSystemMessageText(message.system_message_type as SystemMessageType, language)
                          : null;
                        const displayText = translatedText || message.text;

                        return (
                          <div key={message.id} className="my-6 flex justify-center">
                            <div className="max-w-md rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-center text-sm text-blue-700 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
                              <TwemojiText text={displayText} />
                            </div>
                          </div>
                        );
                      }

                      if (isOffer && message.offer && user) {
                        return (
                          <div key={message.id} className="my-4 flex justify-center">
                            <div className="w-full max-w-md">
                              <OfferCard
                                offer={message.offer}
                                currentUserId={user.id}
                                onStatusChange={() => {
                                  fetchMessages();
                                }}
                              />
                              {isOwn && (
                                <div className="mt-1 flex justify-end">
                                  <button
                                    onClick={() => handleDeleteMessage(message.id)}
                                    className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      if (message.message_type === 'application') {
                        try {
                          const appData = {
                            ...JSON.parse(message.text),
                            applicantId: message.sender_id,
                            threadId: threadId,
                          };
                          return (
                            <div
                              key={message.id}
                              className={`my-3 flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                            >
                              <ApplicationMessageCard
                                data={appData}
                                createdAt={message.created_at}
                                currentUserId={user?.id}
                              />
                              {isOwn && (
                                <button
                                  onClick={() => handleDeleteMessage(message.id)}
                                  className="mt-1 flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          );
                        } catch {
                          // fallthrough to normal text rendering
                        }
                      }

                      // --- message type helpers ---
                      const realText = (!isDeleted && message.text && message.text !== '(Attachment)') ? message.text : '';
                      const imageAttachments = message.attachments?.filter(a => getFileType(a.file_type) === 'image') ?? [];
                      const videoAttachments = message.attachments?.filter(a => getFileType(a.file_type) === 'video') ?? [];
                      const docAttachments = message.attachments?.filter(a => getFileType(a.file_type) === 'document') ?? [];
                      const hasMedia = imageAttachments.length > 0 || videoAttachments.length > 0;
                      const hasDocs = docAttachments.length > 0;

                      const isEmojiOnly = !hasMedia && !hasDocs && realText.length > 0 &&
                        /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+$/u.test(realText) &&
                        realText.replace(/\s/g, '').length > 0;

                      // media-only: has media/docs, no real text
                      const isMediaOnly = (hasMedia || hasDocs) && !realText;

                      // timestamp + read receipt row (reused below)
                      const isLastOwn = isOwn && message.id === lastOwnMessageId;
                      const MetaRow = () => (
                        <div className={`mt-1 flex items-center gap-1 px-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <p className="text-[11px] text-gray-500 opacity-70 dark:text-gray-400">
                            {new Date(message.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {isOwn && !isDeleted && isLastOwn && (
                            anySeenAfterLast ? (
                              <span className="flex items-center gap-0.5 text-[11px] text-blue-500 font-medium">
                                <CheckCheck className="h-3.5 w-3.5" />
                                {t('messages.status.seen')}
                              </span>
                            ) : lastDelivered ? (
                              <span className="flex items-center gap-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                                <CheckCheck className="h-3.5 w-3.5" />
                                {t('messages.status.delivered')}
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                                <Check className="h-3.5 w-3.5" />
                                {t('messages.status.sent')}
                              </span>
                            )
                          )}
                          {isOwn && !isDeleted && !isLastOwn && (
                            <span className="flex-shrink-0 text-gray-400 dark:text-gray-500">
                              {message.seen_at
                                ? <CheckCheck className="h-3 w-3 text-blue-500" />
                                : message.delivered_at
                                  ? <CheckCheck className="h-3 w-3" />
                                  : <Check className="h-3 w-3" />
                              }
                            </span>
                          )}
                        </div>
                      );

                      return (
                        <div
                          key={message.id}
                          className={`group mb-4 flex ${isOwn ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}
                        >
                          <div className="flex max-w-[95%] items-end gap-2 sm:max-w-[82%] lg:max-w-[72%] xl:max-w-[68%]">
                            {!isOwn && (
                              <Avatar className="h-8 w-8 flex-shrink-0 shadow-sm cursor-pointer" onClick={handleViewProfile}>
                                <AvatarImage src={(otherPerson as any)?.avatar_url || undefined} alt={message.sender?.name} />
                                <AvatarFallback className="bg-gray-300 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-100">
                                  {message.sender?.name?.charAt(0).toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                            )}

                            <div className="flex-1">

                              {/* ── DELETED ── */}
                              {isDeleted && (
                                <>
                                  <div className="rounded-[22px] border border-gray-200 bg-gray-100 px-4 py-3 italic text-gray-400 dark:border-gray-700 dark:bg-gray-800">
                                    <p className="text-sm">Message deleted</p>
                                  </div>
                                  <MetaRow />
                                </>
                              )}

                              {/* ── EMOJI ONLY ── */}
                              {!isDeleted && isEmojiOnly && (
                                <>
                                  <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                    <p className="text-3xl leading-tight select-none">
                                      <TwemojiText text={realText} />
                                    </p>
                                  </div>
                                  <MetaRow />
                                </>
                              )}

                              {/* ── MEDIA / DOCS (no text) ── */}
                              {!isDeleted && !isEmojiOnly && isMediaOnly && (
                                <>
                                  <div className="space-y-1.5">
                                    {imageAttachments.map(att => (
                                      <ImageMessage key={att.id} url={att.file_url} name={att.file_name} />
                                    ))}
                                    {videoAttachments.map(att => (
                                      <VideoMessage key={att.id} url={att.file_url} mimeType={att.file_type} />
                                    ))}
                                    {docAttachments.map(att => (
                                      <a key={att.id} href={att.file_url} download={att.file_name}
                                        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 transition-colors hover:bg-slate-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                                        style={{ maxWidth: 280 }}
                                      >
                                        <FileIcon className="h-4 w-4 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-sm font-medium">{att.file_name}</p>
                                          <p className="text-xs text-muted-foreground">{formatFileSize(att.file_size)}</p>
                                        </div>
                                      </a>
                                    ))}
                                  </div>
                                  <MetaRow />
                                </>
                              )}

                              {/* ── TEXT (with optional media) ── */}
                              {!isDeleted && !isEmojiOnly && !isMediaOnly && (
                                <>
                                  {/* media above text bubble, same sizing */}
                                  {hasMedia && (
                                    <div className="mb-1.5 space-y-1.5">
                                      {imageAttachments.map(att => (
                                        <ImageMessage key={att.id} url={att.file_url} name={att.file_name} />
                                      ))}
                                      {videoAttachments.map(att => (
                                        <VideoMessage key={att.id} url={att.file_url} mimeType={att.file_type} />
                                      ))}
                                    </div>
                                  )}

                                  {/* text bubble */}
                                  {realText && (
                                    <div className={`rounded-[22px] px-4 py-3 shadow-sm ${
                                      isOwn
                                        ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md'
                                        : 'border border-gray-200/80 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
                                    }`}>
                                      <p className="break-words whitespace-pre-wrap text-[15px] leading-relaxed">
                                        <MessageText
                                          text={realText}
                                          linkClassName={isOwn
                                            ? 'underline text-white/90 break-all'
                                            : 'underline text-blue-500 dark:text-blue-400 break-all'
                                          }
                                        />
                                      </p>
                                    </div>
                                  )}

                                  {/* docs in bubble style */}
                                  {hasDocs && (
                                    <div className="mt-1.5 space-y-1.5">
                                      {docAttachments.map(att => (
                                        <a key={att.id} href={att.file_url} download={att.file_name}
                                          className={`flex items-center gap-2 rounded-2xl border p-3 transition-colors ${
                                            isOwn
                                              ? 'border-white/20 bg-orange-500 text-white hover:bg-orange-600'
                                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-gray-700 dark:bg-gray-800'
                                          }`}
                                        >
                                          <FileIcon className="h-4 w-4 flex-shrink-0" />
                                          <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">{att.file_name}</p>
                                            <p className={`text-xs ${isOwn ? 'text-white/75' : 'text-muted-foreground'}`}>{formatFileSize(att.file_size)}</p>
                                          </div>
                                        </a>
                                      ))}
                                    </div>
                                  )}

                                  <MetaRow />
                                </>
                              )}

                            </div>

                            {isOwn && !isDeleted && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 flex-shrink-0 rounded-full opacity-30 transition-all sm:opacity-0 sm:group-hover:opacity-100 hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30"
                                onClick={() => handleDeleteMessage(message.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-600" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    }); // end messages.map
                    })()}

                    {/* Typing indicator */}
                    {otherUserTyping && (
                      <div className="flex items-end gap-2 mb-4 animate-in fade-in duration-200">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={(otherPerson as any)?.avatar_url || undefined} />
                          <AvatarFallback className="bg-gray-300 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-100">
                            {otherPerson?.name?.charAt(0).toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="rounded-[22px] border border-gray-200/80 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                          <div className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                            <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                            <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <div className="flex-shrink-0 border-t border-gray-200/80 bg-white/90 px-3 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 sm:px-5 sm:py-4 lg:px-8">
                <div className="mx-auto w-full max-w-5xl">
                  {selectedFiles.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {selectedFiles.map((file, index) => {
                        const fileType = getFileType(file.type);

                        return (
                          <div
                            key={index}
                            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 dark:border-gray-700 dark:bg-gray-800"
                          >
                            {fileType === 'image' && (
                              <img
                                src={URL.createObjectURL(file)}
                                alt={file.name}
                                className="h-10 w-10 rounded-xl object-cover"
                              />
                            )}

                            {fileType !== 'image' && <FileIcon className="h-5 w-5 text-muted-foreground" />}

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{file.name}</p>
                              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFile(index)}
                              disabled={uploading}
                              className="h-8 w-8 flex-shrink-0 rounded-full"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}

                      {uploading && (
                        <div className="space-y-1 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Uploading... {Math.round(uploadProgress)}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-gray-700">
                            <div
                              className="h-2 rounded-full bg-orange-500 transition-all"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <Separator className="mt-3" />
                    </div>
                  )}

                  <form
                    onSubmit={handleSendMessage}
                    className="flex items-center gap-2 rounded-full border border-gray-200/80 bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:border-gray-700 dark:bg-gray-800"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending}
                      className="h-11 w-11 flex-shrink-0 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Paperclip className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                    </Button>

                    <EmojiPicker onEmojiSelect={handleEmojiSelect} recentEmojis={recentEmojis} disabled={sending} />

                    <div className="relative flex-1">
                      <Input
                        ref={messageInputRef}
                        value={newMessage}
                        onChange={handleInputChange}
                        onClick={handleInputClick}
                        onKeyUp={handleInputClick}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e as any);
                          }
                        }}
                        placeholder="Type a message..."
                        disabled={sending}
                        className="rounded-full border-0 bg-transparent py-6 pr-14 text-[15px] shadow-none"
                      />

                      <Button
                        type="submit"
                        disabled={sending || (!newMessage.trim() && selectedFiles.length === 0)}
                        size="icon"
                        className="absolute right-1.5 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 transition-all hover:scale-105 active:scale-95"
                      >
                        {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </main>

            <aside className="hidden w-[280px] flex-shrink-0 border-l border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 xl:block">
              <div className="h-full overflow-y-auto p-5">
                {thread.thread_type === 'job' && (
                  <Card className="rounded-3xl border-0 shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-lg">
                        <span>Job Details</span>
                        {thread.job?.status === 'completed' && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Completed
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>

                    <CardContent>
                      {thread.job ? (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <h3 className="font-semibold">{thread.job.title}</h3>
                            <p className="line-clamp-3 text-sm text-muted-foreground">
                              {thread.job.description}
                            </p>
                          </div>

                          {isCustomer &&
                            thread.job.status !== 'completed' &&
                            thread.job.completion_requested &&
                            !thread.job.completion_request_dismissed_at && (
                              <Alert className="border-blue-200 bg-blue-50">
                                <AlertCircle className="h-4 w-4 text-blue-600" />
                                <AlertTitle className="text-blue-900">Pro requested completion</AlertTitle>
                                <AlertDescription className="text-sm text-blue-800">
                                  The Pro has indicated the job is complete. Please review and confirm.
                                </AlertDescription>

                                <div className="mt-3 flex gap-2">
                                  <Button
                                    onClick={handleMarkAsCompleted}
                                    disabled={markingCompleted || dismissingRequest}
                                    size="sm"
                                    className="flex-1"
                                  >
                                    {markingCompleted ? (
                                      <>
                                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                        Confirming...
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="mr-2 h-3 w-3" />
                                        Confirm completion
                                      </>
                                    )}
                                  </Button>

                                  <Button
                                    onClick={handleDismissCompletionRequest}
                                    disabled={markingCompleted || dismissingRequest}
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                  >
                                    {dismissingRequest ? (
                                      <>
                                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                        Declining...
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="mr-2 h-3 w-3" />
                                        Not completed yet
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </Alert>
                            )}

                          {isCustomer &&
                            thread.job.status !== 'completed' &&
                            (!thread.job.completion_requested || thread.job.completion_request_dismissed_at) && (
                              <Button
                                onClick={handleMarkAsCompleted}
                                disabled={markingCompleted}
                                className="w-full rounded-full"
                                variant="default"
                              >
                                {markingCompleted ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Marking as completed...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Mark as completed
                                  </>
                                )}
                              </Button>
                            )}

                          {!isCustomer && thread.job.status !== 'completed' && !thread.job.completion_requested && (
                            <Button
                              onClick={handleRequestCompletion}
                              disabled={requestingCompletion}
                              className="w-full rounded-full"
                              variant="default"
                            >
                              {requestingCompletion ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Requesting...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Request completion
                                </>
                              )}
                            </Button>
                          )}

                          {!isCustomer && thread.job.status !== 'completed' && thread.job.completion_requested && (
                            <div className="space-y-2">
                              <Alert className="border-blue-200 bg-blue-50">
                                <AlertCircle className="h-4 w-4 text-blue-600" />
                                <AlertTitle className="text-blue-900">Completion requested</AlertTitle>
                                <AlertDescription className="text-sm text-blue-800">
                                  Waiting for customer to confirm job completion.
                                </AlertDescription>
                              </Alert>

                              <Button
                                onClick={handleCancelCompletionRequest}
                                disabled={cancelingRequest}
                                className="w-full rounded-full"
                                variant="outline"
                              >
                                {cancelingRequest ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Canceling...
                                  </>
                                ) : (
                                  <>
                                    <X className="mr-2 h-4 w-4" />
                                    Cancel completion request
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No job details available</p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {thread && thread.pro && thread.job && (
        <ReviewModal
          open={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          jobId={thread.job.id}
          proId={thread.pro_id}
          proName={thread.pro.name}
          threadId={threadId}
          onSuccess={async () => {
            await fetchMessages();
            await (supabase as any).rpc('update_pro_rating', { target_pro_id: thread.pro_id });
            toast.success('Review submitted successfully!');
          }}
        />
      )}

      {thread && otherPerson && (
        <BlockUserModal
          open={blockModalOpen}
          onOpenChange={setBlockModalOpen}
          userId={isCustomer ? thread.pro_id : thread.customer_id}
          userName={otherPerson.name}
          onBlockSuccess={() => {
            router.push('/messages');
          }}
        />
      )}
    </>
  );
}

export default function MessagesPage() {
  return (
    <ProtectedRoute>
      <MessagesContent />
    </ProtectedRoute>
  );
}
