'use client';

import { Suspense, useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';

if (typeof window !== 'undefined') {
  posthog.init('phc_x3wZDZJh7G4oq8A5LffT2raWGQifq3vHTskZgoiV8yxZ', {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false,
  });
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();

  useEffect(() => {
    posthog.capture('$pageview', { $current_url: window.location.href });
  }, [pathname, searchParams]);

  useEffect(() => {
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
  }, [user, profile]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
