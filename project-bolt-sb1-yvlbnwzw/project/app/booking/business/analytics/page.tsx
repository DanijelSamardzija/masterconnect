'use client';

import { useEffect, useState, useCallback } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import {
  BarChart3, ChevronDown, ChevronUp, MapPin, User, TrendingUp,
  CheckCircle2, AlertCircle, XCircle, Calendar,
} from 'lucide-react';
import { BusinessBookingNav } from '@/components/booking/business-booking-nav';

// ── Types ──────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month' | 'year' | 'custom';

type Summary = {
  total_bookings: number;
  completed: number;
  no_shows: number;
  cancelled: number;
  revenue: number;
};

type StaffRow = {
  staff_member_id: string | null;
  staff_name: string;
  completed: number;
  no_shows: number;
  revenue: number;
};

type ServiceRow = {
  service_id: string;
  service_name: string;
  completed: number;
  no_shows: number;
  revenue: number;
};

type StaffServiceRow = {
  staff_member_id: string | null;
  staff_name: string;
  service_id: string;
  service_name: string;
  completed: number;
  revenue: number;
};

type AnalyticsResult = {
  ok: boolean;
  error?: string;
  summary: Summary;
  by_staff: StaffRow[];
  by_service: ServiceRow[];
  staff_service_breakdown: StaffServiceRow[];
};

type Location = { id: string; name: string };

// ── Helpers ────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getPeriodRange(period: Period, customFrom: string, customTo: string): { from: string; to: string } {
  const today = new Date();
  if (period === 'today') {
    const s = isoDate(today);
    return { from: s, to: s };
  }
  if (period === 'week') {
    const mon = new Date(today);
    const day = mon.getDay() || 7;
    mon.setDate(mon.getDate() - (day - 1));
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return { from: isoDate(mon), to: isoDate(sun) };
  }
  if (period === 'month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: isoDate(from), to: isoDate(to) };
  }
  if (period === 'year') {
    return {
      from: `${today.getFullYear()}-01-01`,
      to:   `${today.getFullYear()}-12-31`,
    };
  }
  return { from: customFrom, to: customTo };
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Main component ─────────────────────────────────────────────────────────

