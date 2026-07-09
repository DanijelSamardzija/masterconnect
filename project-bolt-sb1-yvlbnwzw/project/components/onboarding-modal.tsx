'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';

export function OnboardingModal() {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.id || profile.city) return;
    const key = `location_notified_${profile.id}`;
    if (localStorage.getItem(key)) return;

    const run = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', profile.id)
        .eq('action_type', 'missing_location')
        .limit(1);
      if (data && data.length > 0) {
        localStorage.setItem(key, '1');
        return;
      }
      await supabase.from('notifications').insert({
        user_id: profile.id,
        type: 'system',
        action_type: 'missing_location',
        title: 'Dodaj svoju lokaciju',
        body: 'Nismo pronašli tvoj grad. Dodaj lokaciju da bi ti dolazili oglasi i korisnici iz tvog regiona.',
        meta: { link_url: '/profile/edit' },
      });
      localStorage.setItem(key, '1');
    };

    run();
  }, [profile?.id, profile?.city]);

  return null;
}
