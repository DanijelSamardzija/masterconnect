'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { usePushNotifications } from '@/hooks/use-push-notifications';

/**
 * Invisible component — auto-resubscribes on app load if the user previously
 * granted push permission (e.g. after SW update clears the subscription).
 */
export function PushNotificationManager() {
  const { user } = useAuth();
  const { isSupported, permission, isSubscribed, subscribe } = usePushNotifications();

  useEffect(() => {
    if (!user || !isSupported) return;
    if (permission === 'granted' && !isSubscribed) {
      // Silently re-subscribe (no UI prompt needed — permission already granted)
      subscribe();
    }
  }, [user, isSupported, permission, isSubscribed, subscribe]);

  return null;
}
