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
      const lang = (profile.preferred_language as string) || 'sr';
      const missingLocationText: Record<string, { title: string; body: string }> = {
        en: { title: 'Add your location', body: "We couldn't find your city. Add your location to receive listings from your region." },
        de: { title: 'Fügen Sie Ihren Standort hinzu', body: 'Wir konnten Ihre Stadt nicht finden. Fügen Sie Ihren Standort hinzu, um Anzeigen aus Ihrer Region zu erhalten.' },
        es: { title: 'Añade tu ubicación', body: 'No pudimos encontrar tu ciudad. Añade tu ubicación para recibir anuncios de tu región.' },
        fr: { title: 'Ajoutez votre emplacement', body: "Nous n'avons pas pu trouver votre ville. Ajoutez votre emplacement pour recevoir des annonces de votre région." },
        sr: { title: 'Dodaj svoju lokaciju', body: 'Nismo pronašli tvoj grad. Dodaj lokaciju da bi ti dolazili oglasi i korisnici iz tvog regiona.' },
      };
      const text = missingLocationText[lang] ?? missingLocationText.sr;
      await notificationRepository.insert({
        user_id: profile.id,
        type: 'system',
        action_type: 'missing_location',
        title: text.title,
        body: text.body,
        meta: { link_url: '/profile/edit' },
      });
      localStorage.setItem(key, '1');
    };

    run();
  }, [profile?.id, profile?.city]);

  return null;
}
