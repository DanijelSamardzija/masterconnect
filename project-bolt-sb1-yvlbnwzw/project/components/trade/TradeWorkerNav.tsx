'use client';

import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { Briefcase, Zap, ChevronLeft } from 'lucide-react';

export type TradeWorkerTab = 'jobs' | 'emergency';

export function TradeWorkerNav({
  profileId,
  active,
}: {
  profileId: string;
  active?: TradeWorkerTab;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [canHandleEmergency, setCanHandleEmergency] = useState(false);

  useEffect(() => {
    if (!user || !profileId) return;
    (supabase as any)
      .from('staff_members')
      .select('permissions, role')
      .eq('business_id', profileId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()
      .then(({ data }: { data: { permissions: Record<string, boolean>; role: string } | null }) => {
        if (!data) return;
        setCanHandleEmergency(
          data.role === 'owner' ||
            data.role === 'manager' ||
            !!data.permissions?.can_handle_emergency ||
            !!data.permissions?.can_accept_emergency,
        );
      });
  }, [user, profileId]);

  const base = `/booking/trade/${profileId}/worker`;

  return (
    <div className="flex items-start gap-2 mb-4">
      <button
        onClick={() => router.push('/booking')}
        className="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground shrink-0 mt-0.5"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="flex flex-wrap gap-x-1 gap-y-0.5">
        <button
          onClick={() => router.push(`${base}/jobs`)}
          className={`flex items-center gap-1.5 text-xs whitespace-nowrap py-2 px-2 rounded-lg transition-colors ${
            active === 'jobs'
              ? 'font-semibold text-primary hover:text-primary/80 hover:bg-accent'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <Briefcase className="h-3.5 w-3.5" />
          {t('trade.worker.myJobs')}
        </button>
        {canHandleEmergency && (
          <button
            onClick={() => router.push(`${base}/emergency`)}
            className={`flex items-center gap-1.5 text-xs whitespace-nowrap py-2 px-2 rounded-lg transition-colors ${
              active === 'emergency'
                ? 'font-semibold text-primary hover:text-primary/80 hover:bg-accent'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            {t('trade.worker.myEmergencies')}
          </button>
        )}
      </div>
    </div>
  );
}
