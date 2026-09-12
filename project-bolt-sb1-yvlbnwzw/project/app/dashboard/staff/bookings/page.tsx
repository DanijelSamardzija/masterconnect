'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import {
  Calendar, Clock, ChevronRight, Users, Plus, Ban, Settings, CalendarOff,
  CheckCircle2, AlertCircle, XCircle
} from 'lucide-react';

type StaffBooking = {
  booking_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  service_name: string;
  duration_minutes: number;
  client_name: string | null;
  client_phone: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  location_name: string | null;
  notes: string | null;
  party_size: number;
};

type Permissions = {
  can_set_hours: boolean;
  can_create_bookings: boolean;
  can_cancel_bookings: boolean;
  can_block_time: boolean;
};

type ActiveFilter = 'upcoming' | 'pending' | 'all' | 'past';

const DEFAULT_PERMS: Permissions = {
  can_set_hours: false,
  can_create_bookings: false,
  can_cancel_bookings: false,
  can_block_time: false,
};

export default function StaffBookingsPage() {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const router = useRouter();
  const locale = { sr: 'sr-RS', en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' }[language] ?? 'en-US';

  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('upcoming');
  const [allBookings, setAllBookings] = useState<StaffBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMS);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('staff_members')
        .select('permissions')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .in('role', ['worker', 'manager'])
        .limit(1)
        .maybeSingle();
      if (data?.permissions) {
        setPermissions({
          can_set_hours:       !!data.permissions.can_set_hours,
          can_create_bookings: !!data.permissions.can_create_bookings,
          can_cancel_bookings: !!data.permissions.can_cancel_bookings,
          can_block_time:      !!data.permissions.can_block_time,
        });
      }
    })();
  }, [profile]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any).rpc('get_my_staff_bookings', {
        p_upcoming_only: false,
      });
      setAllBookings((data as StaffBooking[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const now = new Date();

  const upcomingAll  = allBookings.filter(b => new Date(b.starts_at) >= now && ['pending', 'confirmed'].includes(b.status));
  const pendingAll   = allBookings.filter(b => b.status === 'pending');
  const pastAll      = [...allBookings.filter(b => new Date(b.starts_at) < now || !['pending', 'confirmed'].includes(b.status))].reverse();

  const upcomingCount = upcomingAll.length;
  const pendingCount  = pendingAll.length;
  const totalCount    = allBookings.length;

  const displayed: StaffBooking[] =
    activeFilter === 'upcoming' ? upcomingAll :
    activeFilter === 'pending'  ? pendingAll :
    activeFilter === 'past'     ? pastAll :
    /* all */                     allBookings;

  const statusConfig: Record<string, { cls: string; icon: React.ReactNode }> = {
    pending:   { cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400', icon: <Clock className="h-3 w-3" /> },
    confirmed: { cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',    icon: <CheckCircle2 className="h-3 w-3" /> },
    completed: { cls: 'bg-muted text-muted-foreground',                                        icon: <CheckCircle2 className="h-3 w-3" /> },
    no_show:   { cls: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',            icon: <AlertCircle className="h-3 w-3" /> },
    cancelled: { cls: 'bg-muted text-muted-foreground',                                        icon: <XCircle className="h-3 w-3" /> },
  };

  const hasAnyAction = permissions.can_create_bookings || permissions.can_block_time || permissions.can_set_hours;

  const emptyMsg =
    activeFilter === 'upcoming' ? t('staffDashboard.empty') :
    activeFilter === 'pending'  ? t('staffDashboard.empty') :
    activeFilter === 'past'     ? t('staffDashboard.pastEmpty') :
    t('staffDashboard.empty');

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <h1 className="text-xl font-semibold flex-1">{t('staffDashboard.title')}</h1>
          </div>

          {/* Quick actions */}
          {hasAnyAction && (
            <div className="flex flex-wrap gap-2">
              {permissions.can_create_bookings && (
                <button
                  onClick={() => router.push('/dashboard/staff/new-booking')}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('staffDashboard.newBooking')}
                </button>
              )}
              {permissions.can_block_time && (
                <button
                  onClick={() => router.push('/dashboard/staff/time-off')}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-border bg-background hover:bg-accent transition-colors"
                >
                  <CalendarOff className="w-3.5 h-3.5" />
                  {t('staffDashboard.timeOff')}
                </button>
              )}
              {permissions.can_set_hours && (
                <button
                  onClick={() => router.push('/dashboard/staff/hours')}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-border bg-background hover:bg-accent transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                  {t('staffDashboard.myHours')}
                </button>
              )}
            </div>
          )}

          {/* Clickable stats tiles */}
          {!loading && (
            <div className="grid grid-cols-3 gap-3">
              {([
                { key: 'upcoming' as ActiveFilter, label: t('staffDashboard.upcoming'), value: upcomingCount, highlight: upcomingCount > 0 },
                { key: 'pending'  as ActiveFilter, label: t('staffDashboard.pending'),  value: pendingCount,  highlight: pendingCount > 0 },
                { key: 'all'      as ActiveFilter, label: t('staffDashboard.total'),    value: totalCount,    highlight: false },
              ]).map(({ key, label, value, highlight }) => {
                const isActive = activeFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveFilter(key)}
                    className={`rounded-2xl p-4 text-center transition-all border ${
                      isActive
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-card border-border hover:border-primary/40 hover:bg-accent'
                    }`}
                  >
                    <p className={`text-2xl font-bold ${isActive ? 'text-white' : highlight ? 'text-primary' : 'text-foreground'}`}>
                      {value}
                    </p>
                    <p className={`text-xs mt-0.5 ${isActive ? 'text-white/80' : 'text-muted-foreground'}`}>
                      {label}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Past tab — secondary, below tiles */}
          {!loading && (
            <button
              onClick={() => setActiveFilter(activeFilter === 'past' ? 'upcoming' : 'past')}
              className={`w-full py-2 rounded-xl text-xs font-semibold border transition-colors ${
                activeFilter === 'past'
                  ? 'bg-muted text-foreground border-border'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {t('booking.pastBookings')}
            </button>
          )}

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl px-5 py-12 text-center">
              <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{emptyMsg}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayed.map((b) => {
                const sc = statusConfig[b.status] ?? { cls: 'bg-muted text-muted-foreground', icon: null };
                const clientName  = b.client_name  || b.guest_name;
                const clientPhone = b.client_phone || b.guest_phone;
                return (
                  <div key={b.booking_id} className="bg-card border border-border rounded-2xl p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {new Date(b.starts_at).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long' })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(b.starts_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                          {' – '}
                          {new Date(b.ends_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${sc.cls}`}>
                          {sc.icon}
                          {t(`booking.status.${b.status}` as Parameters<typeof t>[0])}
                        </span>
                        {permissions.can_cancel_bookings && b.status === 'confirmed' && (
                          <button
                            title={t('staffDashboard.cancelBooking')}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{b.service_name}</span>
                      <span className="text-muted-foreground/50">·</span>
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>{b.duration_minutes} min</span>
                    </div>

                    {(clientName || clientPhone) && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3 w-3 shrink-0" />
                        {clientName && <span className="font-medium text-foreground">{clientName}</span>}
                        {clientPhone && <span>· {clientPhone}</span>}
                        {b.party_size > 1 && <span>× {b.party_size}</span>}
                      </div>
                    )}

                    {b.notes?.trim() && (
                      <p className="text-xs text-muted-foreground/70 italic border-t border-border/50 pt-2">
                        {b.notes}
                      </p>
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
