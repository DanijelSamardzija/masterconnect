'use client';

import { usePathname } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isMessageThread = pathname.startsWith('/messages/');
  const isMessagesPage = pathname === '/messages';

  const hideNavigation = isMessageThread;
  const hideFooter = isMessagesPage || isMessageThread;

  return (
    <>
      {!hideNavigation && <Navigation />}

      <main className={isMessageThread ? 'flex-1 h-full overflow-hidden' : 'flex-1 min-h-0 overflow-hidden'}>
        {children}
      </main>

      {!hideFooter && <Footer />}
    </>
  );
}