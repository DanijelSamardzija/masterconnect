'use client';

import { useMemo, useState } from 'react';
import {
  Activity, BarChart2, CalendarDays, ExternalLink, Eye,
  Loader2, MapPin, MessageSquare, RefreshCw, Search, Shield,
  Sparkles, Star, TrendingDown, TrendingUp, Users, UserX, X,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { AnalyticsCard } from '../analytics/AnalyticsCard';
import { AnalyticsBarRow } from '../analytics/AnalyticsBarRow';
import { AnalyticsBarChart } from '../analytics/AnalyticsBarChart';
import { AnalyticsSection } from '../analytics/AnalyticsSection';
import { ActivationFunnel } from '../analytics/ActivationFunnel';
import { ExportPanel } from '../analytics/ExportPanel';
import { AnalyticsData, DatePreset, DateRange, FunnelStep, InvestStats } from '../types';
import { COUNTRY_FLAGS, POST_TYPE_LABELS, REASON_LABELS } from '../constants';
import { timeAgo } from '@/lib/utils/date';

interface Props {
  analytics: AnalyticsData | null;
  analyticsLoading: boolean;
  dateRange: DateRange;
  investStats: InvestStats | null;
  investLoading: boolean;
  onFetchAnalytics: (range: DateRange) => void;
  onFetchInvestStats: () => void;
}

// ── Local constants ────────────────────────────────────────────────────────

const INVEST_ROLE_LABELS: Record<string, string> = {
  investor: 'Investitor',
  business_owner: 'Vlasnik biznisa',
  startup_founder: 'Osnivač startapa',
  service_business: 'Servisni biznis',
};

const INVEST_ROLE_COLORS: Record<string, string> = {
  investor: 'bg-orange-500',
  business_owner: 'bg-blue-500',
  startup_founder: 'bg-purple-500',
  service_business: 'bg-emerald-500',
};

const SIGNUP_SOURCE_COLORS: Record<string, string> = {
  join_page: 'bg-orange-500',
  homepage: 'bg-blue-500',
  guest_gate: 'bg-purple-500',
  direct: 'bg-slate-400',
};

const SIGNUP_SOURCE_LABELS: Record<string, string> = {
  join_page: 'Join stranica',
  homepage: 'Početna',
  guest_gate: 'Guest gate',
  direct: 'Direktno',
};

const UTM_COLORS: Record<string, string> = {
  facebook: 'bg-blue-600',
  instagram: 'bg-pink-500',
  google: 'bg-yellow-500',
  tiktok: 'bg-slate-800',
};

const UTM_ICONS: Record<string, string> = {
  facebook: '📘',
  instagram: '📸',
  google: '🔍',
  tiktok: '🎵',
};

const CONTENT_PERIOD_LABELS = {
  today: 'Danas',
  week: 'Sedmica',
  month: 'Mjesec',
} as const;
type ContentPeriod = keyof typeof CONTENT_PERIOD_LABELS;

const REPORT_STATUS_BADGE: Record<string, string> = {
  open:     'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  reviewed: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
};
const REPORT_STATUS_BAR: Record<string, string> = {
  open: 'bg-red-500', reviewed: 'bg-yellow-500', resolved: 'bg-green-500',
};
const REPORT_STATUS_LABELS: Record<string, string> = {
  open: 'Otvoreni', reviewed: 'Pregledano', resolved: 'Riješeni',
};

const POST_TYPE_ORDER = ['social_post', 'service_listing', 'hiring_post', 'service_request', 'job_seeker_post'];

const CHURN_REASON_LABELS: Record<string, string> = {
  nisam_nasao_posao:         'Nisam pronašao posao',
  nema_oglasa:                'Nema dovoljno oglasa',
  nema_korisnika:            'Nema dovoljno korisnika',
  novi_nalog:                 'Novi nalog',
  presao_na_drugu_platformu: 'Druga platforma',
  privremeno_odlazim:        'Privremeno odlazim',
  komplikovana_aplikacija:   'Komplikovana aplikacija',
  tehnicki_problem:          'Tehnički problem',
  privatnost:                 'Zabrinutost za privatnost',
  ostalo:                     'Drugo',
};

const PRESET_META: Record<DatePreset, { label: string }> = {
  '7d':     { label: '7 dana'     },
  '30d':    { label: '30 dana'    },
  '90d':    { label: '90 dana'    },
  'year':   { label: 'Ova godina' },
  'custom': { label: 'Custom'     },
};

const GEO_LIMIT = 100;

// ── Helpers ────────────────────────────────────────────────────────────────

const normalizeStr = (s: string) =>
  s.toLowerCase().replace(/đ/g, 'dj').normalize('NFD').replace(/[̀-ͯ]/g, '');

function buildDateRange(preset: DatePreset, customFrom?: string, customTo?: string, year?: number): DateRange {
  const today = new Date();
  const pad   = (n: number) => String(n).padStart(2, '0');
  const fmt   = (d: Date)   => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayStr = fmt(today);
  if (preset === '7d')  return { preset, from: fmt(new Date(Date.now() - 6  * 86400000)), to: todayStr };
  if (preset === '30d') return { preset, from: fmt(new Date(Date.now() - 29 * 86400000)), to: todayStr };
  if (preset === '90d') return { preset, from: fmt(new Date(Date.now() - 89 * 86400000)), to: todayStr };
  if (preset === 'year') {
    const y = year ?? today.getFullYear();
    return { preset, from: `${y}-01-01`, to: `${y}-12-31`, year: y };
  }
  return { preset: 'custom', from: customFrom ?? fmt(new Date(Date.now() - 29 * 86400000)), to: customTo ?? todayStr };
}

function DeltaBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0 && current === 0) return <span className="text-[10px] text-muted-foreground">—</span>;
  const delta = prev === 0 ? 100 : Math.round(((current - prev) / prev) * 100);
  const up    = delta >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
      up ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
         : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
    }`}>
      {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {up ? '+' : ''}{delta}%
    </span>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
        {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function AnalyticsTab({
  analytics,
  analyticsLoading,
  dateRange,
  investStats,
  investLoading,
  onFetchAnalytics,
  onFetchInvestStats,
}: Props) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2024 + 1 }, (_, i) => 2025 + i);

  const [citySearch,          setCitySearch]         = useState('');
  const [countrySearch,       setCountrySearch]      = useState('');
  const [citySortAlpha,       setCitySortAlpha]      = useState(false);
  const [countrySortAlpha,    setCountrySortAlpha]   = useState(false);
  const [contentPeriod,       setContentPeriod]      = useState<ContentPeriod>('today');
  const [churnCountrySearch,  setChurnCountrySearch] = useState('');
  const [customFrom,          setCustomFrom]         = useState('');
  const [customTo,            setCustomTo]           = useState('');

  // ── Derived ──────────────────────────────────────────────────────────────

  const isYearPreset = dateRange.preset === 'year';
  const selectedYear = dateRange.year ?? currentYear;

  const filteredCities = useMemo(() => {
    if (!analytics) return [];
    const q = normalizeStr(citySearch);
    return analytics.topCities
      .filter(c => normalizeStr(c.city).includes(q))
      .sort(citySortAlpha ? (a, b) => a.city.localeCompare(b.city, 'sr') : (a, b) => b.count - a.count)
      .slice(0, GEO_LIMIT);
  }, [analytics, citySearch, citySortAlpha]);

  const filteredCountries = useMemo(() => {
    if (!analytics) return [];
    const q = normalizeStr(countrySearch);
    return analytics.topCountries
      .filter(c => normalizeStr(c.country).includes(q))
      .sort(countrySortAlpha ? (a, b) => a.country.localeCompare(b.country, 'sr') : (a, b) => b.count - a.count)
      .slice(0, GEO_LIMIT);
  }, [analytics, countrySearch, countrySortAlpha]);

  const maxCityCount    = useMemo(() => filteredCities.reduce((m, c) => Math.max(m, c.count), 1),    [filteredCities]);
  const maxCountryCount = useMemo(() => filteredCountries.reduce((m, c) => Math.max(m, c.count), 1), [filteredCountries]);

  const totalCityUsers    = analytics?.topCities.reduce((s, c)    => s + c.count, 0) || 1;
  const totalCountryUsers = analytics?.topCountries.reduce((s, c) => s + c.count, 0) || 1;

  const newUsersToday   = analytics?.dailyNewUsers.at(-1)?.count ?? 0;
  const newPostsToday   = analytics ? Object.values(analytics.contentStats.todayByType).reduce((s, n) => s + n, 0) : 0;
  const newReportsToday = analytics?.reportAnalytics.dailyTrend.at(-1)?.count ?? 0;

  const currentContentData = useMemo(() => {
    if (!analytics) return {} as Record<string, number>;
    return contentPeriod === 'today' ? analytics.contentStats.todayByType
      : contentPeriod === 'week'    ? analytics.contentStats.weekByType
      : analytics.contentStats.monthByType;
  }, [analytics, contentPeriod]);

  const contentTotal = useMemo(() =>
    Object.values(currentContentData).reduce((s, n) => s + n, 0), [currentContentData]);

  const contentEntries = useMemo(() => {
    const known = POST_TYPE_ORDER.filter(k => currentContentData[k]).map(k => ({ type: k, count: currentContentData[k] }));
    const other = Object.entries(currentContentData).filter(([k]) => !POST_TYPE_ORDER.includes(k)).map(([k, v]) => ({ type: k, count: v }));
    return [...known, ...other];
  }, [currentContentData]);

  const maxContentCount = useMemo(() =>
    contentEntries.reduce((m, e) => Math.max(m, e.count), 1), [contentEntries]);

  const showDailyTrend = !isYearPreset && !!analytics && analytics.dailyNewUsers.length <= 90;

  // Churn rate: range deletions / relevant active user count
  const churnActiveBase =
    dateRange.preset === '7d'   ? (analytics?.wau ?? 0) :
    dateRange.preset === 'year' ? (analytics?.yau ?? 0) :
    (analytics?.mau ?? 0);
  const churnRate = churnActiveBase > 0 && analytics
    ? ((analytics.churnData.rangeDeleted / churnActiveBase) * 100).toFixed(1)
    : '0.0';

  const filteredChurnCountries = useMemo(() => {
    if (!analytics) return [];
    const q = normalizeStr(churnCountrySearch);
    return analytics.churnData.byCountry
      .filter(c => normalizeStr(c.country).includes(q))
      .slice(0, 50);
  }, [analytics, churnCountrySearch]);

  const maxChurnCountry = useMemo(() =>
    filteredChurnCountries.reduce((m, c) => Math.max(m, c.count), 1),
  [filteredChurnCountries]);

  const maxChurnReason = useMemo(() =>
    analytics ? analytics.churnData.byReason.reduce((m, r) => Math.max(m, r.count), 1) : 1,
  [analytics]);

  const funnelSteps = useMemo((): FunnelStep[] => [
    { key: 'visitor',       label: 'Posjetilac',   sublabel: 'Anonimni posjet',      count: 0,                                      available: false, color: 'bg-slate-400'  },
    { key: 'registered',    label: 'Registrovan',  sublabel: 'Kreiran nalog',         count: analytics?.funnel.registeredUsers ?? 0, available: true,  color: 'bg-orange-500' },
    { key: 'posted',        label: 'Objavio post', sublabel: 'Bar 1 objava',          count: analytics?.funnel.usersWithPost  ?? 0,  available: true,  color: 'bg-purple-500' },
    { key: 'active30d',     label: 'Aktivan 30d',  sublabel: 'U poslednjih 30 dana',  count: analytics?.mau                   ?? 0,  available: true,  color: 'bg-green-500'  },
    { key: 'first_message', label: 'Prva poruka',  sublabel: 'Pokrenuo razgovor',     count: 0,                                      available: false, color: 'bg-slate-400'  },
  ], [analytics]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handlePreset = (preset: DatePreset) => {
    if (preset === 'year') { onFetchAnalytics(buildDateRange('year', undefined, undefined, selectedYear)); return; }
    if (preset === 'custom') return; // wait for user to fill in dates
    onFetchAnalytics(buildDateRange(preset));
  };

  const handleCustomApply = () => {
    if (!customFrom || !customTo || customFrom > customTo) return;
    onFetchAnalytics(buildDateRange('custom', customFrom, customTo));
  };

  const periodLabel = isYearPreset
    ? `${selectedYear}. godina`
    : `${dateRange.from.slice(5).replace('-', '/')} — ${dateRange.to.slice(5).replace('-', '/')}`;

  return (
    <div className="space-y-6">

      {/* ── Phase 18: Global Date Filter ─────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Period:</span>
          <div className="flex gap-1.5 flex-wrap">
            {(Object.keys(PRESET_META) as DatePreset[]).map(p => (
              <button
                key={p}
                onClick={() => { if (p === 'custom') setCustomFrom(''); else handlePreset(p); }}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  dateRange.preset === p
                    ? 'bg-orange-500 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {PRESET_META[p].label}
              </button>
            ))}
          </div>
          <button
            onClick={() => onFetchAnalytics(dateRange)}
            disabled={analyticsLoading}
            className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${analyticsLoading ? 'animate-spin' : ''}`} />
            Osvježi
          </button>
        </div>

        {/* Year selector */}
        {isYearPreset && (
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border">
            <span className="text-xs text-muted-foreground">Godina:</span>
            {years.map(year => (
              <button
                key={year}
                onClick={() => onFetchAnalytics(buildDateRange('year', undefined, undefined, year))}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  selectedYear === year
                    ? 'bg-orange-500 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        )}

        {/* Custom date inputs */}
        {dateRange.preset === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="px-2 py-1 text-xs bg-muted border border-border rounded-xl outline-none focus:border-orange-500/50" />
            <span className="text-xs text-muted-foreground">do</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="px-2 py-1 text-xs bg-muted border border-border rounded-xl outline-none focus:border-orange-500/50" />
            <button
              onClick={handleCustomApply}
              disabled={!customFrom || !customTo || customFrom > customTo}
              className="px-3 py-1 text-xs font-semibold bg-orange-500 text-white rounded-full disabled:opacity-40 hover:bg-orange-600 transition-colors"
            >
              Primijeni
            </button>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          Aktivni period: <span className="font-semibold text-foreground">{periodLabel}</span>
          {' · '}marketing, sadržaj i reportovi su filtrirani ovim periodom
        </p>
      </div>

      {analyticsLoading ? (
        <AnalyticsSkeleton />
      ) : analytics ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {[
              { label: 'Aktivni danas',      value: analytics.dau,               icon: Activity,     color: 'text-green-500',  tooltip: 'Korisnici koji su imali aktivnost u poslednjih 24h' },
              { label: 'Aktivni (7 dana)',   value: analytics.wau,               icon: TrendingUp,   color: 'text-blue-500',   tooltip: 'Jedinstveni korisnici aktivni u poslednjih 7 dana' },
              { label: 'Aktivni (30 dana)',  value: analytics.mau,               icon: Users,        color: 'text-purple-500', tooltip: 'Jedinstveni korisnici aktivni u poslednjih 30 dana' },
              { label: 'Aktivni (godišnje)', value: analytics.yau,               icon: TrendingUp,   color: 'text-indigo-500', tooltip: `Aktivni korisnici u ${selectedYear}. godini` },
              { label: 'Novi ove sedmice',   value: analytics.newUsersThisWeek,  icon: CalendarDays, color: 'text-orange-500', tooltip: 'Novoregistrovani korisnici u poslednjih 7 dana' },
              { label: 'Novi ovog mjeseca',  value: analytics.newUsersThisMonth, icon: CalendarDays, color: 'text-pink-500',   tooltip: 'Novoregistrovani od početka tekućeg mjeseca' },
              { label: 'Novi ove godine',    value: analytics.newUsersThisYear,  icon: CalendarDays, color: 'text-rose-500',   tooltip: `Ukupno novih korisnika u ${selectedYear}. godini` },
            ].map(({ label, value, icon, color, tooltip }) => (
              <AnalyticsCard key={label} icon={icon} value={value} label={label} color={color} tooltip={tooltip} />
            ))}
          </div>

          {/* ── Phase 3: Period comparison ─────────────────────────────── */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-foreground">Poređenje perioda — {periodLabel}</h3>
              <span className="text-[10px] text-muted-foreground ml-auto">vs prethodni ekvivalentni period</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Novi korisnici',  current: analytics.comparison.rangeNewUsers,   prev: analytics.comparison.prevRangeNewUsers,   color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30' },
                { label: 'Novi postovi',    current: analytics.comparison.rangeNewPosts,   prev: analytics.comparison.prevRangeNewPosts,   color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30' },
                { label: 'Novi razgovori',  current: analytics.comparison.rangeNewThreads, prev: analytics.comparison.prevRangeNewThreads, color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-950/30' },
              ].map(({ label, current, prev, color, bg }) => (
                <div key={label} className={`rounded-2xl p-3 ${bg}`}>
                  <p className={`text-2xl font-black ${color}`}>{current}</p>
                  <p className="text-[11px] text-muted-foreground mb-1.5">{label}</p>
                  <DeltaBadge current={current} prev={prev} />
                  <p className="text-[9px] text-muted-foreground mt-0.5">preth: {prev}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Activation Funnel ─────────────────────────────────────── */}
          <AnalyticsSection icon={Users} iconColor="text-orange-500" title="Activation Funnel — konverzija korisnika">
            <ActivationFunnel steps={funnelSteps} />
          </AnalyticsSection>

          {/* Today's activity snapshot */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: 'Novih korisnika danas', value: newUsersToday,   color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800' },
              { label: 'Novih postova danas',   value: newPostsToday,   color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800' },
              { label: 'Novih reportova danas', value: newReportsToday, color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`border rounded-2xl p-3 text-center ${bg}`}>
                <p className={`text-2xl font-black ${color}`}>{value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-snug">{label}</p>
              </div>
            ))}
          </div>

          {/* Page views + Content stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnalyticsSection icon={BarChart2} title="Pregledi po stranicama">
              {analytics.pageViews.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nema podataka</p>
              ) : (
                <div className="space-y-2">
                  {analytics.pageViews.map(({ page, count }) => (
                    <AnalyticsBarRow key={page} label={page} count={count} maxCount={analytics.pageViews[0]?.count || 1} />
                  ))}
                </div>
              )}
            </AnalyticsSection>

            <AnalyticsSection icon={BarChart2} iconColor="text-purple-500" title="Novi sadržaj po tipu">
              <div className="flex rounded-xl border border-border overflow-hidden text-xs font-semibold mb-3">
                {(Object.entries(CONTENT_PERIOD_LABELS) as [ContentPeriod, string][]).map(([key, lbl]) => (
                  <button key={key} onClick={() => setContentPeriod(key)}
                    className={`flex-1 px-2 py-1.5 transition-colors ${contentPeriod === key ? 'bg-orange-500 text-white' : 'text-muted-foreground hover:bg-muted'}`}>
                    {lbl}
                  </button>
                ))}
              </div>
              {contentTotal === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nema novih postova</p>
              ) : (
                <div className="space-y-2">
                  {contentEntries.map(({ type, count }) => {
                    const pct = contentTotal > 0 ? Math.round((count / contentTotal) * 100) : 0;
                    return (
                      <AnalyticsBarRow key={type} label={POST_TYPE_LABELS[type] || type} count={count}
                        maxCount={maxContentCount} color="bg-purple-500" suffix={` (${pct}%)`} />
                    );
                  })}
                  <p className="text-xs text-muted-foreground text-right pt-1">Ukupno: {contentTotal}</p>
                </div>
              )}
            </AnalyticsSection>
          </div>

          {/* Geo sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnalyticsSection icon={MapPin} iconColor="text-blue-500" title="Korisnici po gradovima">
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input value={citySearch} onChange={e => setCitySearch(e.target.value)}
                    placeholder="Pretraži grad... (č, ć, š, ž, đ)"
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-muted border border-border rounded-xl outline-none focus:border-orange-500/50 transition-colors" />
                  {citySearch && (
                    <button onClick={() => setCitySearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                  )}
                </div>
                <button onClick={() => setCitySortAlpha(v => !v)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${citySortAlpha ? 'bg-blue-500 text-white border-blue-500' : 'bg-muted text-muted-foreground border-border hover:bg-accent'}`}>
                  {citySortAlpha ? 'A-Z' : '#'}
                </button>
              </div>
              {filteredCities.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{citySearch ? 'Nema rezultata' : 'Nema podataka'}</p>
              ) : (
                <>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {filteredCities.map(({ city, count }) => {
                      const pct = Math.round((count / totalCityUsers) * 100);
                      return <AnalyticsBarRow key={city} label={city} count={count} maxCount={maxCityCount} color="bg-blue-500" suffix={` (${pct}%)`} />;
                    })}
                  </div>
                  {analytics.topCities.filter(c => normalizeStr(c.city).includes(normalizeStr(citySearch))).length > GEO_LIMIT && (
                    <p className="text-[10px] text-muted-foreground text-center mt-2">Prikazano {GEO_LIMIT} od {analytics.topCities.length} — sužite pretragu</p>
                  )}
                </>
              )}
            </AnalyticsSection>

            <AnalyticsSection icon={MapPin} iconColor="text-purple-500" title="Korisnici po državama">
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input value={countrySearch} onChange={e => setCountrySearch(e.target.value)}
                    placeholder="Pretraži državu... (č, ć, š, ž, đ)"
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-muted border border-border rounded-xl outline-none focus:border-orange-500/50 transition-colors" />
                  {countrySearch && (
                    <button onClick={() => setCountrySearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                  )}
                </div>
                <button onClick={() => setCountrySortAlpha(v => !v)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${countrySortAlpha ? 'bg-purple-500 text-white border-purple-500' : 'bg-muted text-muted-foreground border-border hover:bg-accent'}`}>
                  {countrySortAlpha ? 'A-Z' : '#'}
                </button>
              </div>
              {filteredCountries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{countrySearch ? 'Nema rezultata' : 'Nema podataka'}</p>
              ) : (
                <>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {filteredCountries.map(({ country, count }) => {
                      const pct = Math.round((count / totalCountryUsers) * 100);
                      const flag = COUNTRY_FLAGS[country];
                      return <AnalyticsBarRow key={country} label={`${flag ? flag + ' ' : ''}${country}`} count={count} maxCount={maxCountryCount} color="bg-purple-500" suffix={` (${pct}%)`} />;
                    })}
                  </div>
                  {analytics.topCountries.filter(c => normalizeStr(c.country).includes(normalizeStr(countrySearch))).length > GEO_LIMIT && (
                    <p className="text-[10px] text-muted-foreground text-center mt-2">Prikazano {GEO_LIMIT} od {analytics.topCountries.length} — sužite pretragu</p>
                  )}
                </>
              )}
            </AnalyticsSection>
          </div>

          {/* Monthly charts — year preset only */}
          {isYearPreset && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AnalyticsSection icon={CalendarDays} title={`Novi korisnici — ${selectedYear}.`}>
                <AnalyticsBarChart color="bg-orange-500"
                  data={analytics.monthlyNewUsers.map(({ month, count }) => ({
                    key: month,
                    label: new Date(month + '-01').toLocaleDateString('sr-RS', { month: 'short' }),
                    tooltip: `${count} novih`, count,
                  }))} />
              </AnalyticsSection>
              <AnalyticsSection icon={Activity} iconColor="text-indigo-500" title={`Aktivni korisnici — ${selectedYear}.`}>
                <AnalyticsBarChart color="bg-indigo-500"
                  data={analytics.monthlyActiveUsers.map(({ month, count }) => ({
                    key: month,
                    label: new Date(month + '-01').toLocaleDateString('sr-RS', { month: 'short' }),
                    tooltip: `${count} aktivnih`, count,
                  }))} />
              </AnalyticsSection>
            </div>
          )}

          {/* Daily new users — non-year presets */}
          {showDailyTrend && (
            <AnalyticsSection icon={Users} iconColor="text-emerald-500" title={`Novi korisnici — ${periodLabel}`}>
              <AnalyticsBarChart color="bg-emerald-500" barHeightPx={90} gap="gap-0.5" showLabels={false}
                data={analytics.dailyNewUsers.map(({ date, count }) => ({
                  key: date, tooltip: `${count} — ${date.slice(5)}`, count, minHeightPct: 4,
                }))} />
              <p className="text-[10px] text-muted-foreground text-center mt-1">Hover za detalje · svaki stub = 1 dan</p>
            </AnalyticsSection>
          )}

          {/* Daily active users (always current 7d) */}
          <AnalyticsSection icon={Activity} iconColor="text-green-500" title="Aktivni korisnici — zadnjih 7 dana">
            {analytics.dailyActiveUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nema podataka</p>
            ) : (
              <AnalyticsBarChart color="bg-green-500" barHeightPx={100}
                data={analytics.dailyActiveUsers.map(({ date, count }) => ({
                  key: date,
                  label: new Date(date).toLocaleDateString('sr-RS', { weekday: 'short', day: 'numeric', month: 'numeric' }),
                  tooltip: `${count} korisnika`, count,
                }))} />
            )}
          </AnalyticsSection>

          {/* ── Phase 6: Extended marketing analytics ─────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <h3 className="font-semibold text-sm text-foreground">Marketing analitika — {periodLabel}</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AnalyticsSection icon={TrendingUp} title="Registracije po izvoru">
                {analytics.signupSources.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nema podataka za ovaj period</p>
                ) : (
                  <div className="space-y-2">
                    {analytics.signupSources.map(({ source, count }) => {
                      const total = analytics.signupSources.reduce((s, x) => s + x.count, 0);
                      const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <AnalyticsBarRow key={source}
                          label={SIGNUP_SOURCE_LABELS[source] || source} count={count}
                          maxCount={analytics.signupSources[0]?.count || 1}
                          color={SIGNUP_SOURCE_COLORS[source] || 'bg-slate-500'}
                          suffix={` (${pct}%)`} />
                      );
                    })}
                    <p className="text-[10px] text-muted-foreground pt-1">
                      Ukupno: {analytics.signupSources.reduce((s, x) => s + x.count, 0)} registracija
                    </p>
                  </div>
                )}
              </AnalyticsSection>

              <AnalyticsSection icon={Sparkles} iconColor="text-blue-500" title="UTM — Izvori">
                {analytics.utmSources.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Nema UTM podataka · dodaj <code className="text-[10px] bg-muted px-1 rounded">?utm_source=facebook</code> na link u reklami
                  </p>
                ) : (
                  <div className="space-y-2">
                    {analytics.utmSources.map(({ source, count }) => {
                      const total = analytics.utmSources.reduce((s, x) => s + x.count, 0);
                      const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <AnalyticsBarRow key={source}
                          label={`${UTM_ICONS[source] || '📣'} ${source}`} count={count}
                          maxCount={analytics.utmSources[0]?.count || 1}
                          color={UTM_COLORS[source] || 'bg-orange-500'}
                          suffix={` (${pct}%)`} />
                      );
                    })}
                    <p className="text-[10px] text-muted-foreground pt-1">
                      Ukupno kroz reklame: {analytics.utmSources.reduce((s, x) => s + x.count, 0)} korisnika
                    </p>
                  </div>
                )}
              </AnalyticsSection>
            </div>

            {/* Campaigns + mediums (only shown if there's data) */}
            {(analytics.marketingExtended.utmCampaigns.length > 0 || analytics.marketingExtended.utmMediums.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {analytics.marketingExtended.utmCampaigns.length > 0 && (
                  <AnalyticsSection icon={BarChart2} iconColor="text-pink-500" title="UTM — Kampanje">
                    <div className="space-y-2">
                      {analytics.marketingExtended.utmCampaigns.slice(0, 10).map(({ campaign, count }) => (
                        <AnalyticsBarRow key={campaign} label={campaign} count={count}
                          maxCount={analytics.marketingExtended.utmCampaigns[0]?.count || 1}
                          color="bg-pink-500" />
                      ))}
                    </div>
                  </AnalyticsSection>
                )}
                {analytics.marketingExtended.utmMediums.length > 0 && (
                  <AnalyticsSection icon={BarChart2} iconColor="text-cyan-500" title="UTM — Mediji">
                    <div className="space-y-2">
                      {analytics.marketingExtended.utmMediums.slice(0, 10).map(({ medium, count }) => (
                        <AnalyticsBarRow key={medium} label={medium} count={count}
                          maxCount={analytics.marketingExtended.utmMediums[0]?.count || 1}
                          color="bg-cyan-500" />
                      ))}
                    </div>
                  </AnalyticsSection>
                )}
              </div>
            )}
          </div>

          {/* ── Phase 9: Top content ──────────────────────────────────── */}
          <AnalyticsSection icon={Star} iconColor="text-yellow-500" title="Top sadržaj po pregledima (sve vrijeme)">
            {analytics.topContent.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nema podataka o pregledima</p>
            ) : (
              <div className="space-y-2">
                {analytics.topContent.map((post, i) => (
                  <div key={post.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <span className="text-sm font-black text-muted-foreground w-5 shrink-0 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground line-clamp-1">{post.content || '(bez teksta)'}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">{POST_TYPE_LABELS[post.post_type] || post.post_type}</span>
                        {post.author && <span className="text-[10px] text-muted-foreground truncate">· {post.author.name}</span>}
                        <span className="text-[10px] text-muted-foreground">· {timeAgo(post.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        {post.views_count.toLocaleString()}
                      </div>
                      <button onClick={() => router.push(`/posts/${post.id}`)}
                        className="text-muted-foreground hover:text-foreground transition-colors">
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AnalyticsSection>

          {/* ── Phase 10: Message analytics ───────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-500" />
              <h3 className="font-semibold text-sm text-foreground">Poruke i razgovori — {periodLabel}</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
                <MessageSquare className="h-10 w-10 text-green-400 opacity-60 shrink-0" />
                <div>
                  <p className="text-3xl font-black text-green-500">{analytics.messageAnalytics.newThreadsInRange}</p>
                  <p className="text-sm text-muted-foreground">Novih razgovora u periodu</p>
                  <div className="mt-1.5">
                    <DeltaBadge current={analytics.comparison.rangeNewThreads} prev={analytics.comparison.prevRangeNewThreads} />
                  </div>
                </div>
              </div>

              <AnalyticsSection icon={Activity} iconColor="text-green-500" title="Trend razgovora — period">
                {analytics.messageAnalytics.dailyTrend.every(d => d.count === 0) ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nema novih razgovora</p>
                ) : (
                  <>
                    <AnalyticsBarChart color="bg-green-400" barHeightPx={80} gap="gap-0.5" showLabels={false}
                      data={analytics.messageAnalytics.dailyTrend.map(({ date, count }) => ({
                        key: date, tooltip: `${count} — ${date.slice(5)}`, count, minHeightPct: 4,
                      }))} />
                    <p className="text-[10px] text-muted-foreground text-center mt-1">Hover za detalje · svaki stub = 1 dan</p>
                  </>
                )}
              </AnalyticsSection>
            </div>
          </div>

          {/* ── Report analytics ──────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-500" />
              <h3 className="font-semibold text-sm text-foreground">Analitika reportova — {periodLabel}</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AnalyticsSection icon={BarChart2} iconColor="text-red-500" title="Status reportova">
                {analytics.reportAnalytics.byStatus.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nema reportova</p>
                ) : (
                  <div className="space-y-2">
                    {analytics.reportAnalytics.byStatus.map(({ status, count }) => {
                      const total = analytics.reportAnalytics.byStatus.reduce((s, x) => s + x.count, 0);
                      const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={status}>
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className={`font-semibold px-2 py-0.5 rounded-full ${REPORT_STATUS_BADGE[status] || 'bg-muted text-muted-foreground'}`}>
                              {REPORT_STATUS_LABELS[status] || status}
                            </span>
                            <span className="text-muted-foreground">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${REPORT_STATUS_BAR[status] || 'bg-slate-500'} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </AnalyticsSection>

              <AnalyticsSection icon={BarChart2} iconColor="text-yellow-500" title="Najčešći razlozi prijave">
                {analytics.reportAnalytics.byReason.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nema podataka</p>
                ) : (
                  <div className="space-y-2">
                    {analytics.reportAnalytics.byReason.map(({ reason, count }) => (
                      <AnalyticsBarRow key={reason} label={REASON_LABELS[reason] || reason} count={count}
                        maxCount={analytics.reportAnalytics.byReason[0]?.count || 1} color="bg-yellow-500" />
                    ))}
                  </div>
                )}
              </AnalyticsSection>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AnalyticsSection icon={Activity} iconColor="text-red-500" title="Trend reportova — period">
                <AnalyticsBarChart color="bg-red-400" barHeightPx={80} gap="gap-0.5" showLabels={false}
                  data={analytics.reportAnalytics.dailyTrend.map(({ date, count }) => ({
                    key: date, tooltip: `${count} — ${date.slice(5)}`, count, minHeightPct: 4,
                  }))} />
                <p className="text-[10px] text-muted-foreground text-center mt-1">Hover za detalje · svaki stub = 1 dan</p>
              </AnalyticsSection>

              <AnalyticsSection icon={Shield} iconColor="text-orange-500" title="Prijave po tipu sadržaja">
                {analytics.reportAnalytics.byType.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nema podataka</p>
                ) : (
                  <div className="space-y-2">
                    {analytics.reportAnalytics.byType.map(({ type, count }) => (
                      <AnalyticsBarRow key={type}
                        label={type === 'post' ? '📄 Objave' : type === 'profile' ? '👤 Profili' : type}
                        count={count}
                        maxCount={analytics.reportAnalytics.byType.reduce((m, x) => Math.max(m, x.count), 1)}
                        color="bg-orange-500" />
                    ))}
                  </div>
                )}
              </AnalyticsSection>
            </div>

            {analytics.reportAnalytics.topReported.length > 0 && (
              <AnalyticsSection icon={Users} iconColor="text-red-500" title="Najčešće prijavljivani korisnici">
                <div className="space-y-2">
                  {analytics.reportAnalytics.topReported.map((user, i) => (
                    <div key={user.id} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback className="text-[10px]">{user.name?.[0]}</AvatarFallback>
                      </Avatar>
                      <p className="text-xs font-semibold flex-1 truncate">{user.name}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        user.count >= 5 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                        : user.count >= 3 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400'
                        : 'bg-muted text-muted-foreground'
                      }`}>
                        {user.count} {user.count === 1 ? 'prijava' : user.count < 5 ? 'prijave' : 'prijava'}
                      </span>
                      <button onClick={() => router.push(`/profile/${user.id}`)}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </AnalyticsSection>
            )}
          </div>

          {/* ── Invest analytics ──────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                <h3 className="font-semibold text-sm text-foreground">Invest — Lista čekanja</h3>
              </div>
              <button onClick={onFetchInvestStats}
                className="text-xs text-orange-500 hover:underline flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Osvježi
              </button>
            </div>

            {investLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
              </div>
            ) : investStats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {[
                    { label: 'Ukupno na listi', value: investStats.waitlistTotal,  color: 'text-orange-500' },
                    { label: 'Ukupno interesa', value: investStats.interestsTotal, color: 'text-blue-500'   },
                    { label: 'Projekata',        value: investStats.projectsTotal,  color: 'text-purple-500' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-card border border-border rounded-2xl p-4 text-center">
                      <p className={`text-2xl font-black ${color}`}>{value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Po ulozi</h4>
                  {investStats.byRole.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">Nema podataka</p>
                  ) : (
                    <div className="space-y-2">
                      {investStats.byRole.map(({ role, count }) => {
                        const pct = investStats.waitlistTotal > 0 ? Math.round((count / investStats.waitlistTotal) * 100) : 0;
                        return (
                          <AnalyticsBarRow key={role} label={INVEST_ROLE_LABELS[role] || role} count={count}
                            maxCount={investStats.byRole[0]?.count || 1}
                            color={INVEST_ROLE_COLORS[role] || 'bg-slate-500'}
                            suffix={` (${pct}%)`} />
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zadnjih 8 prijava</h4>
                  {investStats.recent.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">Nema prijava</p>
                  ) : (
                    <div className="space-y-2">
                      {investStats.recent.map((w, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{w.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{w.email}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium">
                              {INVEST_ROLE_LABELS[w.role] || w.role}
                            </span>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(w.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-8 text-muted-foreground text-sm">
                Klikni Osvježi za učitavanje podataka
              </div>
            )}
          </div>

          {/* ── Churn analytics ───────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <UserX className="h-4 w-4 text-red-500" />
              <h3 className="font-semibold text-sm text-foreground">Churn — odliv korisnika</h3>
              <span className="text-[10px] text-muted-foreground ml-auto">period: {periodLabel}</span>
            </div>

            {/* KPI strip — always current, not range-filtered */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Napustili danas',      value: analytics.churnData.todayDeleted,  color: 'text-orange-500', tooltip: 'Obrisani nalozi počevši od ponoći danas' },
                { label: 'Napustili (7 dana)',   value: analytics.churnData.weekDeleted,   color: 'text-yellow-500', tooltip: 'Obrisani nalozi u poslednjih 7 dana' },
                { label: 'Napustili (30 dana)',  value: analytics.churnData.monthDeleted,  color: 'text-red-400',    tooltip: 'Obrisani nalozi u poslednjih 30 dana' },
                { label: 'Ukupno napustilo',     value: analytics.churnData.totalDeleted,  color: 'text-red-600',    tooltip: 'Ukupan broj obrisanih naloga od lansiranja' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-card border border-border rounded-2xl p-4 text-center">
                  <p className={`text-2xl font-black ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">{label}</p>
                </div>
              ))}
            </div>

            {/* Churn rate card */}
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
              <UserX className="h-10 w-10 text-red-400 opacity-50 shrink-0" />
              <div className="flex-1">
                <p className="text-3xl font-black text-red-500">{churnRate}%</p>
                <p className="text-sm text-muted-foreground">Churn rate — {periodLabel}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {analytics.churnData.rangeDeleted} obrisanih / {churnActiveBase.toLocaleString()} aktivnih (
                  {dateRange.preset === '7d' ? 'WAU' : dateRange.preset === 'year' ? 'YAU' : 'MAU'})
                </p>
              </div>
              {analytics.churnData.rangeDeleted === 0 && (
                <span className="text-xs text-green-600 font-semibold bg-green-50 dark:bg-green-950/30 px-3 py-1.5 rounded-full">
                  Nema odliva
                </span>
              )}
            </div>

            {/* By country + By reason */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AnalyticsSection icon={MapPin} iconColor="text-red-500" title="Odliv po državama">
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    value={churnCountrySearch}
                    onChange={e => setChurnCountrySearch(e.target.value)}
                    placeholder="Pretraži državu..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-muted border border-border rounded-xl outline-none focus:border-orange-500/50 transition-colors"
                  />
                  {churnCountrySearch && (
                    <button onClick={() => setChurnCountrySearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {filteredChurnCountries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {analytics.churnData.byCountry.length === 0 ? 'Nema obrisanih naloga u ovom periodu' : 'Nema rezultata'}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {filteredChurnCountries.map(({ country, count }) => {
                      const total = analytics.churnData.rangeDeleted || 1;
                      const pct   = Math.round((count / total) * 100);
                      const flag  = COUNTRY_FLAGS[country];
                      return (
                        <AnalyticsBarRow
                          key={country}
                          label={`${flag ? flag + ' ' : ''}${country}`}
                          count={count}
                          maxCount={maxChurnCountry}
                          color="bg-red-400"
                          suffix={` (${pct}%)`}
                        />
                      );
                    })}
                  </div>
                )}
              </AnalyticsSection>

              <AnalyticsSection icon={BarChart2} iconColor="text-red-500" title="Razlozi odliva">
                {analytics.churnData.byReason.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {analytics.churnData.rangeDeleted === 0
                      ? 'Nema obrisanih naloga u ovom periodu'
                      : 'Korisnici nisu naveli razlog'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {analytics.churnData.byReason.map(({ reason, count }) => (
                      <AnalyticsBarRow
                        key={reason}
                        label={CHURN_REASON_LABELS[reason] || reason}
                        count={count}
                        maxCount={maxChurnReason}
                        color="bg-red-500"
                      />
                    ))}
                  </div>
                )}
              </AnalyticsSection>
            </div>

            {/* Daily trend chart (range-filtered) */}
            {!isYearPreset && (
              <AnalyticsSection icon={Activity} iconColor="text-red-500" title={`Trend odliva — ${periodLabel}`}>
                {analytics.churnData.dailyTrend.every(d => d.count === 0) ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nema odliva u ovom periodu</p>
                ) : (
                  <>
                    <AnalyticsBarChart color="bg-red-400" barHeightPx={80} gap="gap-0.5" showLabels={false}
                      data={analytics.churnData.dailyTrend.map(({ date, count }) => ({
                        key: date, tooltip: `${count} — ${date.slice(5)}`, count, minHeightPct: 4,
                      }))} />
                    <p className="text-[10px] text-muted-foreground text-center mt-1">Hover za detalje · svaki stub = 1 dan</p>
                  </>
                )}
              </AnalyticsSection>
            )}
          </div>

          {/* ── Export podataka ───────────────────────────────────────── */}
          <ExportPanel analytics={analytics} />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <BarChart2 className="h-10 w-10 opacity-20" />
          <p className="text-sm">Klikni Osvježi za učitavanje analitike</p>
        </div>
      )}
    </div>
  );
}