function AnalyticsPageInner() {
  const { t } = useLanguage();
  const { profile } = useAuth();

  // Filter state
  const [period, setPeriod]         = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState(isoDate(new Date()));
  const [customTo, setCustomTo]     = useState(isoDate(new Date()));
  const [locationId, setLocationId] = useState<string>('');
  const [staffId, setStaffId]       = useState<string>('');

  // Data state
  const [locations, setLocations]   = useState<Location[]>([]);
  const [staffList, setStaffList]   = useState<{ id: string; name: string }[]>([]);
  const [data, setData]             = useState<AnalyticsResult | null>(null);
  const [loading, setLoading]       = useState(false);

  // UI state
  const [expandedStaff, setExpandedStaff] = useState<Set<string>>(new Set());

  // Load locations + staff list once (scoped to caller's business via staff_members)
  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;

    (async () => {
      // Get business_id for the logged-in user
      const { data: me } = await supabase
        .from('staff_members')
        .select('business_id')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .in('role', ['owner', 'manager'])
        .maybeSingle();

      if (!me || cancelled) return;

      const [{ data: locs }, { data: sm }] = await Promise.all([
        supabase
          .from('business_locations')
          .select('id, name')
          .eq('business_id', me.business_id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('staff_members')
          .select('id, profiles!staff_members_user_id_fkey(name)')
          .eq('business_id', me.business_id)
          .eq('is_active', true)
          .order('id'),
      ]);

      if (cancelled) return;
      if (locs) setLocations(locs);
      if (sm) {
        setStaffList(
          (sm as { id: string; profiles: { name: string } | null }[]).map(s => ({
            id: s.id,
            name: s.profiles?.name ?? '—',
          }))
        );
      }
    })();

    return () => { cancelled = true; };
  }, [profile?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = getPeriodRange(period, customFrom, customTo);

    const { data: result, error } = await (supabase.rpc as Function)('get_booking_analytics', {
      p_location_id: locationId || null,
      p_date_from:   from,
      p_date_to:     to,
      p_staff_id:    staffId || null,
      p_service_id:  null,
    });

    setLoading(false);
    if (error) {
      setData(null);
      return;
    }
    setData(result as AnalyticsResult);
  }, [period, customFrom, customTo, locationId, staffId]);

  useEffect(() => { load(); }, [load]);

  const toggleStaff = (id: string) => {
    setExpandedStaff(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today', label: t('bookingAnalytics.filter.today') },
    { key: 'week',  label: t('bookingAnalytics.filter.week')  },
    { key: 'month', label: t('bookingAnalytics.filter.month') },
    { key: 'year',  label: t('bookingAnalytics.filter.year')  },
    { key: 'custom',label: t('bookingAnalytics.filter.custom')},
  ];

  const summary = data?.summary;
  const byStaff = data?.by_staff ?? [];
  const bySvc   = data?.by_service ?? [];
  const svcBrk  = data?.staff_service_breakdown ?? [];

  const staffSvcMap = svcBrk.reduce<Record<string, StaffServiceRow[]>>((acc, row) => {
    const key = row.staff_member_id ?? '__none__';
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  if (data?.ok === false && data?.error === 'not_authorized') {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        {t('bookingAnalytics.noPermission')}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <BusinessBookingNav active="analytics" />

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-primary/10">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-foreground leading-tight">
            {t('bookingAnalytics.title')}
          </h1>
          <p className="text-xs text-muted-foreground">{t('bookingAnalytics.subtitle')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Period buttons */}
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === p.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {period === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-muted-foreground">{t('bookingAnalytics.dateFrom')}</label>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
            />
            <label className="text-xs text-muted-foreground">{t('bookingAnalytics.dateTo')}</label>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              onChange={e => setCustomTo(e.target.value)}
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
            />
          </div>
        )}

        {/* Location + Staff dropdowns */}
        <div className="flex gap-2 flex-wrap">
          {locations.length > 1 && (
            <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2 py-1.5">
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
              <select
                value={locationId}
                onChange={e => setLocationId(e.target.value)}
                className="text-xs bg-transparent text-foreground outline-none"
              >
                <option value="">{t('bookingAnalytics.allLocations')}</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}
          {staffList.length > 1 && (
            <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2 py-1.5">
              <User className="h-3 w-3 text-muted-foreground shrink-0" />
              <select
                value={staffId}
                onChange={e => setStaffId(e.target.value)}
                className="text-xs bg-transparent text-foreground outline-none"
              >
                <option value="">{t('bookingAnalytics.allStaff')}</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center text-sm text-muted-foreground py-8">
          {t('bookingAnalytics.loading')}
        </div>
      )}

      {/* Content */}
      {!loading && summary && (
        <>
          {/* Summary cards — 2 per row on mobile, 4 on desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard
              icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
              label={t('bookingAnalytics.summary.reservations')}
              value={summary.total_bookings.toString()}
            />
            <SummaryCard
              icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
              label={t('bookingAnalytics.summary.completed')}
              value={summary.completed.toString()}
              accent="green"
            />
            <SummaryCard
              icon={<TrendingUp className="h-4 w-4 text-primary" />}
              label={t('bookingAnalytics.summary.revenue')}
              value={`€${fmt(summary.revenue)}`}
              accent="primary"
            />
            <SummaryCard
              icon={<AlertCircle className="h-4 w-4 text-orange-500" />}
              label={t('bookingAnalytics.summary.noShows')}
              value={summary.no_shows.toString()}
              accent="orange"
            />
          </div>

          {/* Empty state */}
          {summary.total_bookings === 0 && (
            <div className="text-center text-sm text-muted-foreground py-4 border border-dashed border-border rounded-2xl">
              {t('bookingAnalytics.empty')}
            </div>
          )}

          {summary.total_bookings > 0 && (
            <>
              {/* By Staff — accordion */}
              {byStaff.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {t('bookingAnalytics.byStaff')}
                  </h2>

                  {/* Desktop: table header */}
                  <div className="hidden sm:grid grid-cols-[1fr_80px_80px_100px_40px] gap-2 px-3 pb-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                    <span>{t('bookingAnalytics.allStaff').replace('Svi ', '').replace('All ', '')}</span>
                    <span className="text-right">{t('bookingAnalytics.summary.completed')}</span>
                    <span className="text-right">{t('bookingAnalytics.summary.noShows')}</span>
                    <span className="text-right">{t('bookingAnalytics.summary.revenue')}</span>
                    <span />
                  </div>

                  <div className="space-y-1.5">
                    {byStaff.map(s => {
                      const key = s.staff_member_id ?? '__none__';
                      const isExpanded = expandedStaff.has(key);
                      const services = staffSvcMap[key] ?? [];

                      return (
                        <div key={key} className="border border-border rounded-2xl overflow-hidden bg-background">
                          {/* Staff row */}
                          <button
                            onClick={() => services.length > 0 && toggleStaff(key)}
                            className={`w-full text-left ${services.length > 0 ? 'cursor-pointer hover:bg-accent/50' : 'cursor-default'} transition-colors`}
                          >
                            {/* Mobile layout */}
                            <div className="sm:hidden flex items-start justify-between px-3 pt-3 pb-2">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {s.staff_name || t('bookingAnalytics.staffNoName')}
                                </p>
                                <div className="flex gap-3 mt-1">
                                  <span className="text-xs text-green-600 font-medium">
                                    ✓ {s.completed}
                                  </span>
                                  {s.no_shows > 0 && (
                                    <span className="text-xs text-orange-500">
                                      ✗ {s.no_shows}
                                    </span>
                                  )}
                                  <span className="text-xs font-semibold text-foreground">
                                    €{fmt(s.revenue)}
                                  </span>
                                </div>
                              </div>
                              {services.length > 0 && (
                                <div className="text-muted-foreground pt-0.5">
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </div>
                              )}
                            </div>

                            {/* Desktop layout */}
                            <div className="hidden sm:grid grid-cols-[1fr_80px_80px_100px_40px] gap-2 items-center px-3 py-2.5">
                              <span className="text-sm font-medium text-foreground truncate">
                                {s.staff_name || t('bookingAnalytics.staffNoName')}
                              </span>
                              <span className="text-sm text-right text-green-600 font-medium">{s.completed}</span>
                              <span className="text-sm text-right text-orange-500">{s.no_shows || '—'}</span>
                              <span className="text-sm text-right font-semibold text-foreground">€{fmt(s.revenue)}</span>
                              <span className="flex justify-end text-muted-foreground">
                                {services.length > 0 && (
                                  isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                )}
                              </span>
                            </div>
                          </button>

                          {/* Service breakdown — expanded */}
                          {isExpanded && services.length > 0 && (
                            <div className="border-t border-border bg-muted/30 divide-y divide-border/50">
                              {services.map(svc => (
                                <div key={svc.service_id || svc.service_name} className="flex items-center justify-between px-4 py-2">
                                  <span className="text-xs text-foreground">{svc.service_name}</span>
                                  <div className="flex items-center gap-4">
                                    <span className="text-xs text-green-600 font-medium">×{svc.completed}</span>
                                    <span className="text-xs font-medium text-foreground w-20 text-right">€{fmt(svc.revenue)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* By Service */}
              {bySvc.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    {t('bookingAnalytics.byService')}
                  </h2>

                  {/* Desktop header */}
                  <div className="hidden sm:grid grid-cols-[1fr_80px_80px_100px] gap-2 px-3 pb-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                    <span>{t('bookingAnalytics.services')}</span>
                    <span className="text-right">{t('bookingAnalytics.summary.completed')}</span>
                    <span className="text-right">{t('bookingAnalytics.summary.noShows')}</span>
                    <span className="text-right">{t('bookingAnalytics.summary.revenue')}</span>
                  </div>

                  <div className="border border-border rounded-2xl overflow-hidden bg-background divide-y divide-border/50">
                    {bySvc.map(svc => (
                      <div key={svc.service_id || svc.service_name}>
                        {/* Mobile */}
                        <div className="sm:hidden flex items-start justify-between px-3 py-2.5">
                          <p className="text-sm text-foreground flex-1 pr-2">{svc.service_name}</p>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-foreground">€{fmt(svc.revenue)}</p>
                            <p className="text-[11px] text-muted-foreground">
                              ✓{svc.completed}{svc.no_shows > 0 ? ` · ✗${svc.no_shows}` : ''}
                            </p>
                          </div>
                        </div>
                        {/* Desktop */}
                        <div className="hidden sm:grid grid-cols-[1fr_80px_80px_100px] gap-2 items-center px-3 py-2.5">
                          <span className="text-sm text-foreground truncate">{svc.service_name}</span>
                          <span className="text-sm text-right text-green-600 font-medium">{svc.completed}</span>
                          <span className="text-sm text-right text-orange-500">{svc.no_shows || '—'}</span>
                          <span className="text-sm text-right font-semibold text-foreground">€{fmt(svc.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Summary card ───────────────────────────────────────────────────────────

function SummaryCard({
  icon, label, value, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: 'green' | 'primary' | 'orange';
}) {
  const valueClass =
    accent === 'green'   ? 'text-green-600' :
    accent === 'primary' ? 'text-primary'   :
    accent === 'orange'  ? 'text-orange-500':
    'text-foreground';

  return (
    <div className="border border-border rounded-2xl p-3 bg-background flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] text-muted-foreground font-medium leading-none">{label}</span>
      </div>
      <p className={`text-xl font-bold ${valueClass} leading-none tabular-nums`}>{value}</p>
    </div>
  );
}

// ── Page export ────────────────────────────────────────────────────────────

export default function BookingAnalyticsPage() {
  return (
    <ProtectedRoute>
      <AnalyticsPageInner />
    </ProtectedRoute>
  );
}
