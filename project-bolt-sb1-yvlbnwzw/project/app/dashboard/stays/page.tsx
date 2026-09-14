'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { useBookingAccess } from '@/lib/hooks/use-booking-access';
import { BookingBetaBanner } from '@/components/booking-beta-banner';
import { ChevronRight, Calendar, Users, Moon } from 'lucide-react';

type Stay = {
  id: string;
  unit_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  check_in: string;
  check_out: string;
  guests: number;
  total_amount: number;
  status: string;
  payment_status: string;
  notes: string | null;
  currency: string;
  unit?: { name: string; unit_type: string } | null;
};

const STATUS_FLOW: Record<string, string> = {
  pending: 'confirmed',
  confirmed: 'checked_in',
  checked_in: 'checked_out',
};

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const map: Record<string, string> = {
    pending:     'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    confirmed:   'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    checked_in:  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    checked_out: 'bg-muted text-muted-foreground',
    cancelled:   'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? map.pending}`}>
      {t(`acc.dash.status.${status}` as Parameters<typeof t>[0])}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    unpaid:       { label: 'Neplaćeno', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    deposit_paid: { label: 'Avans', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    paid:         { label: 'Plaćeno', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  };
  const item = map[status] ?? map.unpaid;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.cls}`}>
      {item.label}
    </span>
  );
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const d1 = new Date(checkIn);
  const d2 = new Date(checkOut);
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

export default function StaysDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { hasAccess, loading: authLoading } = useBookingAccess();

  const [stays, setStays] = useState<Stay[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'checkin_today' | 'all'>('upcoming');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = (supabase as any)
      .from('accommodation_bookings')
      .select('*, unit:accommodation_units(name, unit_type)')
      .eq('business_id', user.id)
      .order('check_in');

    const today = new Date().toISOString().split('T')[0];
    if (filter === 'upcoming') {
      query = query.gte('check_in', today).not('status', 'in', '("cancelled","checked_out")');
    } else if (filter === 'checkin_today') {
      query = query.eq('check_in', today);
    }

    const { data } = await query;
    setStays(data ?? []);
    setLoading(false);
  }, [user, filter]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, newStatus: string) {
    setUpdatingId(id);
    await (supabase as any).from('accommodation_bookings').update({ status: newStatus }).eq('id', id);
    setUpdatingId(null);
    load();
  }

  async function updatePayment(id: string, paymentStatus: string) {
    setUpdatingId(id);
    await (supabase as any).from('accommodation_bookings').update({ payment_status: paymentStatus }).eq('id', id);
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
            <button onClick={() => router.push('/dashboard')} className="text-muted-foreground hover:text-foreground">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <h1 className="text-xl font-semibold flex-1">{t('acc.dash.title')}</h1>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {(['upcoming', 'checkin_today', 'all'] as const).map((f) => (
              <button key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                  filter === f
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:border-primary'
                }`}
              >
                {t(`acc.dash.filter.${f}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : stays.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('acc.dash.empty')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {stays.map((stay) => {
                const nights = nightsBetween(stay.check_in, stay.check_out);
                return (
                  <div key={stay.id} className="border border-border rounded-xl p-4 bg-card flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{stay.client_name}</p>
                        {stay.client_phone && (
                          <a href={`tel:${stay.client_phone}`}
                            className="text-xs text-primary hover:underline">{stay.client_phone}</a>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <PaymentBadge status={stay.payment_status} />
                        <StatusBadge status={stay.status} t={t} />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {stay.check_in} → {stay.check_out}
                      </span>
                      <span className="flex items-center gap-1">
                        <Moon className="w-3 h-3" /> {nights}n
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {stay.guests}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      {stay.unit && (
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md">{stay.unit.name}</span>
                      )}
                      <span className="text-xs font-medium ml-auto">
                        {stay.total_amount.toFixed(2)} {stay.currency}
                      </span>
                    </div>

                    {stay.notes && <p className="text-xs text-muted-foreground italic">{stay.notes}</p>}

                    {/* Actions */}
                    {stay.status !== 'checked_out' && stay.status !== 'cancelled' && (
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {STATUS_FLOW[stay.status] && (
                          <button
                            onClick={() => updateStatus(stay.id, STATUS_FLOW[stay.status])}
                            disabled={updatingId === stay.id}
                            className="flex-1 min-w-0 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                          >
                            {updatingId === stay.id ? '...' : t(`acc.dash.${STATUS_FLOW[stay.status].replace('confirmed','confirm').replace('checked_in','checkin').replace('checked_out','checkout')}` as Parameters<typeof t>[0])}
                          </button>
                        )}

                        {/* Payment status cycle */}
                        {stay.payment_status !== 'paid' && (
                          <button
                            onClick={() => updatePayment(stay.id, stay.payment_status === 'unpaid' ? 'deposit_paid' : 'paid')}
                            disabled={updatingId === stay.id}
                            className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                          >
                            {stay.payment_status === 'unpaid' ? t('acc.dash.markDeposit') : t('acc.dash.markPaid')}
                          </button>
                        )}

                        <button
                          onClick={() => updateStatus(stay.id, 'cancelled')}
                          disabled={updatingId === stay.id}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:border-destructive hover:text-destructive transition-colors disabled:opacity-50"
                        >
                          {t('acc.dash.cancel')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  );
}
