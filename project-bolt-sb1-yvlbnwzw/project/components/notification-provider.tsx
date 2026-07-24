'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { notificationRepository } from '@/lib/repositories/notificationRepository';
import { useNotificationSound } from '@/lib/hooks/use-notification-sound';
import { useSoundPreference } from '@/lib/hooks/use-sound-preference';
import { toast } from 'sonner';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { playNotificationSound, isReady } = useNotificationSound();
  const { notificationsSoundEnabled, messagesSoundEnabled } = useSoundPreference();
  const processedNotificationIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!profile?.id) {
      return;
    }

    let notificationsChannel: any = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    const setupChannel = () => {
      notificationsChannel = notificationRepository
        .createChannel(profile.id, (newNotification) => {

          if (processedNotificationIds.current.has(newNotification.id)) {
            return;
          }
          processedNotificationIds.current.add(newNotification.id);

          const meta = newNotification.meta as Record<string, any> | null;

          const isViewingThread = newNotification.type === 'message' &&
            meta?.thread_id &&
            pathname === `/messages/${meta.thread_id}`;

          const isViewingPost = (newNotification.type === 'comment' || newNotification.type === 'reply' || newNotification.type === 'reaction') &&
            (newNotification.post_id || meta?.post_id) &&
            pathname === `/posts/${newNotification.post_id || meta?.post_id}`;

          if (!isViewingThread && !isViewingPost) {
            const isMessageNotification = newNotification.type === 'message';
            const shouldPlaySound = isReady && (isMessageNotification ? messagesSoundEnabled : notificationsSoundEnabled);

            if (shouldPlaySound) {
              playNotificationSound();
            }

            const getToastAction = () => {
              if (newNotification.type === 'message' && meta?.thread_id) {
                return {
                  label: 'Open chat',
                  onClick: () => {
                    router.push(`/messages/${meta.thread_id}`);
                    notificationRepository.markRead(newNotification.id);
                  }
                };
              } else if (newNotification.type === 'comment' || newNotification.type === 'reply' || newNotification.type === 'reaction') {
                const postId = newNotification.post_id || meta?.post_id;
                if (postId) {
                  return {
                    label: 'View post',
                    onClick: () => {
                      const url = `/posts/${postId}${meta?.comment_id ? `?commentId=${meta.comment_id}` : ''}`;
                      router.push(url);
                      notificationRepository.markRead(newNotification.id);
                    }
                  };
                }
              } else if (newNotification.type === 'review') {
                return {
                  label: 'View review',
                  onClick: () => {
                    router.push('/dashboard');
                    notificationRepository.markRead(newNotification.id);
                  }
                };
              } else if (newNotification.type === 'follow' && meta?.follower_id) {
                return {
                  label: 'View profile',
                  onClick: () => {
                    router.push(`/profile/${meta.follower_id}`);
                    notificationRepository.markRead(newNotification.id);
                  }
                };
              } else if (meta?.job_id) {
                return {
                  label: 'View job',
                  onClick: () => {
                    router.push(`/jobs/${meta.job_id}`);
                    notificationRepository.markRead(newNotification.id);
                  }
                };
              }
              return undefined;
            };

            toast(newNotification.title, {
              description: newNotification.body,
              duration: 4000,
              action: getToastAction()
            });

            window.dispatchEvent(new Event('unreadCountChanged'));
          }
        }
        )
        .subscribe((status: any) => {
          if (status === 'CHANNEL_ERROR') {
            if (retryTimeout) clearTimeout(retryTimeout);
            retryTimeout = setTimeout(() => {
              if (notificationsChannel) {
                notificationsChannel.unsubscribe();
                supabase.removeChannel(notificationsChannel);
              }
              setupChannel();
            }, 2000);
          } else if (status === 'TIMED_OUT') {
            if (retryTimeout) clearTimeout(retryTimeout);
            retryTimeout = setTimeout(() => {
              if (notificationsChannel) {
                notificationsChannel.unsubscribe();
                supabase.removeChannel(notificationsChannel);
              }
              setupChannel();
            }, 2000);
          }
        });
    };

    setupChannel();

    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (notificationsChannel) {
        notificationsChannel.unsubscribe();
        supabase.removeChannel(notificationsChannel);
      }
    };
  }, [profile?.id, pathname, isReady, notificationsSoundEnabled, messagesSoundEnabled, playNotificationSound, router]);

  return <>{children}</>;
}
