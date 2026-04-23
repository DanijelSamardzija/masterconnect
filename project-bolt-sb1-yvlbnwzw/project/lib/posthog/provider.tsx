'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';

const POSTHOG_KEY = 'phc_x3wZDZJh7G4oq8A5LffT2raWGQifq3vHTskZgoiV8yxZ';
const POSTHOG_HOST = 'https://us.i.posthog.com';

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();

  useEffect(() => {
    if (typeof window === 'undefined') return;
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
  useEffect(() => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: 'identified_only',
      capture_pageview: false,
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}
