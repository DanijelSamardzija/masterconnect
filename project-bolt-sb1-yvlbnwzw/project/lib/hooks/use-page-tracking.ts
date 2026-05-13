'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';

export function usePageTracking(page: string) {
  const { user } = useAuth();

  useEffect(() => {
    // Throttle: don't track same page more than once per 5 minutes
    const key = `tracked_${page}_${user?.id ?? 'anon'}`;
    const lastTracked = sessionStorage.getItem(key);
    const now = Date.now();

    if (lastTracked && now - parseInt(lastTracked) < 5 * 60 * 1000) return;

    sessionStorage.setItem(key, String(now));

    supabase.from('page_views').insert({
      user_id: user?.id ?? null,
      page,
    }).then(({ error }) => {
      if (error) console.error('[PageTracking] Error:', error.message);
    });
  }, [user, page]);
}
