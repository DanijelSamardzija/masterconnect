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
            <button onClick={() => router.push('/booking')} className="text-muted-foreground hover:text-foreground">
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
                          <span className="flex items-center gap-1.5 text-xs">
                            <a href={`tel:${stay.client_phone}`} className="text-primary hover:underline">{stay.client_phone}</a>
                            <a href={`https://wa.me/${stay.client_phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#25D366]/15 hover:bg-[#25D366]/30 text-[#25D366] transition-colors">
                              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            </a>
                            <a href={`viber://chat?number=${stay.client_phone.replace(/\D/g,'')}`} title="Viber" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#7B519D]/15 hover:bg-[#7B519D]/30 text-[#7B519D] transition-colors">
                              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M11.398.008C8.232.022 4.483 1.652 2.38 5.137 1.027 7.418.769 10.162.997 12.63c.218 2.27 1.144 4.5 2.804 6.083 1.62 1.547 4.082 2.61 6.376 2.47l3.906 2.825-.194-3.054c4.32-.427 7.917-3.77 8.101-8.217.14-3.428-1.41-7.108-3.78-9.213C16.437.72 13.95-.008 11.398.008zm.03 1.846c2.218-.012 4.324.625 6.042 2.164 1.987 1.8 3.234 4.993 3.117 7.84-.158 3.747-3.234 6.504-6.924 6.782l.116 1.815-2.323-1.67-.5.035c-2.015.14-4.148-.79-5.575-2.155C3.993 15.53 3.215 13.617 3.03 11.647c-.197-2.1.004-4.354 1.066-6.202C6.044 3.117 8.952 1.866 11.428 1.854zM8.42 5.597c-.24 0-.482.06-.676.212-.193.152-.426.375-.586.619-.217.334-.21.75-.049 1.21.162.462.47.95.813 1.393.537.699 1.08 1.32 1.773 1.893.693.573 1.426 1.015 2.184 1.288.448.16.916.224 1.285.073.37-.151.59-.48.735-.83.178-.426.153-.806-.046-1.047-.198-.241-.571-.434-.867-.578-.296-.146-.591-.278-.858-.226-.266.053-.433.27-.574.484-.141.215-.269.378-.44.417-.17.038-.48-.073-.74-.265-.36-.263-.757-.653-1.098-1.035-.34-.38-.636-.773-.78-1.04-.144-.267-.122-.495-.086-.598.037-.104.155-.24.316-.393.16-.153.349-.32.437-.534.087-.213.05-.51-.11-.814-.161-.305-.42-.621-.714-.816-.294-.195-.578-.213-.72-.213z"/></svg>
                            </a>
                          </span>
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
