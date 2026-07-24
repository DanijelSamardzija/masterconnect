'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const isMessageThread = pathname.startsWith('/messages/');
  const isMessagesPage = pathname === '/messages';
  const isFeedPage = pathname === '/feed';
  const isJoinPage = pathname === '/join';
  const isOnboardingPage = pathname === '/onboarding';
  const isAuthPage = pathname?.startsWith('/auth') || pathname === '/login';
  const isAdultPage = pathname?.startsWith('/adult');

  const hideNavigation = isMessageThread || isJoinPage || isOnboardingPage || isAuthPage || isAdultPage;
  const hideFooter = isMessagesPage || isMessageThread || isFeedPage || isJoinPage || isOnboardingPage || isAuthPage || isAdultPage;

  useEffect(() => {
    if (!loading && user && profile && profile.onboarding_completed === false && !isOnboardingPage) {
      router.replace('/onboarding');
    }
  }, [loading, user, profile, isOnboardingPage]);

  useEffect(() => {
    if (!loading && user && profile && profile.onboarding_completed && !profile.city) {
      supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'no_city_reminder')
        .maybeSingle()
        .then(({ data }) => {
          if (!data) {
            supabase.from('notifications').insert({
              user_id: user.id,
              type: 'no_city_reminder',
              title: 'Dodaj grad na profil 📍',
              body: 'Klijenti iz tvog mesta lakše te pronalaze kada dodaš grad. Dodaj ga za 10 sekundi!',
              meta: { link: '/profile/edit' },
            });
          }
        });
    }
  }, [loading, user, profile]);

  return (
    <>
      {!hideNavigation && <Navigation />}

      <main id="main-content" className="flex-1 min-h-0 overflow-hidden">
        {children}
      </main>

      {!hideFooter && <Footer />}
    </>
  );
}