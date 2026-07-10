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

      // Apply referral + UTM if new user
      if (!profile?.onboarding_completed) {
        const referralCode = localStorage.getItem('referral_code');
        if (referralCode) {
          await (supabase.rpc as any)('apply_referral', {
            p_referred_id: user.id,
            p_referral_code: referralCode,
          });
          localStorage.removeItem('referral_code');
        }
        const utmSource = localStorage.getItem('utm_source');
        if (utmSource) {
          await supabase.from('profiles').update({
            utm_source: utmSource,
            utm_medium: localStorage.getItem('utm_medium') || null,
            utm_campaign: localStorage.getItem('utm_campaign') || null,
          }).eq('id', user.id);
          localStorage.removeItem('utm_source');
          localStorage.removeItem('utm_medium');
          localStorage.removeItem('utm_campaign');
        }
      }

      if (profile?.onboarding_completed) {
        trackEvent('google_login_success', { returning: true });
        router.replace('/feed');
      } else {
        // Auto-detect city/country from IP for new users
        if (!profile?.city) {
          fetch('https://ipapi.co/json/')
            .then(r => r.json())
            .then(geo => {
              if (geo.city) {
                supabase.from('profiles').update({
                  city: geo.city,
                  ...(geo.country_name ? { country: geo.country_name } : {}),
                }).eq('id', user.id);
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
