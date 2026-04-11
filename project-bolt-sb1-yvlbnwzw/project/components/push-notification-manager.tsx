'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { usePushNotifications } from '@/hooks/use-push-notifications';

/**
 * Invisible component — automatically requests push permission on first login.
 * Users can disable push later in Settings.
 */
export function PushNotificationManager() {
  const { user } = useAuth();
  const { isSupported, permission, isSubscribed, subscribe } = usePushNotifications();

  useEffect(() => {
    if (!user || !isSupported) return;

    if (permission === 'granted' && !isSubscribed) {
      // Already granted — silently re-subscribe (e.g. after SW update)
      subscribe();
      return;
    }

    if (permission === 'default') {
      // First time — auto-request permission after short delay so the app loads first
      const storageKey = `push_asked_${user.id}`;
      const alreadyAsked = localStorage.getItem(storageKey);
      if (alreadyAsked) return;

      const timer = setTimeout(() => {
        localStorage.setItem(storageKey, '1');
        subscribe(); // This calls Notification.requestPermission() internally
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [user, isSupported, permission, isSubscribed, subscribe]);

  return null;
}
