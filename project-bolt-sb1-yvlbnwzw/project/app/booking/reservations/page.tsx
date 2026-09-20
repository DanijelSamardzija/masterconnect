'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { useBookingAccess } from '@/lib/hooks/use-booking-access';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { BookingBetaBanner } from '@/components/booking-beta-banner';
import { toast } from 'sonner';
import { ChevronRight, Calendar, Users, Clock } from 'lucide-react';

type Reservation = {
  id: string;
  table_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  party_size: number;
  reserved_date: string;
  reserved_time: string;
  status: string;
  notes: string | null;
  table: { name: string; capacity: number } | null;
};

const STATUS_FLOW: Record<string, string> = {
  pending: 'confirmed',
  confirmed: 'seated',
  seated: 'completed',
};

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const map: Record<string, string> = {
    pending:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    seated:    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    no_show:   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? map.pending}`}>
      {t(`restaurant.dash.status.${status}` as Parameters<typeof t>[0])}
    </span>
  );
}

export default function ReservationsDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { hasAccess, loading: authLoading } = useBookingAccess();
  const { activeProfileId } = useBookingProfile();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !activeProfileId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from('table_reservations')
      .select('*, table:restaurant_tables(name, capacity)')
      .eq('business_id', activeProfileId)
      .eq('reserved_date', filterDate)
      .order('reserved_time');
    setReservations(data ?? []);
    setLoading(false);
  }, [user, activeProfileId, filterDate]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, newStatus: string) {
    setUpdatingId(id);
    await (supabase as any).from('table_reservations').update({ status: newStatus }).eq('id', id);
    setUpdatingId(null);
    load();
  }

  if (!authLoading && !hasAccess) {
    return <ProtectedRoute><BookingBetaBanner /></ProtectedRoute>;
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-6">

          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.push('/booking')} className="text-muted-foreground hover:text-foreground">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <h1 className="text-xl font-semibold flex-1">{t('restaurant.dash.title')}</h1>
          </div>

          {/* Date filter */}
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button onClick={() => setFilterDate(new Date().toISOString().split('T')[0])}
              className="text-xs text-primary hover:underline">
              Danas
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : reservations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('restaurant.dash.empty')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {reservations.map((res) => (
                <div key={res.id} className="border border-border rounded-xl p-4 bg-card flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{res.client_name}</p>
                      {res.client_phone && (
                        <p className="text-xs text-muted-foreground">{res.client_phone}</p>
                      )}
                    </div>
                    <StatusBadge status={res.status} t={t} />
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {res.reserved_time.slice(0, 5)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {res.party_size} {t('restaurant.reserve.persons')}
                    </span>
                    {res.table && (
                      <span className="bg-muted px-1.5 py-0.5 rounded-md">{res.table.name}</span>
                    )}
                  </div>

                  {res.notes && <p className="text-xs text-muted-foreground italic">{res.notes}</p>}

                  {/* Action buttons */}
                  {res.status !== 'completed' && res.status !== 'cancelled' && res.status !== 'no_show' && (
                    <div className="flex gap-2 mt-1">
                      {STATUS_FLOW[res.status] && (
                        <button
                          onClick={() => updateStatus(res.id, STATUS_FLOW[res.status])}
                          disabled={updatingId === res.id}
                          className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                        >
                          {updatingId === res.id ? '...' : t(`restaurant.dash.${STATUS_FLOW[res.status].replace('confirmed', 'confirm').replace('seated', 'seat').replace('completed', 'complete')}` as Parameters<typeof t>[0])}
                        </button>
                      )}
                      <button
                        onClick={() => updateStatus(res.id, 'cancelled')}
                        disabled={updatingId === res.id}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:border-destructive hover:text-destructive transition-colors disabled:opacity-50"
                      >
                        {t('restaurant.dash.cancel')}
                      </button>
                      <button
                        onClick={() => updateStatus(res.id, 'no_show')}
                        disabled={updatingId === res.id}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        No show
                      </button>
                    </div>
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
