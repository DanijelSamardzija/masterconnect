'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

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

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.full_name) {
        router.replace('/feed');
      } else {
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
