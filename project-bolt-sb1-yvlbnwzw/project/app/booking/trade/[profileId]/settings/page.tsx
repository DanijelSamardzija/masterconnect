'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeDashboardLayout } from '@/components/trade/TradeDashboardLayout';
import { Settings, ChevronRight } from 'lucide-react';

export default function TradeSettingsPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = use(params);
  const { t } = useLanguage();
  const router = useRouter();
  const { setActiveProfileId } = useBookingProfile();

  useEffect(() => { setActiveProfileId(profileId); }, [profileId, setActiveProfileId]);

  return (
    <TradeDashboardLayout profileId={profileId} active="settings">
      <h1 className="text-lg font-bold text-foreground mb-4">{t('trade.dashboard.settings.title')}</h1>

      <div className="flex flex-col gap-3">
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-muted shrink-0 mt-0.5">
              <Settings className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground mb-1">{t('trade.dashboard.settings.title')}</p>
              <p className="text-xs text-muted-foreground mb-3">{t('trade.dashboard.settings.desc')}</p>
              <button
                onClick={() => router.push('/booking/business/setup')}
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {t('trade.dashboard.settings.goToSetup')}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </TradeDashboardLayout>
  );
}
