'use client';

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

const PING_INTERVAL = 60 * 1000; // update every 60s

export function usePresence(userId: string | undefined) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const ping = useCallback(async () => {
    if (!userId) return;
    await supabase
      .from('profiles')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    // ping immediately on mount
    ping();

    // ping on interval
    intervalRef.current = setInterval(ping, PING_INTERVAL);

    // ping on user activity (throttled — at most once per 30s)
    let lastActivity = Date.now();
    const handleActivity = () => {
      if (Date.now() - lastActivity > 30_000) {
        lastActivity = Date.now();
        ping();
      }
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [userId, ping]);
}
