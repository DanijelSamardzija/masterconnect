'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { useAuth } from '@/lib/contexts/auth-context';
import { notificationRepository } from '@/lib/repositories/notificationRepository';
import { usePageTracking } from '@/lib/hooks/use-page-tracking';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  usePageTracking('app');

  const isMessageThread = pathname.startsWith('/messages/');
  const isMessagesPage = pathname === '/messages';
  const isFeedPage = pathname === '/feed';
  const isJoinPage = pathname === '/join';
  const isOnboardingPage = pathname === '/onboarding';
  const isAuthPage = pathname?.startsWith('/auth') || pathname === '/login';
  const isAdultPage = pathname === '/adult' || pathname?.startsWith('/adult/');

  const hideNavigation = isMessageThread || isJoinPage || isOnboardingPage || isAuthPage || isAdultPage;
  const hideFooter = isMessagesPage || isMessageThread || isFeedPage || isJoinPage || isOnboardingPage || isAuthPage || isAdultPage;

  useEffect(() => {
    if (!loading && user && profile && profile.onboarding_completed === false && !isOnboardingPage) {
      router.replace('/onboarding');
    }
  }, [loading, user, profile, isOnboardingPage]);

  useEffect(() => {
    if (!loading && user && profile && profile.onboarding_completed && !profile.city) {
      notificationRepository.existsByType(user.id, 'no_city_reminder').then(exists => {
        if (!exists) {
          const lang = (profile.preferred_language as string) || 'sr';
          const cityReminderText: Record<string, { title: string; body: string }> = {
            en: { title: 'Add your city to your profile 📍', body: 'Clients in your area find you more easily when you add your city. Takes 10 seconds!' },
            de: { title: 'Füge deine Stadt zum Profil hinzu 📍', body: 'Kunden in deiner Nähe finden dich leichter, wenn du deine Stadt angibst. Dauert nur 10 Sekunden!' },
            es: { title: 'Añade tu ciudad al perfil 📍', body: 'Los clientes de tu zona te encuentran más fácilmente si añades tu ciudad. ¡Solo 10 segundos!' },
            fr: { title: 'Ajoutez votre ville à votre profil 📍', body: 'Les clients de votre région vous trouvent plus facilement si vous ajoutez votre ville. Seulement 10 secondes !' },
            sr: { title: 'Dodaj grad na profil 📍', body: 'Klijenti iz tvog mesta lakše te pronalaze kada dodaš grad. Dodaj ga za 10 sekundi!' },
          };
          const text = cityReminderText[lang] ?? cityReminderText.sr;
          notificationRepository.insert({
            user_id: user.id,
            type: 'no_city_reminder',
            action_type: 'no_city_reminder',
            title: text.title,
            body: text.body,
            meta: { link: '/profile/edit' },
          });
        }
      });
    }
  }, [loading, user, profile]);

  return (
    <>
      {!hideNavigation && <AnnouncementBanner />}
      {!hideNavigation && <Navigation />}

      <main id="main-content" className="flex-1 min-h-0 overflow-hidden">
        {children}
      </main>

      {!hideFooter && <Footer />}
    </>
  );
}