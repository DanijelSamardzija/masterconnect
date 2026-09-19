'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { Calendar, BarChart3, ChevronLeft, Share2 } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { ServiceSharePicker } from '@/components/booking/service-share-picker';
import type { ReactNode } from 'react';

export type StaffBookingTab = 'bookings' | 'schedule' | 'my-analytics';

const NAV_ITEMS: { tab: StaffBookingTab; href: string; labelKey: string; icon: ReactNode }[] = [
  { tab: 'bookings',     href: '/dashboard/staff/bookings',      labelKey: 'staffDashboard.title',     icon: <Calendar  className="h-3.5 w-3.5" /> },
  { tab: 'schedule',     href: '/dashboard/staff/schedule',      labelKey: 'schedule.staffView.title', icon: <Calendar  className="h-3.5 w-3.5" /> },
  { tab: 'my-analytics', href: '/dashboard/staff/my-analytics',  labelKey: 'myAnalytics.navLabel',     icon: <BarChart3 className="h-3.5 w-3.5" /> },
];

export function StaffBookingNav({ active }: { active?: StaffBookingTab }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [sharePicker, setSharePicker] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('staff_members').select('business_id')
      .eq('user_id', user.id).limit(1).maybeSingle()
      .then(({ data }) => { if (data?.business_id) setBusinessId(data.business_id); });
  }, [user?.id]);

  return (
    <>
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
          {businessId && (
            <button
              onClick={() => setSharePicker(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap py-2 px-2 rounded-lg hover:bg-accent transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" />
              {t('booking.shareService')}
            </button>
          )}
        </div>
      </div>

      {businessId && (
        <ServiceSharePicker
          businessId={businessId}
          open={sharePicker}
          onOpenChange={setSharePicker}
        />
      )}
    </>
  );
}
