'use client';

import { useEffect, useState, useCallback } from 'react';
import { useLanguage } from '@/lib/contexts/language-context';
import { friendlyError } from '@/lib/utils/friendly-error';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeDashboardLayout } from '@/components/trade/TradeDashboardLayout';
import { supabase } from '@/lib/supabase/client';
import {
  BarChart3, TrendingUp, Wrench, FileText, AlertCircle, Loader2,
  BanknoteIcon, Package, Fuel, ClipboardList, Zap, Download,
} from 'lucide-react';
import { toCsvRow, downloadCsv } from '@/lib/utils/export-utils';

// ── Types ──────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month' | 'year' | 'last_year' | 'custom';

type Summary = {
  total_jobs: number;
  completed: number;
  cancelled: number;
  in_progress: number;
  invoiced: number;
  total_revenue: number | null;
  total_labor_cost: number | null;
  total_materials_cost: number | null;
  total_expenses: number | null;
  gross_profit: number | null;
};

type StatusRow = { status: string; count: number };
type OriginRow = { origin_type: string; count: number };
type ExpenseRow = { expense_type: string; total: number };

type RequestFunnel = {
  total: number;
  open: number;
  quoted: number;
  accepted: number;
  completed: number;
  cancelled: number;
};

type AnalyticsResult = {
  ok: boolean;
  error?: string;
  currency: string;
  can_view_financials: boolean;
  summary: Summary;
  by_status: StatusRow[];
  by_origin_type: OriginRow[];
  expenses_by_type: ExpenseRow[] | null;
  request_funnel: RequestFunnel;
  emergency_requests: number;
};

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

function currencySymbol(c: string): string {
  if (c === 'EUR') return '€';
  if (c === 'USD') return '$';
  if (c === 'GBP') return '£';
  return c; // BAM, RSD, HRK, etc.
}

