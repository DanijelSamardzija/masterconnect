'use client';

import { use, useEffect } from 'react';
import { useLanguage } from '@/lib/contexts/language-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeDashboardLayout } from '@/components/trade/TradeDashboardLayout';
import { Briefcase } from 'lucide-react';

export default function TradeJobsPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = use(params);
  const { t } = useLanguage();
  const { setActiveProfileId } = useBookingProfile();

  useEffect(() => { setActiveProfileId(profileId); }, [profileId, setActiveProfileId]);

  return (
    <TradeDashboardLayout profileId={profileId} active="jobs">
      <h1 className="text-lg font-bold text-foreground mb-4">{t('trade.dashboard.jobs.title')}</h1>
      <div className="text-center py-16 flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
          <Briefcase className="w-7 h-7 text-blue-600 dark:text-blue-400" />
        </div>
        <p className="text-sm text-muted-foreground">{t('trade.dashboard.jobs.placeholder')}</p>
      </div>
    </TradeDashboardLayout>
  );
}
