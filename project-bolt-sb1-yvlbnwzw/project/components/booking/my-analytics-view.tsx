'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { BarChart3, MapPin, Download } from 'lucide-react';
import type { ReactNode } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month' | 'year' | 'custom';

type Summary = { completed: number; revenue: number };

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

function getPeriodRange(period: Period, customFrom: string, customTo: string) {
  const today = new Date();
  if (period === 'today') { const s = isoDate(today); return { from: s, to: s }; }
  if (period === 'week') {
    const mon = new Date(today); const day = mon.getDay() || 7;
    mon.setDate(mon.getDate() - (day - 1));
    const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
    return { from: isoDate(mon), to: isoDate(sun) };
  }
  if (period === 'month') {
    return {
      from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      to:   isoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    };
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

// ── Core view ──────────────────────────────────────────────────────────────

export function MyAnalyticsView({ nav }: { nav: ReactNode }) {
  const { t } = useLanguage();
  const { user, profile } = useAuth();

  // Persist period across page refreshes
  const [period, setPeriod] = useState<Period>(() => {
    try { return (localStorage.getItem('myAnalyticsPeriod') as Period) || 'month'; } catch { return 'month'; }
  });
  const [customFrom, setCustomFrom] = useState(isoDate(new Date()));
  const [customTo, setCustomTo]     = useState(isoDate(new Date()));
  const [locationId, setLocationId] = useState<string>('');
  const [data, setData]             = useState<MyAnalyticsResult | null>(null);
  const [loading, setLoading]       = useState(false);
  const [rpcError, setRpcError]     = useState<string | null>(null);

  const handlePeriod = (p: Period) => {
    setPeriod(p);
    try { localStorage.setItem('myAnalyticsPeriod', p); } catch {}
  };

  // Use user?.id (available immediately from localStorage) as trigger,
  // falling back to profile?.id if user context loads later
  const userId = user?.id ?? profile?.id;

  const load = useCallback(async () => {
    setLoading(true);
    setRpcError(null);
    const { from, to } = getPeriodRange(period, customFrom, customTo);
    const { data: result, error } = await (supabase.rpc as Function)('get_my_analytics', {
      p_date_from:   from,
      p_date_to:     to,
      p_location_id: locationId || null,
    });
    setLoading(false);
    if (error) { setRpcError(error.message); setData(null); return; }
    if (!result || result.ok === false) { setData(null); return; }
    setData(result as MyAnalyticsResult);
  }, [period, customFrom, customTo, locationId]);

  useEffect(() => { if (userId) load(); }, [userId, load]);

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

  function downloadCSV() {
    if (!summary) return;
    const { from, to } = getPeriodRange(period, customFrom, customTo);
    const bom = '﻿';
    const header = 'Usluga,Broj termina,Prosj. cijena (EUR),Ukupno (EUR)';
    const rows = services.map(svc =>
      `"${svc.service_name}",${svc.completed},${Number(svc.avg_price).toFixed(2)},${Number(svc.revenue).toFixed(2)}`
    );
    rows.push(`"UKUPNO",${summary.completed},,${Number(summary.revenue).toFixed(2)}`);
    const csv = bom + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moja-analitika-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printAnalyticsPDF() {
    if (!summary) return;
    const { from, to } = getPeriodRange(period, customFrom, customTo);
    const title = `Moja analitika: ${from} – ${to}`;
    const serviceRows = services.map(svc =>
      `<tr><td>${svc.service_name}</td><td>${svc.completed}</td><td>€ ${Number(svc.avg_price).toFixed(2)}</td><td>€ ${Number(svc.revenue).toFixed(2)}</td></tr>`
    ).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;margin:16px;color:#111}
  h2{font-size:14px;margin-bottom:12px}
  table{border-collapse:collapse;width:100%;margin-bottom:8px}
  th,td{border:1px solid #ccc;padding:4px 8px;text-align:right}
  th{background:#f0f0f0;font-size:10px}
  th:first-child,td:first-child{text-align:left}
  tfoot td{background:#f5f5f5;font-weight:bold}
  .grand{border-top:2px solid #333;margin-top:16px;padding-top:8px;font-weight:bold;font-size:12px}
  @media print{@page{margin:10mm}}
</style></head><body>
<h2>${title}</h2>
<table>
  <thead><tr><th>Usluga</th><th>Broj</th><th>Prosj. cijena</th><th>Ukupno</th></tr></thead>
  <tbody>${serviceRows}</tbody>
  <tfoot><tr><td>Ukupno</td><td>${summary.completed}</td><td></td><td>€ ${Number(summary.revenue).toFixed(2)}</td></tr></tfoot>
</table>
<div class="grand">Ukupno: ${summary.completed} termina &nbsp;·&nbsp; € ${Number(summary.revenue).toFixed(2)}</div>
</body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {nav}

      {rpcError && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
          {rpcError}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-primary/10 shrink-0">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-foreground leading-tight">
            {t('myAnalytics.title')}
          </h1>
          <p className="text-xs text-muted-foreground">{t('myAnalytics.subtitle')}</p>
        </div>
        {summary && summary.completed > 0 && (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={downloadCSV}
              title={t('schedule.download')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>CSV</span>
            </button>
            <button
              onClick={printAnalyticsPDF}
              title={t('schedule.downloadPDF')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => handlePeriod(p.key)}
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

      {loading && (
        <div className="text-center text-sm text-muted-foreground py-10">
          {t('bookingAnalytics.loading')}
        </div>
      )}

      {!loading && summary && (
        summary.completed === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-6 border border-dashed border-border rounded-2xl">
            {t('bookingAnalytics.empty')}
          </div>
        ) : (
          <div className="space-y-4">
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
        )
      )}
    </div>
  );
}
