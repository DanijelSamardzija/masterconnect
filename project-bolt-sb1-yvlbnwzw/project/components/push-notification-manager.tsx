'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { usePushNotifications } from '@/lib/hooks/use-push-notifications';

// Invisible component — re-subscribes silently if the user already granted permission
// (e.g. after a service worker update). Does NOT auto-request permission on new users.
// Call subscribe() manually from a contextual trigger (first message, first post, bell icon).
export function PushNotificationManager() {
  const { user } = useAuth();
  const { isSupported, permission, isSubscribed, subscribe } = usePushNotifications();

  useEffect(() => {
    if (!user || !isSupported) return;
    if (permission === 'granted' && !isSubscribed) subscribe();
  }, [user, isSupported, permission, isSubscribed, subscribe]);

  return null;
}
