'use client';

import { useEffect, useState, useCallback } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { BarChart3, MapPin } from 'lucide-react';
import { BusinessBookingNav } from '@/components/booking/business-booking-nav';

// ── Types ──────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month' | 'year' | 'custom';

type Summary = {
  completed: number;
  revenue: number;
};

type ServiceRow = {
  service_id: string;
  service_name: string;
  completed: number;
  avg_price: number;
  revenue: number;
};

type MyAnalyticsResult = {
  ok: boolean;
  error?: string;
  summary: Summary;
  by_service: ServiceRow[];
  locations: { id: string; name: string }[];
};

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
    return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
  }
  return { from: customFrom, to: customTo };
}

function fmtMoney(n: number): string {
  return n % 1 === 0
    ? `€ ${n.toLocaleString()}`
    : `€ ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Main component ─────────────────────────────────────────────────────────

function MyAnalyticsInner() {
  const { t } = useLanguage();
  const { profile } = useAuth();

  const [period, setPeriod]         = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState(isoDate(new Date()));
  const [customTo, setCustomTo]     = useState(isoDate(new Date()));
  const [locationId, setLocationId] = useState<string>('');

  const [data, setData]     = useState<MyAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = getPeriodRange(period, customFrom, customTo);

    const { data: result, error } = await (supabase.rpc as Function)('get_my_analytics', {
      p_date_from:   from,
      p_date_to:     to,
      p_location_id: locationId || null,
    });

    setLoading(false);
    if (error || !result) { setData(null); return; }
    setData(result as MyAnalyticsResult);
  }, [period, customFrom, customTo, locationId]);

  useEffect(() => {
    if (profile?.id) load();
  }, [profile?.id, load]);

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today',  label: t('bookingAnalytics.filter.today')  },
    { key: 'week',   label: t('bookingAnalytics.filter.week')   },
    { key: 'month',  label: t('bookingAnalytics.filter.month')  },
    { key: 'year',   label: t('bookingAnalytics.filter.year')   },
    { key: 'custom', label: t('bookingAnalytics.filter.custom') },
  ];

  const locations = data?.locations ?? [];
  const summary   = data?.summary;
  const services  = data?.by_service ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <BusinessBookingNav active="my-analytics" />

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-primary/10">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-foreground leading-tight">
            {t('myAnalytics.title')}
          </h1>
          <p className="text-xs text-muted-foreground">{t('myAnalytics.subtitle')}</p>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
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

        {period === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">{t('bookingAnalytics.dateFrom')}</span>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground" />
            <span className="text-xs text-muted-foreground">{t('bookingAnalytics.dateTo')}</span>
            <input type="date" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)}
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground" />
          </div>
        )}

        {locations.length > 1 && (
          <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 py-1.5 w-fit">
            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
            <select value={locationId} onChange={e => setLocationId(e.target.value)}
              className="text-xs bg-transparent text-foreground outline-none">
              <option value="">{t('bookingAnalytics.allLocations')}</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="text-center text-sm text-muted-foreground py-10">
          {t('bookingAnalytics.loading')}
        </div>
      )}

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {!loading && summary && (
        <>
          {summary.completed === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6 border border-dashed border-border rounded-2xl">
              {t('bookingAnalytics.empty')}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Service table */}
              <div className="border border-border rounded-2xl overflow-hidden bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/40">
                        <th className="text-left text-muted-foreground font-medium px-4 py-2.5">
                          {t('bookingAnalytics.col.service')}
                        </th>
                        <th className="text-right text-muted-foreground font-medium px-3 py-2.5 whitespace-nowrap">
                          {t('bookingAnalytics.col.count')}
                        </th>
                        <th className="text-right text-muted-foreground font-medium px-3 py-2.5 whitespace-nowrap">
                          {t('bookingAnalytics.col.price')}
                        </th>
                        <th className="text-right text-muted-foreground font-medium px-4 py-2.5 whitespace-nowrap">
                          {t('bookingAnalytics.col.total')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {services.map(svc => (
                        <tr key={svc.service_id || svc.service_name} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 text-foreground">{svc.service_name}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-foreground font-medium">
                            {svc.completed}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                            {fmtMoney(svc.avg_price)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-foreground font-semibold whitespace-nowrap">
                            {fmtMoney(svc.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border bg-muted/30">
                        <td className="px-4 py-2.5 text-xs font-semibold text-foreground">
                          {t('bookingAnalytics.staffTotal')}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-foreground font-semibold">
                          {summary.completed}
                        </td>
                        <td className="px-3 py-2.5" />
                        <td className="px-4 py-2.5 text-right tabular-nums text-primary font-bold text-sm whitespace-nowrap">
                          {fmtMoney(summary.revenue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Grand total */}
              <div className="border border-primary/30 rounded-2xl bg-primary/5 px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                  {t('bookingAnalytics.grandTotal')}
                </span>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {summary.completed}&nbsp;×
                  </span>
                  <span className="text-base font-bold text-primary tabular-nums">
                    {fmtMoney(summary.revenue)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function MyAnalyticsPage() {
  return (
    <ProtectedRoute>
      <MyAnalyticsInner />
    </ProtectedRoute>
  );
}
