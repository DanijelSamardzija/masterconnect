'use client';

import { usePathname } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isMessageThread = pathname.startsWith('/messages/');
  const isMessagesPage = pathname === '/messages';
  const isFeedPage = pathname === '/feed';
  const isJoinPage = pathname === '/join';
  const isOnboardingPage = pathname === '/onboarding';
  const isAuthPage = pathname?.startsWith('/auth') || pathname === '/login';

  const hideNavigation = isMessageThread || isJoinPage || isOnboardingPage || isAuthPage;
  const hideFooter = isMessagesPage || isMessageThread || isFeedPage || isJoinPage || isOnboardingPage || isAuthPage;

  return (
    <>
      {!hideNavigation && <Navigation />}

      <main className="flex-1 min-h-0 overflow-hidden">
        {children}
      </main>

      {!hideFooter && <Footer />}
    </>
  );
}