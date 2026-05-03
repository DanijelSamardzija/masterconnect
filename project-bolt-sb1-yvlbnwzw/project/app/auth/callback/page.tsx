'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { trackEvent, identifyUser, aliasPreOAuthSession } from '@/lib/analytics';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');

    if (!code) {
      router.replace('/login');
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(async ({ error }) => {
      if (error) {
        router.replace('/login?error=auth');
        return;
      }

      // Check if profile already has a name (returning user or complete profile)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      // Identify user and alias pre-OAuth anonymous session so PostHog funnel connects
      identifyUser(user.id, user.email);
      aliasPreOAuthSession();

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed, city')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.onboarding_completed) {
        trackEvent('google_login_success', { returning: true });
        router.replace('/feed');
      } else {
        // Auto-detect city/country from IP for new users
        if (!profile?.city) {
          fetch('https://ip-api.com/json/?fields=city,country,countryCode')
            .then(r => r.json())
            .then(geo => {
              if (geo.city) {
                supabase.from('profiles').update({ city: geo.city }).eq('id', user.id);
              }
            })
            .catch(() => {});
        }

        trackEvent('google_login_success', { returning: false });
        router.replace('/onboarding');
      }
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
    </div>
  );
}
