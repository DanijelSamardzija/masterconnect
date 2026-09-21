'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';

function WorkerRedirect({
  profileId,
  children,
}: {
  profileId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !profileId) return;
    (supabase as any)
      .from('staff_members')
      .select('role')
      .eq('business_id', profileId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()
      .then(({ data }: { data: { role: string } | null }) => {
        if (data?.role === 'worker') {
          // Workers go to their own dashboard, not the owner dashboard
          const path = window.location.pathname;
          if (!path.includes('/worker')) {
            router.replace(`/booking/trade/${profileId}/worker/jobs`);
          }
        }
      });
  }, [user, profileId, router]);

  return <>{children}</>;
}

export default function TradeProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = use(params);
  return (
    <ProtectedRoute>
      <WorkerRedirect profileId={profileId}>{children}</WorkerRedirect>
    </ProtectedRoute>
  );
}
