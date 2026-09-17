'use client';

import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { Calendar, Clock, ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export type StaffBookingTab = 'bookings' | 'schedule' | 'hours';

const NAV_ITEMS: { tab: StaffBookingTab; href: string; labelKey: string; icon: ReactNode }[] = [
  { tab: 'bookings', href: '/dashboard/staff/bookings', labelKey: 'staffDashboard.title',      icon: <Calendar className="h-3.5 w-3.5" /> },
  { tab: 'schedule', href: '/dashboard/staff/schedule', labelKey: 'schedule.staffView.title',  icon: <Calendar className="h-3.5 w-3.5" /> },
];

export function StaffBookingNav({ active }: { active?: StaffBookingTab }) {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <div className="flex items-start gap-2 mb-4">
      <button
        onClick={() => router.push('/booking')}
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
      </div>
    </div>
  );
}
