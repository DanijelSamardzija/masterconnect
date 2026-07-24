'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { usePushNotifications } from '@/lib/hooks/use-push-notifications';

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
      const askedKey = `push_asked_${user.id}`;
      const visitKey = `push_visit_${user.id}`;

      if (localStorage.getItem(askedKey)) return; // Already asked once, don't repeat

      const visitCount = parseInt(localStorage.getItem(visitKey) || '0') + 1;
      localStorage.setItem(visitKey, String(visitCount));

      // Only ask from the 2nd visit onwards — avoids clashing with onboarding + PWA banner
      if (visitCount < 2) return;

      const timer = setTimeout(() => {
        localStorage.setItem(askedKey, '1');
        subscribe();
      }, 5000); // 5s delay so the page is fully settled

      return () => clearTimeout(timer);
    }
  }, [user, isSupported, permission, isSubscribed, subscribe]);

  return null;
}
