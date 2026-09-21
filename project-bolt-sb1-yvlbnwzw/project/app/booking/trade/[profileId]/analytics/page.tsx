'use client';

import { use, useEffect } from 'react';
import { useLanguage } from '@/lib/contexts/language-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeDashboardLayout } from '@/components/trade/TradeDashboardLayout';
import { BarChart3 } from 'lucide-react';

export default function TradeAnalyticsPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = use(params);
  const { t } = useLanguage();
  const { setActiveProfileId } = useBookingProfile();

  useEffect(() => { setActiveProfileId(profileId); }, [profileId, setActiveProfileId]);

  return (
    <TradeDashboardLayout profileId={profileId} active="analytics">
      <h1 className="text-lg font-bold text-foreground mb-4">{t('trade.dashboard.analytics.title')}</h1>
      <div className="text-center py-16 flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
          <BarChart3 className="w-7 h-7 text-purple-600 dark:text-purple-400" />
        </div>
        <p className="text-sm text-muted-foreground">{t('trade.dashboard.analytics.placeholder')}</p>
      </div>
    </TradeDashboardLayout>
  );
}
