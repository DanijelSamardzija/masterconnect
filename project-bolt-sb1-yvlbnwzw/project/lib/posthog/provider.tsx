'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { getPostHog } from '@/lib/posthog/client';

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();

  useEffect(() => {
    getPostHog().then(posthog => {
      posthog.capture('$pageview', { $current_url: window.location.href });
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    getPostHog().then(posthog => {
      if (user && profile) {
        posthog.identify(user.id, {
          email: user.email,
          name: profile.name,
          account_type: profile.account_type,
          city: profile.city,
        });
      } else {
        posthog.reset();
      }
    });
  }, [user, profile]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </>
  );
}
