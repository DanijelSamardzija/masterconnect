'use client';

import { useEffect, useState, useCallback } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { BarChart3, MapPin, User, Download } from 'lucide-react';
import { BusinessBookingNav } from '@/components/booking/business-booking-nav';

// ── Types ──────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month' | 'year' | 'last_year' | 'custom';

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

type StaffServiceRow = {
  staff_member_id: string | null;
  staff_name: string;
  service_id: string;
  service_name: string;
  completed: number;
  avg_price: number;
  revenue: number;
};

type AnalyticsResult = {
  ok: boolean;
  error?: string;
  summary: Summary;
  by_staff: StaffRow[];
  by_service: unknown[];
  staff_service_breakdown: StaffServiceRow[];
};

type Location = { id: string; name: string };

// ── Helpers ────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  if (period === 'last_year') {
    const y = today.getFullYear() - 1;
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  return { from: customFrom, to: customTo };
}

// Format currency — no trailing zeros for whole numbers
function currencyPrefix(c: string): string {
  if (c === 'EUR') return '€';
  if (c === 'USD') return '$';
  if (c === 'GBP') return '£';
  return c; // RSD, BAM, HRK, etc.
}

function fmtMoney(n: number, currency = 'EUR'): string {
  const prefix = currencyPrefix(currency);
  return n % 1 === 0
    ? `${prefix} ${n.toLocaleString()}`
    : `${prefix} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Main component ─────────────────────────────────────────────────────────

function AnalyticsPageInner() {
  const { t } = useLanguage();
  const { user, profile } = useAuth();

  const [period, setPeriod]         = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState(isoDate(new Date()));
  const [customTo, setCustomTo]     = useState(isoDate(new Date()));
  const [locationId, setLocationId] = useState<string>('');
  const [staffId, setStaffId]       = useState<string>('');

  const [locations, setLocations]   = useState<Location[]>([]);
  const [allStaff, setAllStaff]     = useState<{ id: string; name: string; locationId: string | null }[]>([]);
  const [data, setData]             = useState<AnalyticsResult | null>(null);
  const [loading, setLoading]       = useState(false);

  const staffList = locationId
    ? allStaff.filter(s => s.locationId === locationId)
    : allStaff;

  // Load locations + staff list — scoped to caller's business
  const userId = user?.id ?? profile?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      const { data: me } = await supabase
        .from('staff_members')
        .select('business_id')
        .eq('user_id', userId)
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
          .select('id, primary_location_id, profiles!staff_members_user_id_fkey(name)')
          .eq('business_id', me.business_id)
          .eq('is_active', true)
          .order('id'),
      ]);

      if (cancelled) return;
      if (locs) setLocations(locs);
      if (sm) {
        setAllStaff(
          (sm as { id: string; primary_location_id: string | null; profiles: { name: string } | null }[]).map(s => ({
            id: s.id,
            name: s.profiles?.name ?? '—',
            locationId: s.primary_location_id ?? null,
          }))
        );
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

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
    if (error || !result) { setData(null); return; }
    setData(result as AnalyticsResult);
  }, [period, customFrom, customTo, locationId, staffId]);

  // Fire on mount and whenever filters change
  useEffect(() => { if (userId) load(); }, [userId, load]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const summary  = data?.summary;
  const byStaff  = data?.by_staff ?? [];
  const svcBrk   = data?.staff_service_breakdown ?? [];

  const currency = data?.currency ?? 'EUR';

  // Group service rows by staff key
  const staffSvcMap = svcBrk.reduce<Record<string, StaffServiceRow[]>>((acc, row) => {
    const key = row.staff_member_id ?? '__none__';
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today',     label: t('bookingAnalytics.filter.today')     },
    { key: 'week',      label: t('bookingAnalytics.filter.week')      },
    { key: 'month',     label: t('bookingAnalytics.filter.month')     },
    { key: 'year',      label: t('bookingAnalytics.filter.year')      },
    { key: 'last_year', label: t('bookingAnalytics.filter.last_year') },
    { key: 'custom',    label: t('bookingAnalytics.filter.custom')    },
  ];

  function downloadCSV() {
    if (!summary) return;
    const { from, to } = getPeriodRange(period, customFrom, customTo);
    const bom = '﻿';
    const header = `Radnik,Usluga,Broj termina,Prosj. cijena (${currency}),Ukupno (${currency})`;
    const rows: string[] = [];
    byStaff.filter(s => s.completed > 0).forEach(staffRow => {
      const key = staffRow.staff_member_id ?? '__none__';
      const svcs = staffSvcMap[key] ?? [];
      svcs.forEach(svc => {
        rows.push(`"${staffRow.staff_name}","${svc.service_name}",${svc.completed},${Number(svc.avg_price).toFixed(2)},${Number(svc.revenue).toFixed(2)}`);
      });
      if (svcs.length === 0) {
        rows.push(`"${staffRow.staff_name}","",${staffRow.completed},,${Number(staffRow.revenue).toFixed(2)}`);
      }
    });
    rows.push(`"UKUPNO","",${summary.completed},,${Number(summary.revenue).toFixed(2)}`);
    const csv = bom + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analitika-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printAnalyticsPDF() {
    if (!summary) return;
    const { from, to } = getPeriodRange(period, customFrom, customTo);
    const title = `Analitika: ${from} – ${to}`;

    const staffBlocks = byStaff.filter(s => s.completed > 0).map(staffRow => {
      const key = staffRow.staff_member_id ?? '__none__';
      const svcs = staffSvcMap[key] ?? [];
      const serviceRows = svcs.map(svc =>
        `<tr><td>${svc.service_name}</td><td>${svc.completed}</td><td>${fmtMoney(Number(svc.avg_price), currency)}</td><td>${fmtMoney(Number(svc.revenue), currency)}</td></tr>`
      ).join('');
      return `
        <h3 style="margin:14px 0 4px;font-size:12px">${staffRow.staff_name}</h3>
        <table>
          <thead><tr><th>Usluga</th><th>Broj</th><th>Prosj. cijena</th><th>Ukupno</th></tr></thead>
          <tbody>${serviceRows}</tbody>
          <tfoot><tr><td><strong>Ukupno</strong></td><td><strong>${staffRow.completed}</strong></td><td></td><td>${fmtMoney(Number(staffRow.revenue), currency)}</td></tr></tfoot>
        </table>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;margin:16px;color:#111}
  h2{font-size:14px;margin-bottom:12px}
  table{border-collapse:collapse;width:100%;margin-bottom:8px}
  th,td{border:1px solid #ccc;padding:4px 8px;text-align:right}
  th{background:#f0f0f0;font-size:10px}
  th:first-child,td:first-child{text-align:left}
  tfoot td{background:#f5f5f5}
  .grand{border-top:2px solid #333;margin-top:16px;padding-top:8px;font-weight:bold;font-size:12px}
  @media print{@page{margin:10mm}}
</style></head><body>
<h2>${title}</h2>
${staffBlocks}
<div class="grand">Ukupno: ${summary.completed} termina &nbsp;·&nbsp; ${fmtMoney(Number(summary.revenue), currency)}</div>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  if (data?.ok === false && data?.error === 'not_authorized') {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        {t('bookingAnalytics.noPermission')}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <BusinessBookingNav active="analytics" />

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-primary/10 shrink-0">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-foreground leading-tight">
            {t('bookingAnalytics.title')}
          </h1>
          <p className="text-xs text-muted-foreground">{t('bookingAnalytics.subtitle')}</p>
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

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
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
            <span className="text-xs text-muted-foreground">{t('bookingAnalytics.dateFrom')}</span>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground" />
            <span className="text-xs text-muted-foreground">{t('bookingAnalytics.dateTo')}</span>
            <input type="date" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)}
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground" />
          </div>
        )}

        {/* Location + Staff dropdowns */}
        {(locations.length > 1 || staffList.length > 1) && (
          <div className="flex gap-2 flex-wrap">
            {locations.length > 1 && (
              <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 py-1.5">
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                <select value={locationId} onChange={e => { setLocationId(e.target.value); setStaffId(''); }}
                  className="text-xs bg-transparent text-foreground outline-none">
                  <option value="">{t('bookingAnalytics.allLocations')}</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}
            {staffList.length > 1 && (
              <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 py-1.5">
                <User className="h-3 w-3 text-muted-foreground shrink-0" />
                <select value={staffId} onChange={e => setStaffId(e.target.value)}
                  className="text-xs bg-transparent text-foreground outline-none">
                  <option value="">{t('bookingAnalytics.allStaff')}</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
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
          {/* Empty state */}
          {summary.completed === 0 && (
            <div className="text-center text-sm text-muted-foreground py-6 border border-dashed border-border rounded-2xl">
              {t('bookingAnalytics.empty')}
            </div>
          )}

          {summary.completed > 0 && (
            <div className="space-y-4">
              {/* ── Per-staff cards ──────────────────────────────────────── */}
              {byStaff.filter(s => s.completed > 0).map(staffRow => {
                const key      = staffRow.staff_member_id ?? '__none__';
                const services = staffSvcMap[key] ?? [];

                return (
                  <div key={key} className="border border-border rounded-2xl overflow-hidden bg-card">
                    {/* Staff name header */}
                    <div className="px-4 py-3 border-b border-border bg-muted/40">
                      <p className="text-sm font-semibold text-foreground">
                        {staffRow.staff_name || t('bookingAnalytics.staffNoName')}
                      </p>
                    </div>

                    {/* Service table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/60">
                            <th className="text-left text-muted-foreground font-medium px-4 py-2">
                              {t('bookingAnalytics.col.service')}
                            </th>
                            <th className="text-right text-muted-foreground font-medium px-3 py-2 whitespace-nowrap">
                              {t('bookingAnalytics.col.count')}
                            </th>
                            <th className="text-right text-muted-foreground font-medium px-3 py-2 whitespace-nowrap">
                              {t('bookingAnalytics.col.price')}
                            </th>
                            <th className="text-right text-muted-foreground font-medium px-4 py-2 whitespace-nowrap">
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
                                {fmtMoney(svc.avg_price, currency, currency)}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-foreground font-semibold whitespace-nowrap">
                                {fmtMoney(svc.revenue, currency, currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {/* Staff total row */}
                        <tfoot>
                          <tr className="border-t border-border bg-muted/30">
                            <td className="px-4 py-2.5 text-xs font-semibold text-foreground">
                              {t('bookingAnalytics.staffTotal')}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-foreground font-semibold">
                              {staffRow.completed}
                            </td>
                            <td className="px-3 py-2.5" />
                            <td className="px-4 py-2.5 text-right tabular-nums text-primary font-bold text-sm whitespace-nowrap">
                              {fmtMoney(staffRow.revenue, currency, currency)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* ── Grand total ──────────────────────────────────────────── */}
              <div className="border border-primary/30 rounded-2xl overflow-hidden bg-primary/5">
                <div className="px-4 py-3 flex items-center justify-between gap-4">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    {t('bookingAnalytics.grandTotal')}
                  </span>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {summary.completed}&nbsp;×
                    </span>
                    <span className="text-base font-bold text-primary tabular-nums">
                      {fmtMoney(summary.revenue, currency, currency)}
                    </span>
                  </div>
                </div>
                {/* No-show note — small, secondary */}
                {summary.no_shows > 0 && (
                  <div className="px-4 pb-2.5 text-[11px] text-muted-foreground">
                    {summary.no_shows} {t('bookingAnalytics.noShowsNote')}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
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