function fmt(n: number | null, currency = 'BAM'): string {
  if (n === null) return '—';
  const sym = currencySymbol(currency);
  const val = n % 1 === 0
    ? n.toLocaleString('bs-BA')
    : n.toLocaleString('bs-BA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym} ${val}`;
}

function fmtN(n: number): string {
  return n.toLocaleString('bs-BA');
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TradeAnalyticsPage() {
  const { profileId } = useParams() as { profileId: string };
  const { t } = useLanguage();
  const { user } = useAuth();
  const { setActiveProfileId } = useBookingProfile();

  const [period, setPeriod]         = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [data, setData]             = useState<AnalyticsResult | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    setActiveProfileId(profileId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const load = useCallback(async () => {
    if (!user || !profileId) return;
    const { from, to } = getPeriodRange(period, customFrom, customTo);
    if (!from || !to) return;
    setLoading(true);
    setError('');
    const { data: res } = await (supabase as any).rpc('get_trade_analytics', {
      p_business_id: profileId,
      p_date_from:   from,
      p_date_to:     to,
    });
    if (res?.ok) {
      setData(res as AnalyticsResult);
    } else {
      setError(friendlyError(res?.error, t));
    }
    setLoading(false);
  }, [profileId, user, period, customFrom, customTo]);

  useEffect(() => {
    if (period !== 'custom') load();
  }, [period, load]);

  const periods: { key: Period; label: string }[] = [
    { key: 'today',     label: t('trade.analytics.period.today') },
    { key: 'week',      label: t('trade.analytics.period.week') },
    { key: 'month',     label: t('trade.analytics.period.month') },
    { key: 'year',      label: t('trade.analytics.period.year') },
    { key: 'last_year', label: t('trade.analytics.period.lastYear') },
    { key: 'custom',    label: t('trade.analytics.period.custom') },
  ];

  const expenseIcons: Record<string, React.ReactNode> = {
    fuel:          <Fuel className="w-4 h-4" />,
    tool:          <Wrench className="w-4 h-4" />,
    subcontractor: <ClipboardList className="w-4 h-4" />,
    parking:       <BarChart3 className="w-4 h-4" />,
    other:         <Package className="w-4 h-4" />,
  };

  const s = data?.summary;
  const currency = data?.currency ?? 'BAM';

  function exportCsv() {
    if (!data || !s) return;
    function row(...cells: (string | number | null | undefined)[]): string {
      return toCsvRow(cells);
    }
    const lines: string[] = ['﻿'];
    lines.push(row('Metric', 'Value'));
    lines.push(row(t('trade.analytics.summary.totalJobs'), s.total_jobs));
    lines.push(row(t('trade.analytics.summary.completed'), s.completed));
    lines.push(row(t('trade.analytics.summary.cancelled'), s.cancelled));
    lines.push(row(t('trade.analytics.summary.inProgress'), s.in_progress));
    lines.push(row(t('trade.analytics.summary.invoiced'), s.invoiced));
    if (data.can_view_financials) {
      lines.push(row(t('trade.analytics.summary.revenue'), s.total_revenue !== null ? `${s.total_revenue} ${currency}` : ''));
      lines.push(row(t('trade.analytics.summary.grossProfit'), s.gross_profit !== null ? `${s.gross_profit} ${currency}` : ''));
      lines.push(row(t('trade.analytics.summary.laborCost'), s.total_labor_cost !== null ? `${s.total_labor_cost} ${currency}` : ''));
      lines.push(row(t('trade.analytics.summary.materialsCost'), s.total_materials_cost !== null ? `${s.total_materials_cost} ${currency}` : ''));
      lines.push(row(t('trade.analytics.summary.expenses'), s.total_expenses !== null ? `${s.total_expenses} ${currency}` : ''));
    }
    if (data.by_status.length > 0) {
      lines.push('');
      lines.push(row(t('trade.analytics.byStatus.title'), ''));
      lines.push(row('Status', 'Count'));
      for (const r of data.by_status) lines.push(row(r.status, r.count));
    }
    if (data.by_origin_type.length > 0) {
      lines.push('');
      lines.push(row(t('trade.analytics.byOrigin.title'), ''));
      lines.push(row('Origin', 'Count'));
      for (const r of data.by_origin_type) lines.push(row(r.origin_type, r.count));
    }
    if (data.can_view_financials && data.expenses_by_type?.length) {
      lines.push('');
      lines.push(row(t('trade.analytics.expensesByType.title'), ''));
      lines.push(row('Type', 'Total'));
      for (const r of data.expenses_by_type) lines.push(row(r.expense_type, `${r.total} ${currency}`));
    }
    lines.push('');
    lines.push(row(t('trade.analytics.funnel.title'), ''));
    lines.push(row('Stage', 'Count'));
    const f = data.request_funnel;
    lines.push(row(t('trade.analytics.funnel.total'), f.total));
    lines.push(row(t('trade.analytics.funnel.open'), f.open));
    lines.push(row(t('trade.analytics.funnel.quoted'), f.quoted));
    lines.push(row(t('trade.analytics.funnel.accepted'), f.accepted));
    lines.push(row(t('trade.analytics.funnel.completed'), f.completed));
    lines.push(row(t('trade.analytics.funnel.cancelled'), f.cancelled));
    lines.push(row(t('trade.analytics.funnel.emergency'), data.emergency_requests));
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`analytics-${date}.csv`, lines.join('\r\n'));
  }

  return (
    <TradeDashboardLayout profileId={profileId} active="analytics">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-foreground">{t('trade.analytics.title')}</h1>
        {data && (
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title={t('trade.export.csvAnalytics')}
          >
            <Download className="w-3.5 h-3.5" />
            {t('trade.export.csv')}
          </button>
        )}
      </div>

      {/* Period picker */}
      <div className="flex flex-wrap gap-2 mb-4">
        {periods.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              period === p.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="flex flex-wrap gap-2 mb-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{t('trade.analytics.period.from')}</label>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{t('trade.analytics.period.to')}</label>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <button
            onClick={load}
            disabled={!customFrom || !customTo || loading}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('trade.analytics.apply')}
          </button>
        </div>
      )}

      {loading && !data && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-4">

          {/* Financial restriction banner */}
          {!data.can_view_financials && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {t('trade.analytics.noFinancials')}
            </div>
          )}

          {/* Job summary tiles */}
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              icon={<Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
              iconBg="bg-blue-100 dark:bg-blue-950"
              label={t('trade.analytics.summary.totalJobs')}
              value={fmtN(s?.total_jobs ?? 0)}
            />
            <StatTile
              icon={<TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />}
              iconBg="bg-green-100 dark:bg-green-950"
              label={t('trade.analytics.summary.completed')}
              value={fmtN(s?.completed ?? 0)}
            />
            <StatTile
              icon={<FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
              iconBg="bg-purple-100 dark:bg-purple-950"
              label={t('trade.analytics.summary.invoiced')}
              value={fmtN(s?.invoiced ?? 0)}
            />
            <StatTile
              icon={<BarChart3 className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
              iconBg="bg-orange-100 dark:bg-orange-950"
              label={t('trade.analytics.summary.inProgress')}
              value={fmtN(s?.in_progress ?? 0)}
            />
          </div>

          {/* Financial tiles — shown only if can_view_financials */}
          {data.can_view_financials && (
            <div className="grid grid-cols-2 gap-3">
              <FinTile
                icon={<BanknoteIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
                iconBg="bg-emerald-100 dark:bg-emerald-950"
                label={t('trade.analytics.summary.revenue')}
                value={fmt(s?.total_revenue ?? null, currency)}
                highlight
              />
              <FinTile
                icon={<TrendingUp className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
                iconBg="bg-teal-100 dark:bg-teal-950"
                label={t('trade.analytics.summary.grossProfit')}
                value={fmt(s?.gross_profit ?? null, currency)}
                positive={s?.gross_profit != null ? s.gross_profit >= 0 : null}
              />
              <FinTile
                icon={<Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                iconBg="bg-blue-100 dark:bg-blue-950"
                label={t('trade.analytics.summary.laborCost')}
                value={fmt(s?.total_labor_cost ?? null, currency)}
              />
              <FinTile
                icon={<Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
                iconBg="bg-indigo-100 dark:bg-indigo-950"
                label={t('trade.analytics.summary.materialsCost')}
                value={fmt(s?.total_materials_cost ?? null, currency)}
              />
              <FinTile
                icon={<Fuel className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
                iconBg="bg-rose-100 dark:bg-rose-950"
                label={t('trade.analytics.summary.expenses')}
                value={fmt(s?.total_expenses ?? null, currency)}
                wide
              />
            </div>
          )}

          {/* Status breakdown */}
          {data.by_status.length > 0 && (
            <SectionCard title={t('trade.analytics.byStatus.title')}>
              <div className="flex flex-col gap-2">
                {data.by_status.map(row => (
                  <div key={row.status} className="flex items-center justify-between">
                    <span className="text-sm text-foreground capitalize">
                      {t(`trade.analytics.status.${row.status}` as any) || row.status}
                    </span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">{fmtN(row.count)}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Origin breakdown */}
          {data.by_origin_type.length > 0 && (
            <SectionCard title={t('trade.analytics.byOrigin.title')}>
              <div className="flex flex-col gap-2">
                {data.by_origin_type.map(row => (
                  <div key={row.origin_type} className="flex items-center justify-between">
                    <span className="text-sm text-foreground capitalize">
                      {t(`trade.analytics.origin.${row.origin_type}` as any) || row.origin_type}
                    </span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">{fmtN(row.count)}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Expenses by type */}
          {data.can_view_financials && data.expenses_by_type && data.expenses_by_type.length > 0 && (
            <SectionCard title={t('trade.analytics.expensesByType.title')}>
              <div className="flex flex-col gap-2">
                {data.expenses_by_type.map(row => (
                  <div key={row.expense_type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <span className="text-muted-foreground">{expenseIcons[row.expense_type]}</span>
                      {t(`trade.analytics.expensesByType.${row.expense_type}` as any) || row.expense_type}
                    </div>
                    <span className="text-sm font-semibold text-foreground tabular-nums">{fmt(row.total, currency)}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Request funnel */}
          <SectionCard title={t('trade.analytics.funnel.title')}>
            <div className="flex flex-col gap-2">
              <FunnelRow label={t('trade.analytics.funnel.total')}     value={data.request_funnel.total} />
              <FunnelRow label={t('trade.analytics.funnel.open')}      value={data.request_funnel.open} sub />
              <FunnelRow label={t('trade.analytics.funnel.quoted')}    value={data.request_funnel.quoted} sub />
              <FunnelRow label={t('trade.analytics.funnel.accepted')}  value={data.request_funnel.accepted} sub />
              <FunnelRow label={t('trade.analytics.funnel.completed')} value={data.request_funnel.completed} sub positive />
              <FunnelRow label={t('trade.analytics.funnel.cancelled')} value={data.request_funnel.cancelled} sub negative />
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Zap className="w-4 h-4 text-red-500" />
                {t('trade.analytics.funnel.emergency')}
              </div>
              <span className="text-sm font-semibold text-foreground tabular-nums">{fmtN(data.emergency_requests)}</span>
            </div>
          </SectionCard>

        </div>
      )}

      {!loading && !data && !error && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {t('trade.analytics.noData')}
        </div>
      )}
    </TradeDashboardLayout>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatTile({
  icon, iconBg, label, value,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
}) {
  return (
    <div className="p-3.5 rounded-xl border border-border bg-card flex items-center gap-3">
      <div className={`p-2 rounded-xl ${iconBg} shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold text-foreground tabular-nums leading-tight">{value}</p>
      </div>
    </div>
  );
}

function FinTile({
  icon, iconBg, label, value, highlight = false, positive = null, wide = false,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  highlight?: boolean;
  positive?: boolean | null;
  wide?: boolean;
}) {
  const valueColor = positive === true
    ? 'text-emerald-600 dark:text-emerald-400'
    : positive === false
    ? 'text-red-600 dark:text-red-400'
    : 'text-foreground';
  return (
    <div className={`p-3.5 rounded-xl border bg-card flex items-center gap-3 ${highlight ? 'border-emerald-300 dark:border-emerald-700' : 'border-border'} ${wide ? 'col-span-2' : ''}`}>
      <div className={`p-2 rounded-xl ${iconBg} shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className={`text-base font-bold tabular-nums leading-tight ${valueColor}`}>{value}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-card">
      <p className="text-sm font-semibold text-foreground mb-3">{title}</p>
      {children}
    </div>
  );
}

function FunnelRow({
  label, value, sub = false, positive = false, negative = false,
}: {
  label: string;
  value: number;
  sub?: boolean;
  positive?: boolean;
  negative?: boolean;
}) {
  const color = positive
    ? 'text-emerald-600 dark:text-emerald-400'
    : negative
    ? 'text-red-600 dark:text-red-400'
    : 'text-foreground';
  return (
    <div className={`flex items-center justify-between ${sub ? 'pl-3' : ''}`}>
      <span className={`text-sm ${sub ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${color}`}>{value.toLocaleString('bs-BA')}</span>
    </div>
  );
}
