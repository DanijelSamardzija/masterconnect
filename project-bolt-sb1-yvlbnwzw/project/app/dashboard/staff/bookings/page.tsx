'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { Calendar, Clock, ChevronRight, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

type StaffBooking = {
  booking_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  service_name: string;
  duration_minutes: number;
  client_name: string | null;
  location_name: string | null;
  notes: string | null;
  party_size: number;
};

function formatDateTime(isoStr: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoStr));
}

export default function StaffBookingsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [bookings, setBookings] = useState<StaffBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any).rpc('get_my_staff_bookings', {
        p_upcoming_only: tab === 'upcoming',
      });
      setBookings((data as StaffBooking[]) ?? []);
      setLoading(false);
    })();
  }, [tab]);

  const statusColor: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    pending:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    completed: 'bg-muted text-muted-foreground',
    no_show:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-6">

          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <h1 className="text-xl font-semibold flex-1">{t('staffDashboard.title')}</h1>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border mb-6">
            {(['upcoming', 'past'] as const).map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  tab === tabKey
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tabKey === 'upcoming' ? t('booking.upcomingBookings') : t('booking.pastBookings')}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {tab === 'upcoming' ? t('staffDashboard.empty') : t('staffDashboard.pastEmpty')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {bookings.map((b) => (
                <div key={b.booking_id} className="border border-border rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-medium text-sm">{b.service_name}</span>
                      {b.client_name && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <User className="w-3 h-3" />
                          {b.client_name}
                          {b.party_size > 1 && ` × ${b.party_size}`}
                        </div>
                      )}
                    </div>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColor[b.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {t(`booking.status.${b.status}` as Parameters<typeof t>[0])}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDateTime(b.starts_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {b.duration_minutes} min
                    </span>
                    {b.location_name && (
                      <span>{b.location_name}</span>
                    )}
                  </div>
                  {b.notes && (
                    <p className="text-xs text-muted-foreground border-t border-border/50 pt-2 mt-1">{b.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
