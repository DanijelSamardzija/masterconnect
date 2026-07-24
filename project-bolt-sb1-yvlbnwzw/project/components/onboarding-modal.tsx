'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { notificationRepository } from '@/lib/repositories/notificationRepository';

export function OnboardingModal() {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.id || profile.city) return;
    const key = `location_notified_${profile.id}`;
    if (localStorage.getItem(key)) return;

    const run = async () => {
      const exists = await notificationRepository.existsByActionType(profile.id, 'missing_location');
      if (exists) {
        localStorage.setItem(key, '1');
        return;
      }
      await notificationRepository.insert({
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
