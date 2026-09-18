'use client';

import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { Calendar, Settings, ExternalLink, ChevronLeft, BarChart3 } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';
import type { ReactNode } from 'react';

export type BusinessBookingTab = 'bookings' | 'schedule' | 'analytics' | 'setup' | 'absences';

const NAV_ITEMS: { tab: BusinessBookingTab; href: string; labelKey: string; icon: ReactNode }[] = [
  { tab: 'bookings',  href: '/booking/business/bookings',   labelKey: 'ownerBookings.navLabel',           icon: <Calendar   className="h-3.5 w-3.5" /> },
  { tab: 'schedule',  href: '/booking/business/schedule',   labelKey: 'schedule.title',                   icon: <Calendar   className="h-3.5 w-3.5" /> },
  { tab: 'analytics', href: '/booking/business/analytics',  labelKey: 'bookingAnalytics.navLabel',        icon: <BarChart3  className="h-3.5 w-3.5" /> },
  { tab: 'setup',     href: '/booking/business/setup',      labelKey: 'dashboard.business.activeButton',  icon: <Settings  className="h-3.5 w-3.5" /> },
  { tab: 'absences',  href: '/booking/business/absences',   labelKey: 'absences.title',                   icon: <Calendar   className="h-3.5 w-3.5" /> },
];

export function BusinessBookingNav({ active }: { active?: BusinessBookingTab }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { profile } = useAuth();

  return (
    <div className="flex items-start gap-2 mb-4">
      <button
        onClick={() => router.push(active ? '/booking/business' : '/booking')}
        className="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground shrink-0 mt-0.5"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="flex flex-wrap gap-x-1 gap-y-0.5">
        {NAV_ITEMS.map(({ tab, href, labelKey, icon }) => (
          <button
            key={tab}
            onClick={() => router.push(href)}
            className={`flex items-center gap-1.5 text-xs whitespace-nowrap py-2 px-2 rounded-lg transition-colors ${
              active === tab
                ? 'font-semibold text-primary hover:text-primary/80 hover:bg-accent'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            {icon}
            {t(labelKey as Parameters<typeof t>[0])}
          </button>
        ))}
        {profile?.id && (
          <button
            onClick={() => router.push(`/booking/${profile.id}`)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap py-2 px-2 rounded-lg hover:bg-accent transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('dashboard.services.bookingPage')}
          </button>
        )}
      </div>
    </div>
  );
}
