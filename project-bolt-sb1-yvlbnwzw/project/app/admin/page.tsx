'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { ProtectedRoute } from '@/components/protected-route';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users, FileText, AlertTriangle, Shield, Eye, Trash2,
  MessageSquare, TrendingUp, ExternalLink, Search, Ban,
  UserCheck, Loader2, ChevronDown, Filter, Megaphone, Plus,
  ToggleLeft, ToggleRight, BarChart2, Activity, MapPin, CalendarDays, RefreshCw,
  Bell, X, Coins, Crown, Sparkles
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';

// ─── Types ──────────────────────────────────────────────────────────────────

type Report = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reporter: { id: string; name: string; avatar_url?: string };
  target_owner: { id: string; name: string; avatar_url?: string };
};

type UserProfile = {
  id: string;
  name: string;
  email: string;
  account_type: string;
  avatar_url?: string;
  is_admin: boolean;
  is_banned?: boolean;
  created_at: string;
  city?: string;
  country?: string;
};

type PostItem = {
  id: string;
  content: string;
  created_at: string;
  views_count: number;
  status: string;
  post_type: string;
  is_promoted: boolean;
  author: { id: string; name: string; avatar_url?: string } | null;
};

type Stats = {
  users: number;
  professionals: number;
  customers: number;
  posts: number;
  reports: number;
  openReports: number;
  messages: number;
};

type SupportTicket = {
  id: string;
  subject: string;
  message: string;
  category: string;
  status: string;
  created_at: string;
  attachment_url?: string;
  attachment_name?: string;
  profiles: { name: string; email: string } | null;
};

type Announcement = {
  id: string;
  title: string;
  body: string;
  title_en?: string;
  body_en?: string;
  title_de?: string;
  body_de?: string;
  active: boolean;
  created_at: string;
};

type ActiveTab = 'reports' | 'users' | 'posts' | 'announcements' | 'support' | 'analytics' | 'credits';

type PageViewStat = {
  page: string;
  count: number;
};

type DailyActiveUsers = {
  date: string;
  count: number;
};

type AnalyticsData = {
  pageViews: PageViewStat[];
  dau: number;
  wau: number;
  mau: number;
  yau: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  newUsersThisYear: number;
  topCities: { city: string; count: number }[];
  topCountries: { country: string; count: number }[];
  dailyActiveUsers: DailyActiveUsers[];
  monthlyNewUsers: { month: string; count: number }[];
  monthlyActiveUsers: { month: string; count: number }[];
  signupSources: { source: string; count: number }[];
  dailyNewUsers: { date: string; count: number }[];
};
type InvestStats = {
  waitlistTotal: number;
  byRole: { role: string; count: number }[];
  recent: { name: string; email: string; role: string; created_at: string }[];
  interestsTotal: number;
  projectsTotal: number;
};

type ReportFilter = 'all' | 'open' | 'reviewed' | 'resolved';

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  scam: 'Prevara',
  harassment: 'Uznemiravanje',
  inappropriate: 'Neprimjeren sadržaj',
  other: 'Ostalo',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  reviewed: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Otvoren',
  reviewed: 'Pregledano',
  resolved: 'Riješeno',
};

const COUNTRY_LANG_MAP: Record<string, string> = {
  // Serbian / Balkan
  'serbia': 'sr', 'srbija': 'sr',
  'croatia': 'sr', 'hrvatska': 'sr',
  'bosnia and herzegovina': 'sr', 'bosna i hercegovina': 'sr', 'bosnia': 'sr', 'bosna': 'sr',
  'montenegro': 'sr', 'crna gora': 'sr',
  'slovenia': 'sr', 'slovenija': 'sr',
  'north macedonia': 'sr', 'sjeverna makedonija': 'sr', 'macedonia': 'sr', 'makedonija': 'sr',
  // German
  'germany': 'de', 'deutschland': 'de', 'njemačka': 'de', 'nemacka': 'de', 'nemačka': 'de',
  'austria': 'de', 'österreich': 'de', 'austrija': 'de',
  'switzerland': 'de', 'schweiz': 'de', 'švicarska': 'de', 'svicarska': 'de',
  'liechtenstein': 'de',
  // French
  'france': 'fr', 'francuska': 'fr',
  'belgium': 'fr', 'belgija': 'fr',
  'luxembourg': 'fr',
  'monaco': 'fr',
  // Spanish
  'spain': 'es', 'španija': 'es', 'spanija': 'es', 'espana': 'es', 'españa': 'es',
  'mexico': 'es', 'meksiko': 'es', 'méxico': 'es',
  'argentina': 'es',
  'colombia': 'es', 'kolumbija': 'es',
  'chile': 'es',
  'peru': 'es', 'perú': 'es',
  'venezuela': 'es',
  'ecuador': 'es',
  'bolivia': 'es',
  'paraguay': 'es',
  'uruguay': 'es',
  'cuba': 'es', 'kuba': 'es',
  'costa rica': 'es',
  'panama': 'es', 'panamá': 'es',
  // Italian
  'italy': 'it', 'italija': 'it', 'italia': 'it',
  // Bulgarian
  'bulgaria': 'bg', 'bugarska': 'bg', 'bălgarija': 'bg',
  // Romanian
  'romania': 'ro', 'rumunija': 'ro', 'românia': 'ro',
  // Hungarian
  'hungary': 'hu', 'mađarska': 'hu', 'madarska': 'hu', 'magyarország': 'hu',
  // Slovak
  'slovakia': 'sk', 'slovačka': 'sk', 'slovacka': 'sk',
  // Czech
  'czech republic': 'cs', 'czechia': 'cs', 'češka': 'cs', 'ceska': 'cs',
  // Polish
  'poland': 'pl', 'poljska': 'pl', 'polska': 'pl',
  // Dutch
  'netherlands': 'nl', 'holland': 'nl', 'holandija': 'nl', 'nederland': 'nl',
  // Portuguese
  'portugal': 'pt',
  'brazil': 'pt', 'brasil': 'pt', 'brazil': 'pt',
  // Turkish
  'turkey': 'tr', 'turska': 'tr', 'türkiye': 'tr',
  // Russian
  'russia': 'ru', 'rusija': 'ru', 'rossija': 'ru',
  // Ukrainian
  'ukraine': 'uk', 'ukrajina': 'uk',
  // Greek
  'greece': 'el', 'grčka': 'el', 'grcka': 'el',
  // Arabic
  'saudi arabia': 'ar', 'saudijska arabija': 'ar',
  'united arab emirates': 'ar', 'uae': 'ar', 'ujedinjeni arapski emirati': 'ar',
  'egypt': 'ar', 'egipat': 'ar',
  'morocco': 'ar', 'maroko': 'ar',
  // English-primary
  'united kingdom': 'en', 'uk': 'en', 'great britain': 'en', 'velika britanija': 'en',
  'united states': 'en', 'usa': 'en', 'us': 'en', 'sjedinjene države': 'en', 'sjedinjene americke drzave': 'en',
  'canada': 'en', 'kanada': 'en',
  'australia': 'en', 'australija': 'en',
  'new zealand': 'en', 'novi zeland': 'en',
  'ireland': 'en', 'irska': 'en',
  'india': 'en', 'indija': 'en',
  'bangladesh': 'en',
  'pakistan': 'en',
  'nigeria': 'en',
  'ghana': 'en',
  'kenya': 'en',
  'south africa': 'en', 'južna afrika': 'en',
  'singapore': 'en',
  'malaysia': 'en',
  'philippines': 'en', 'filipini': 'en',
};

const LANG_INFO: Record<string, { name: string; flag: string }> = {
  sr: { name: 'Srpski', flag: '🇷🇸' },
  de: { name: 'Njemački', flag: '🇩🇪' },
  en: { name: 'Engleski', flag: '🇬🇧' },
  fr: { name: 'Francuski', flag: '🇫🇷' },
  es: { name: 'Španski', flag: '🇪🇸' },
  it: { name: 'Italijanski', flag: '🇮🇹' },
  bg: { name: 'Bugarski', flag: '🇧🇬' },
  ro: { name: 'Rumunski', flag: '🇷🇴' },
  hu: { name: 'Mađarski', flag: '🇭🇺' },
  sk: { name: 'Slovački', flag: '🇸🇰' },
  cs: { name: 'Češki', flag: '🇨🇿' },
  pl: { name: 'Poljski', flag: '🇵🇱' },
  nl: { name: 'Nizozemski', flag: '🇳🇱' },
  pt: { name: 'Portugalski', flag: '🇵🇹' },
  tr: { name: 'Turski', flag: '🇹🇷' },
  ru: { name: 'Ruski', flag: '🇷🇺' },
  uk: { name: 'Ukrajinski', flag: '🇺🇦' },
  el: { name: 'Grčki', flag: '🇬🇷' },
  ar: { name: 'Arapski', flag: '🇸🇦' },
};

// ─── Admin Content ────────────────────────────────────────────────────────────

function AdminContent() {
  const { profile } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>('reports');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Reports state
  const [reports, setReports] = useState<Report[]>([]);
  const [reportFilter, setReportFilter] = useState<ReportFilter>('all');
  const [reportTypeFilter, setReportTypeFilter] = useState<'all' | 'post' | 'profile'>('all');
  const [reportsOffset, setReportsOffset] = useState(0);
  const [hasMoreReports, setHasMoreReports] = useState(false);
  const [loadingMoreReports, setLoadingMoreReports] = useState(false);

  // Users state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userCountryFilter, setUserCountryFilter] = useState('');
  const [usersOffset, setUsersOffset] = useState(0);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const userSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Posts state
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [postsOffset, setPostsOffset] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [postTypeFilter, setPostTypeFilter] = useState<string>('all');

  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newTitleEn, setNewTitleEn] = useState('');
  const [newBodyEn, setNewBodyEn] = useState('');
  const [newTitleDe, setNewTitleDe] = useState('');
  const [newBodyDe, setNewBodyDe] = useState('');
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [langStats, setLangStats] = useState<{ lang: string; count: number; emails: string[] }[]>([]);

  // Support state
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  // Analytics state
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Invest analytics state
  const [investStats, setInvestStats] = useState<InvestStats | null>(null);
  const [investLoading, setInvestLoading] = useState(false);

  // Credits analytics state
  const [creditsStats, setCreditsStats] = useState<any>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);

  // Send notification state
  const [notifTarget, setNotifTarget] = useState<{ id: string; name: string } | null>(null);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifLink, setNotifLink] = useState('/services');
  const [sendingNotif, setSendingNotif] = useState(false);

  // ── Redirect non-admins ──────────────────────────────────────────────────
  useEffect(() => {
    if (profile && !profile.is_admin) router.replace('/');
  }, [profile]);

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.is_admin) return;
    (async () => {
      setLoading(true);
      await Promise.all([
        fetchStats(),
        loadReports('all', 0, false),
        loadUsers('', 0, false),
        loadPosts(0, false),
        fetchAnnouncements(),
        fetchLangStats(),
        fetchTickets(),
      ]);
      setLoading(false);
    })();
  }, [profile]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const fetchStats = async () => {
    const [
      { count: users },
      { count: professionals },
      { count: customers },
      { count: posts },
      { count: reports },
      { count: openReports },
      { count: messages },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'professional'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'customer'),
      supabase.from('posts').select('*', { count: 'exact', head: true }),
      supabase.from('reports').select('*', { count: 'exact', head: true }),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('threads').select('*', { count: 'exact', head: true }),
    ]);
    setStats({
      users: users || 0,
      professionals: professionals || 0,
      customers: customers || 0,
      posts: posts || 0,
      reports: reports || 0,
      openReports: openReports || 0,
      messages: messages || 0, // reusing field for threads count
    });
  };

  // ── Analytics ─────────────────────────────────────────────────────────────
  const fetchAnalytics = async (year?: number) => {
    const targetYear = year ?? selectedYear;
    setAnalyticsLoading(true);
    try {
      const now = new Date();
      const isCurrentYear = targetYear === now.getFullYear();

      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Exact year range
      const chosenYearStart = new Date(`${targetYear}-01-01T00:00:00.000Z`);
      const chosenYearEnd = new Date(`${targetYear + 1}-01-01T00:00:00.000Z`);

      const [
        { data: allViews },
        { data: activeUserCounts },
        { data: newWeek },
        { data: newMonth },
        { data: newYear },
        { data: cityProfiles },
        { data: countryProfiles },
        { data: daily7 },
        { data: monthlyActiveRpc },
        { data: yearlyProfiles },
        { data: signupSourceData },
        { data: daily30Profiles },
      ] = await Promise.all([
        supabase.rpc('get_page_view_counts'),
        // DAU/WAU/MAU/YAU via server-side COUNT DISTINCT
        supabase.rpc('get_active_user_counts', {
          today_start: todayStart.toISOString(),
          week_start:  weekStart.toISOString(),
          month_start: monthStart.toISOString(),
          year_start:  chosenYearStart.toISOString(),
          year_end:    chosenYearEnd.toISOString(),
        }),
        supabase.from('profiles').select('id').gte('created_at', weekStart.toISOString()),
        supabase.from('profiles').select('id').gte('created_at', monthStart.toISOString()),
        // New users for selected year
        supabase.from('profiles').select('id').gte('created_at', chosenYearStart.toISOString()).lt('created_at', chosenYearEnd.toISOString()),
        supabase.from('profiles').select('city').not('city', 'is', null),
        supabase.from('profiles').select('country').not('country', 'is', null),
        // Daily 7 via RPC — avoids row limit truncation
        supabase.rpc('get_daily_active_users', { week_start: weekStart.toISOString() }),
        // Monthly active users via RPC — avoids row limit truncation
        supabase.rpc('get_monthly_active_users', {
          year_start: chosenYearStart.toISOString(),
          year_end:   chosenYearEnd.toISOString(),
        }),
        supabase.from('profiles').select('created_at').gte('created_at', chosenYearStart.toISOString()).lt('created_at', chosenYearEnd.toISOString()),
        // Signup sources
        supabase.from('profiles').select('signup_source').not('signup_source', 'is', null),
        // Daily new users last 30 days
        supabase.from('profiles').select('created_at').gte('created_at', monthStart.toISOString()),
      ]);

      // Signup source aggregation
      const sourceCount: Record<string, number> = {};
      for (const p of (signupSourceData as any[] || [])) {
        const s = p.signup_source || 'direct';
        sourceCount[s] = (sourceCount[s] || 0) + 1;
      }
      const signupSources = Object.entries(sourceCount)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);

      // Daily new users (last 30 days)
      const dailyNewMap: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        dailyNewMap[d.toISOString().slice(0, 10)] = 0;
      }
      for (const p of (daily30Profiles as any[] || [])) {
        const date = (p.created_at as string).slice(0, 10);
        if (date in dailyNewMap) dailyNewMap[date]++;
      }
      const dailyNewUsers = Object.entries(dailyNewMap).map(([date, count]) => ({ date, count }));

      // Page views aggregation — already grouped by RPC
      const pageViews: PageViewStat[] = (allViews || []).map((r: any) => ({
        page: r.page,
        count: Number(r.count),
      }));

      // Unique users — from server-side COUNT DISTINCT
      const counts = (activeUserCounts as any)?.[0] ?? {};
      const dau = Number(counts.dau ?? 0);
      const wau = Number(counts.wau ?? 0);
      const mau = Number(counts.mau ?? 0);
      const yau = Number(counts.yau ?? 0);

      // Monthly new users — svih 12 mjeseci odabrane godine
      const monthlyNewMap: Record<string, number> = {};
      for (let m = 0; m < 12; m++) {
        const key = `${targetYear}-${String(m + 1).padStart(2, '0')}`;
        monthlyNewMap[key] = 0;
      }
      for (const p of yearlyProfiles || []) {
        const key = (p.created_at as string).slice(0, 7);
        if (key in monthlyNewMap) monthlyNewMap[key]++;
      }
      const monthlyNewUsers = Object.entries(monthlyNewMap).map(([month, count]) => ({ month, count }));

      // Monthly active users — from RPC (no row limit issues)
      const rpcActiveMap: Record<string, number> = {};
      for (let m = 0; m < 12; m++) {
        const key = `${targetYear}-${String(m + 1).padStart(2, '0')}`;
        rpcActiveMap[key] = 0;
      }
      for (const r of (monthlyActiveRpc as any[] || [])) {
        if (r.month in rpcActiveMap) rpcActiveMap[r.month] = Number(r.count);
      }
      const monthlyActiveUsers = Object.entries(rpcActiveMap).map(([month, count]) => ({ month, count }));

      // City aggregation
      const cityAliases: Record<string, string> = {
        'belgrade': 'Beograd', 'beograd': 'Beograd',
        'novi sad': 'Novi Sad', 'novisad': 'Novi Sad',
        'nis': 'Niš', 'niš': 'Niš',
        'kragujevac': 'Kragujevac',
        'subotica': 'Subotica',
        'curug': 'Čurug', 'čurug': 'Čurug',
        'novi pazar': 'Novi Pazar',
        'leskovac': 'Leskovac',
        'pancevo': 'Pančevo', 'pančevo': 'Pančevo',
        'cacak': 'Čačak', 'čačak': 'Čačak',
        'krusevac': 'Kruševac', 'kruševac': 'Kruševac',
        'kraljevo': 'Kraljevo',
        'smederevo': 'Smederevo',
        'zagreb': 'Zagreb',
        'sarajevo': 'Sarajevo',
        'vienna': 'Wien', 'wien': 'Wien',
        'munich': 'München', 'münchen': 'München',
        'berlin': 'Berlin',
      };
      const normalizeCity = (city: string): string => {
        const key = city.toLowerCase().trim();
        return cityAliases[key] || city.trim();
      };
      const cityCount: Record<string, number> = {};
      for (const p of cityProfiles || []) {
        if (p.city) {
          const normalized = normalizeCity(p.city);
          cityCount[normalized] = (cityCount[normalized] || 0) + 1;
        }
      }
      const topCities = Object.entries(cityCount)
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count);

      // Country aggregation
      const countryAliases: Record<string, string> = {
        'serbia': 'Srbija', 'srbija': 'Srbija',
        'croatia': 'Hrvatska', 'hrvatska': 'Hrvatska',
        'bosnia and herzegovina': 'Bosna i Hercegovina', 'bosna i hercegovina': 'Bosna i Hercegovina', 'bosnia': 'Bosna i Hercegovina',
        'montenegro': 'Crna Gora', 'crna gora': 'Crna Gora',
        'slovenia': 'Slovenija', 'slovenija': 'Slovenija',
        'north macedonia': 'Sjeverna Makedonija', 'sjeverna makedonija': 'Sjeverna Makedonija', 'macedonia': 'Sjeverna Makedonija',
        'germany': 'Njemačka', 'njemačka': 'Njemačka', 'deutschland': 'Njemačka',
        'austria': 'Austrija', 'austrija': 'Austrija', 'österreich': 'Austrija',
        'switzerland': 'Švajcarska', 'švajcarska': 'Švajcarska', 'schweiz': 'Švajcarska',
        'slovakia': 'Slovačka', 'slovačka': 'Slovačka',
        'united states': 'SAD', 'usa': 'SAD', 'united states of america': 'SAD',
        'united kingdom': 'Velika Britanija', 'uk': 'Velika Britanija',
      };
      const countryCount: Record<string, number> = {};
      for (const p of countryProfiles || []) {
        if (p.country) {
          const normalized = countryAliases[p.country.toLowerCase()] ?? p.country;
          countryCount[normalized] = (countryCount[normalized] || 0) + 1;
        }
      }
      const topCountries = Object.entries(countryCount)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count);

      // Daily active users (last 7 days) — from RPC, already aggregated
      const dailyRpcMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dailyRpcMap[d.toISOString().slice(0, 10)] = 0;
      }
      for (const r of (daily7 as any[] || [])) {
        const key = (r.date as string).slice(0, 10);
        if (key in dailyRpcMap) dailyRpcMap[key] = Number(r.count);
      }
      const dailyActiveUsers: DailyActiveUsers[] = Object.entries(dailyRpcMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setAnalytics({
        pageViews,
        dau,
        wau,
        mau,
        yau,
        newUsersThisWeek: newWeek?.length || 0,
        newUsersThisMonth: newMonth?.length || 0,
        newUsersThisYear: newYear?.length || 0,
        topCities,
        topCountries,
        dailyActiveUsers,
        monthlyNewUsers,
        monthlyActiveUsers,
        signupSources,
        dailyNewUsers,
      });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // ── Invest analytics ─────────────────────────────────────────────────────
  const fetchInvestStats = async () => {
    setInvestLoading(true);
    try {
      const [waitlistRes, interestsRes, projectsRes] = await Promise.all([
        supabase.from('investment_waitlist').select('name, email, role, created_at').order('created_at', { ascending: false }),
        supabase.from('investment_interests').select('id', { count: 'exact', head: true }),
        supabase.from('investment_projects').select('id', { count: 'exact', head: true }),
      ]);

      const waitlist = waitlistRes.data || [];
      const roleMap: Record<string, number> = {};
      for (const w of waitlist) {
        roleMap[w.role] = (roleMap[w.role] || 0) + 1;
      }
      const byRole = Object.entries(roleMap)
        .map(([role, count]) => ({ role, count }))
        .sort((a, b) => b.count - a.count);

      setInvestStats({
        waitlistTotal: waitlist.length,
        byRole,
        recent: waitlist.slice(0, 8),
        interestsTotal: interestsRes.count || 0,
        projectsTotal: projectsRes.count || 0,
      });
    } finally {
      setInvestLoading(false);
    }
  };

  // ── Credits analytics ────────────────────────────────────────────────────
  const fetchCreditsStats = async () => {
    setCreditsLoading(true);
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [txRes, balanceRes, premiumRes, recentRes, referralsRes] = await Promise.all([
        supabase.from('credit_transactions').select('amount, description, created_at').gte('created_at', thirtyDaysAgo),
        supabase.from('credits_balance').select('balance'),
        supabase.from('profiles').select('id, name, avatar_url, is_creator_premium').eq('is_creator_premium', true),
        supabase.from('credit_transactions')
          .select('user_id, amount, description, created_at, profiles!credit_transactions_user_id_fkey(name, avatar_url)')
          .order('created_at', { ascending: false })
          .limit(30),
        supabase.from('referrals')
          .select('referrer_id, created_at, referrer:referrer_id(name, avatar_url), referred:referred_id(name, avatar_url, created_at)')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const txData = txRes.data || [];
      const totalBalance = (balanceRes.data || []).reduce((sum: number, r: any) => sum + (r.balance || 0), 0);

      // breakdown by type
      const breakdown: Record<string, { count: number; total: number }> = {};
      for (const tx of txData) {
        const desc = tx.description || '';
        const key = desc.startsWith('boost_post') ? 'boost'
          : desc === 'become_creator_premium' ? 'creator_premium'
          : desc === 'Podrška poslata' || desc === 'Primljena podrška' ? 'podrzi'
          : desc.startsWith('Nagrada:') ? 'nagrada'
          : desc.startsWith('Post nagrada:') ? 'media_nagrada'
          : 'ostalo';
        if (!breakdown[key]) breakdown[key] = { count: 0, total: 0 };
        breakdown[key].count++;
        breakdown[key].total += Math.abs(tx.amount);
      }

      // Referral leaderboard
      const referrals = (referralsRes.data || []).map((r: any) => ({
        ...r,
        referrer: Array.isArray(r.referrer) ? r.referrer[0] : r.referrer,
        referred: Array.isArray(r.referred) ? r.referred[0] : r.referred,
      }));
      const referrerMap: Record<string, { name: string; avatar_url?: string; count: number }> = {};
      for (const r of referrals) {
        const id = r.referrer_id;
        if (!referrerMap[id]) referrerMap[id] = { name: r.referrer?.name || '—', avatar_url: r.referrer?.avatar_url, count: 0 };
        referrerMap[id].count++;
      }
      const topReferrers = Object.entries(referrerMap)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setCreditsStats({
        totalBalance,
        premiumCount: (premiumRes.data || []).length,
        premiumUsers: premiumRes.data || [],
        txLast30d: txData.length,
        breakdown,
        recent: (recentRes.data || []).map((r: any) => ({
          ...r,
          profile: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
        })),
        referrals,
        topReferrers,
        referralTotal: referrals.length,
      });
    } finally {
      setCreditsLoading(false);
    }
  };

  // ── Reports ───────────────────────────────────────────────────────────────
  const loadReports = useCallback(async (filter: ReportFilter, offset: number, append: boolean) => {
    let query = supabase
      .from('reports')
      .select(`id, target_type, target_id, reason, details, status, created_at,
        reporter:reporter_user_id(id, name, avatar_url),
        target_owner:target_owner_user_id(id, name, avatar_url)`)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    const items = (data as any) || [];
    setHasMoreReports(items.length === PAGE_SIZE);
    setReports(prev => append ? [...prev, ...items] : items);
    setReportsOffset(offset + items.length);
  }, []);

  const handleReportFilterChange = async (filter: ReportFilter) => {
    setReportFilter(filter);
    setReports([]);
    await loadReports(filter, 0, false);
  };

  const loadMoreReports = async () => {
    setLoadingMoreReports(true);
    await loadReports(reportFilter, reportsOffset, true);
    setLoadingMoreReports(false);
  };

  const handleReportStatus = async (reportId: string, status: string) => {
    const { error } = await supabase.from('reports').update({ status }).eq('id', reportId);
    if (error) { toast.error('Greška pri ažuriranju'); return; }
    toast.success('Status ažuriran');
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r));
    if (status !== 'open') fetchStats();
  };

  const handleDeletePostFromReport = async (postId: string, reportId: string) => {
    if (!confirm('Obrisati prijavljeni post? Ova akcija je nepovratna.')) return;
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) { toast.error('Greška pri brisanju'); return; }
    toast.success('Post obrisan');
    await supabase.from('reports').update({ status: 'resolved' }).eq('id', reportId);
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
    fetchStats();
  };

  // ── Users ─────────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async (search: string, offset: number, append: boolean, countryFilter = '') => {
    let query = supabase
      .from('profiles')
      .select('id, name, email, account_type, avatar_url, is_admin, is_banned, created_at, city, country')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (search.trim()) {
      query = (query as any).or(`name.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`);
    }
    if (countryFilter.trim()) {
      query = (query as any).ilike('country', `%${countryFilter}%`);
    }
    const { data } = await query;
    const items = (data || []) as UserProfile[];
    setHasMoreUsers(items.length === PAGE_SIZE);
    setUsers(prev => append ? [...prev, ...items] : items);
    setUsersOffset(offset + items.length);
  }, []);

  const handleUserSearchChange = (value: string) => {
    setUserSearch(value);
    if (userSearchTimeout.current) clearTimeout(userSearchTimeout.current);
    userSearchTimeout.current = setTimeout(() => {
      setUsers([]);
      loadUsers(value, 0, false, userCountryFilter);
    }, 300);
  };

  const handleUserCountryFilterChange = (value: string) => {
    setUserCountryFilter(value);
    if (userSearchTimeout.current) clearTimeout(userSearchTimeout.current);
    userSearchTimeout.current = setTimeout(() => {
      setUsers([]);
      loadUsers(userSearch, 0, false, value);
    }, 300);
  };

  const loadMoreUsers = async () => {
    setLoadingMoreUsers(true);
    await loadUsers(userSearch, usersOffset, true, userCountryFilter);
    setLoadingMoreUsers(false);
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!confirm(`Obrisati korisnika "${name}"? Ova akcija je nepovratna.`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error('Greška pri brisanju: ' + (json.error ?? res.status)); return; }
      toast.success(`Korisnik "${name}" obrisan`);
      setUsers(prev => prev.filter(u => u.id !== userId));
      fetchStats();
    } catch (e: any) {
      toast.error('Greška pri brisanju: ' + e.message);
    }
  };

  const handleSendNotification = async () => {
    if (!notifTarget || !notifTitle.trim() || !notifBody.trim()) return;
    setSendingNotif(true);
    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: notifTarget.id,
        type: 'admin',
        title: notifTitle.trim(),
        body: notifBody.trim(),
        meta: notifLink.trim() ? { link: notifLink.trim() } : {},
      });
      if (error) throw error;
      toast.success(`Notifikacija poslana korisniku "${notifTarget.name}"`);
      setNotifTarget(null);
      setNotifTitle('');
      setNotifBody('');
      setNotifLink('/services');
    } catch (e: any) {
      toast.error('Greška: ' + e.message);
    } finally {
      setSendingNotif(false);
    }
  };

  const handleToggleBan = async (userId: string, name: string, currentlyBanned: boolean) => {
    const action = currentlyBanned ? 'odbanirati' : 'banovati';
    if (!confirm(`Da li želiš da ${action} korisnika "${name}"?`)) return;
    const { error } = await supabase.from('profiles').update({ is_banned: !currentlyBanned }).eq('id', userId);
    if (error) { toast.error('Greška. Provjeri da li postoji kolona is_banned u tabeli profiles.'); return; }
    toast.success(`Korisnik "${name}" je ${currentlyBanned ? 'odbaniran' : 'banovan'}`);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: !currentlyBanned } : u));
  };

  // ── Posts ─────────────────────────────────────────────────────────────────
  const loadPosts = useCallback(async (offset: number, append: boolean) => {
    const { data, error } = await supabase
      .from('posts')
      .select('id, text, created_at, views_count, status, user_id, post_type, is_promoted')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) { console.error('Posts fetch error:', error); return; }

    const postItems = data || [];

    // Fetch authors separately
    const userIds = [...new Set(postItems.map((p: any) => p.user_id).filter(Boolean))];
    let authorsMap: Record<string, { id: string; name: string; avatar_url?: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds);
      (profiles || []).forEach((p: any) => { authorsMap[p.id] = p; });
    }

    const items: PostItem[] = postItems.map((p: any) => ({
      id: p.id,
      content: p.text,
      created_at: p.created_at,
      views_count: p.views_count || 0,
      status: p.status,
      post_type: p.post_type || 'social_post',
      is_promoted: p.is_promoted || false,
      author: authorsMap[p.user_id] || null,
    }));

    setHasMorePosts(items.length === PAGE_SIZE);
    setPosts(prev => append ? [...prev, ...items] : items);
    setPostsOffset(offset + items.length);
  }, []);

  const loadMorePosts = async () => {
    setLoadingMorePosts(true);
    await loadPosts(postsOffset, true);
    setLoadingMorePosts(false);
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Obrisati ovaj post? Ova akcija je nepovratna.')) return;
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) { toast.error('Greška pri brisanju'); return; }
    toast.success('Post obrisan');
    setPosts(prev => prev.filter(p => p.id !== postId));
    fetchStats();
  };

  const handleTogglePromoted = async (postId: string, current: boolean) => {
    const { error } = await supabase.from('posts').update({ is_promoted: !current }).eq('id', postId);
    if (error) { toast.error('Greška'); return; }
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_promoted: !current } : p));
    toast.success(!current ? 'Post označen kao sponzorisan' : 'Sponzorstvo uklonjeno');
  };

  // ── Support ───────────────────────────────────────────────────────────────
  const fetchTickets = async () => {
    const { data, error } = await supabase
      .from('support_messages')
      .select(`*, profiles:user_id (name, email)`)
      .order('created_at', { ascending: false });
    if (!error) setTickets(data || []);
  };

  const handleTicketStatus = async (ticketId: string, status: string) => {
    const { error } = await supabase.from('support_messages').update({ status }).eq('id', ticketId);
    if (error) { toast.error('Greška pri ažuriranju'); return; }
    toast.success('Status ažuriran');
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status } : t));
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm('Obrisati ovaj tiket?')) return;
    const { error } = await supabase.from('support_messages').delete().eq('id', ticketId);
    if (error) { toast.error('Greška pri brisanju'); return; }
    toast.success('Tiket obrisan');
    setTickets(prev => prev.filter(t => t.id !== ticketId));
  };

  // ── Announcements ─────────────────────────────────────────────────────────
  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, body, title_en, body_en, title_de, body_de, active, created_at')
      .order('created_at', { ascending: false });
    setAnnouncements(data || []);
  };

  const fetchLangStats = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('email, country, preferred_language')
      .not('email', 'is', null)
      .limit(100000);
    if (!data) return;
    const grouped: Record<string, string[]> = {};
    for (const u of data) {
      const countryKey = (u.country as string | null)?.toLowerCase().trim() ?? '';
      const fromCountry = COUNTRY_LANG_MAP[countryKey];
      const fromPref = (u.preferred_language as string | null)?.toLowerCase().trim();
      const lang = fromCountry ?? (fromPref && LANG_INFO[fromPref] ? fromPref : 'sr');
      if (!grouped[lang]) grouped[lang] = [];
      if (u.email) grouped[lang].push(u.email);
    }
    const stats = Object.entries(grouped)
      .map(([lang, emails]) => ({ lang, count: emails.length, emails }))
      .sort((a, b) => b.count - a.count);
    setLangStats(stats);
  };

  const handlePublishAnnouncement = async () => {
    if (!newTitle.trim() || !newBody.trim()) {
      toast.error('Popuni srpski naslov i tekst');
      return;
    }
    setSavingAnnouncement(true);
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title: newTitle.trim(),
        body: newBody.trim(),
        title_en: newTitleEn.trim() || null,
        body_en: newBodyEn.trim() || null,
        title_de: newTitleDe.trim() || null,
        body_de: newBodyDe.trim() || null,
        created_by: profile?.id,
      })
      .select()
      .single();
    if (error) { toast.error('Greška pri objavljivanju'); setSavingAnnouncement(false); return; }

    // Send notification to all users
    const { data: allUsers } = await supabase.from('profiles').select('id');
    if (allUsers && allUsers.length > 0) {
      const notifs = allUsers.map((u: any) => ({
        user_id: u.id,
        type: 'announcement',
        title: newTitle.trim(),
        body: newBody.trim(),
      }));
      await supabase.from('notifications').insert(notifs);
    }

    // Send emails if enabled
    if (sendEmail) {
      const res = await fetch('/api/announcements/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title_sr: newTitle.trim(),
          body_sr: newBody.trim(),
          title_en: newTitleEn.trim() || undefined,
          body_en: newBodyEn.trim() || undefined,
          title_de: newTitleDe.trim() || undefined,
          body_de: newBodyDe.trim() || undefined,
        }),
      });
      const json = await res.json();
      toast.success(`Obavještenje objavljeno — mejl poslat ${json.sent ?? 0} korisnika`);
    } else {
      toast.success('Obavještenje objavljeno i poslano svim korisnicima');
    }

    setNewTitle('');
    setNewBody('');
    setNewTitleEn('');
    setNewBodyEn('');
    setNewTitleDe('');
    setNewBodyDe('');
    setAnnouncements(prev => [data, ...prev]);
    setSavingAnnouncement(false);
  };

  const handleToggleAnnouncement = async (id: string, active: boolean) => {
    const { error } = await supabase.from('announcements').update({ active: !active }).eq('id', id);
    if (error) { toast.error('Greška'); return; }
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, active: !active } : a));
    toast.success(active ? 'Obavještenje deaktivirano' : 'Obavještenje aktivirano');
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Obrisati ovo obavještenje?')) return;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) { toast.error('Greška pri brisanju'); return; }
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    toast.success('Obavještenje obrisano');
  };

  if (!profile?.is_admin) return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-950 rounded-xl">
            <Shield className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Upravljanje platformom</p>
          </div>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Ukupno korisnika', value: stats.users, icon: Users, color: 'text-blue-500' },
              { label: 'Profesionalci', value: stats.professionals, icon: UserCheck, color: 'text-orange-500' },
              { label: 'Klijenti', value: stats.customers, icon: Users, color: 'text-cyan-500' },
              { label: 'Postovi', value: stats.posts, icon: FileText, color: 'text-purple-500' },
              { label: 'Razgovori', value: stats.messages, icon: MessageSquare, color: 'text-green-500' },
              { label: 'Svi reportovi', value: stats.reports, icon: AlertTriangle, color: 'text-yellow-500' },
              { label: 'Otvoreni reportovi', value: stats.openReports, icon: TrendingUp, color: 'text-red-500' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
                <Icon className={`h-5 w-5 ${color}`} />
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-1 border-b border-border min-w-max">
            {([
              { key: 'reports', label: `Reportovi (${stats?.openReports ?? 0})` },
              { key: 'users', label: `Korisnici (${stats?.users ?? 0})` },
              { key: 'posts', label: `Postovi (${stats?.posts ?? 0})` },
              { key: 'announcements', label: `Obavještenja` },
              { key: 'support', label: `Support (${tickets.filter(t => t.status === 'open').length})` },
              { key: 'analytics', label: 'Analitika' },
              { key: 'credits', label: 'Krediti' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => {
                  setActiveTab(key);
                  if (key === 'analytics') {
                    if (!analytics) fetchAnalytics(selectedYear);
                    if (!investStats) fetchInvestStats();
                  }
                  if (key === 'credits') {
                    if (!creditsStats) fetchCreditsStats();
                  }
                }}
                className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                  activeTab === key
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── REPORTS TAB ── */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            {/* Filter by type */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              {([
                { value: 'all', label: 'Svi tipovi' },
                { value: 'post', label: 'Objave' },
                { value: 'profile', label: 'Korisnici' },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setReportTypeFilter(value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    reportTypeFilter === value
                      ? 'bg-purple-500 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Filter by status */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              {(['all', 'open', 'reviewed', 'resolved'] as ReportFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => handleReportFilterChange(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    reportFilter === f
                      ? 'bg-orange-500 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {f === 'all' ? 'Svi' : STATUS_LABEL[f]}
                </button>
              ))}
            </div>

            {loading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)
            ) : reports.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">Nema reportova</p>
                <p className="text-sm">Sve je čisto!</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {reports.filter(r => reportTypeFilter === 'all' || r.target_type === reportTypeFilter).map(report => (
                    <div key={report.id} className="bg-card border border-border rounded-2xl p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          {/* Status + type + time */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[report.status]}`}>
                              {STATUS_LABEL[report.status] || report.status}
                            </span>
                            <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-medium">
                              {report.target_type === 'post' ? 'Post' : report.target_type === 'profile' ? 'Profil' : report.target_type}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                            </span>
                          </div>

                          {/* Reason */}
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              Razlog: {REASON_LABELS[report.reason] || report.reason}
                            </p>
                            {report.details && (
                              <p className="text-sm text-muted-foreground mt-1 bg-muted rounded-xl px-3 py-2">
                                "{report.details}"
                              </p>
                            )}
                          </div>

                          {/* Users */}
                          <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Prijavio:</span>
                              <Link href={`/profile/${report.reporter.id}`} className="flex items-center gap-1.5 hover:underline">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={report.reporter.avatar_url} />
                                  <AvatarFallback className="text-[9px] bg-blue-100 text-blue-700">
                                    {report.reporter.name.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium text-foreground">{report.reporter.name}</span>
                              </Link>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Prijavljeni:</span>
                              <Link href={`/profile/${report.target_owner.id}`} className="flex items-center gap-1.5 hover:underline">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={report.target_owner.avatar_url} />
                                  <AvatarFallback className="text-[9px] bg-red-100 text-red-700">
                                    {report.target_owner.name.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium text-foreground">{report.target_owner.name}</span>
                              </Link>
                            </div>
                          </div>

                          {/* Actions for post reports */}
                          {report.target_type === 'post' && (
                            <div className="flex items-center gap-3 flex-wrap">
                              <Link
                                href={`/posts/${report.target_id}`}
                                target="_blank"
                                className="inline-flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-500 font-medium"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Pogledaj post
                              </Link>
                              <button
                                onClick={() => handleDeletePostFromReport(report.target_id, report.id)}
                                className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 font-medium"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Obriši post
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Status select */}
                        <Select value={report.status} onValueChange={(v) => handleReportStatus(report.id, v)}>
                          <SelectTrigger className="w-[130px] shrink-0 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Otvoren</SelectItem>
                            <SelectItem value="reviewed">Pregledano</SelectItem>
                            <SelectItem value="resolved">Riješeno</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>

                {hasMoreReports && (
                  <button
                    onClick={loadMoreReports}
                    disabled={loadingMoreReports}
                    className="w-full py-3 rounded-2xl border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center justify-center gap-2"
                  >
                    {loadingMoreReports
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Učitavanje...</>
                      : <><ChevronDown className="h-4 w-4" /> Učitaj još</>
                    }
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── USERS TAB ── */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => handleUserSearchChange(e.target.value)}
                  placeholder="Pretraži po imenu, emailu, gradu..."
                  className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-orange-500/50 transition-colors"
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={userCountryFilter}
                  onChange={(e) => handleUserCountryFilterChange(e.target.value)}
                  placeholder="Zemlja..."
                  className="w-36 bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-orange-500/50 transition-colors"
                />
              </div>
            </div>

            {loading ? (
              [...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nema korisnika</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {users.map(u => (
                    <div key={u.id} className={`bg-card border rounded-2xl px-4 py-3 flex items-center gap-3 ${u.is_banned ? 'border-red-300 dark:border-red-800 opacity-75' : 'border-border'}`}>
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={u.avatar_url} />
                        <AvatarFallback className="bg-orange-100 text-orange-700 font-semibold text-sm">
                          {u.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">{u.name}</span>
                          {u.is_admin && (
                            <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 px-2 py-0.5 rounded-full font-medium">Admin</span>
                          )}
                          {u.is_banned && (
                            <span className="text-xs bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">Banovan</span>
                          )}
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                            {u.account_type === 'professional' ? 'Profesionalac' : 'Klijent'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        {(u.city || u.country) && (
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {[u.city, u.country].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Link href={`/profile/${u.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl" title="Pogledaj profil">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-xl text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                          title="Pošalji notifikaciju"
                          onClick={() => { setNotifTarget({ id: u.id, name: u.name }); setNotifTitle(''); setNotifBody(''); setNotifLink('/services'); }}
                        >
                          <Bell className="h-4 w-4" />
                        </Button>
                        {!u.is_admin && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-8 w-8 p-0 rounded-xl transition-colors ${
                                u.is_banned
                                  ? 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950'
                                  : 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-950'
                              }`}
                              title={u.is_banned ? 'Odbani korisnika' : 'Banuj korisnika'}
                              onClick={() => handleToggleBan(u.id, u.name, !!u.is_banned)}
                            >
                              {u.is_banned ? <UserCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                              title="Obriši korisnika"
                              onClick={() => handleDeleteUser(u.id, u.name)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {hasMoreUsers && (
                  <button
                    onClick={loadMoreUsers}
                    disabled={loadingMoreUsers}
                    className="w-full py-3 rounded-2xl border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center justify-center gap-2"
                  >
                    {loadingMoreUsers
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Učitavanje...</>
                      : <><ChevronDown className="h-4 w-4" /> Učitaj još</>
                    }
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── POSTS TAB ── */}
        {activeTab === 'posts' && (
          <div className="space-y-3">
            {/* Post type filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              {([
                { value: 'all', label: 'Svi' },
                { value: 'social_post', label: 'Feed' },
                { value: 'service_listing', label: 'Usluge' },
                { value: 'hiring_post', label: 'Zapošljavanje' },
                { value: 'service_request', label: 'Tražim uslugu' },
                { value: 'job_seeker_post', label: 'Tražim posao' },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => {
                    setPostTypeFilter(value);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    postTypeFilter === value
                      ? 'bg-orange-500 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              [...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
            ) : posts.filter(p => postTypeFilter === 'all' || p.post_type === postTypeFilter).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nema postova</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {posts.filter(p => postTypeFilter === 'all' || p.post_type === postTypeFilter).map(post => (
                    <div key={post.id} className="bg-card border border-border rounded-2xl px-4 py-3 flex items-start gap-3">
                      {post.author && (
                        <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5">
                          <AvatarImage src={post.author.avatar_url} />
                          <AvatarFallback className="bg-purple-100 text-purple-700 text-xs font-semibold">
                            {post.author.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {post.author && (
                            <Link href={`/profile/${post.author.id}`} className="text-sm font-semibold text-foreground hover:underline">
                              {post.author.name}
                            </Link>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                          </span>
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {post.views_count || 0}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                            {post.post_type === 'social_post' ? 'Feed'
                              : post.post_type === 'service_listing' ? 'Usluga'
                              : post.post_type === 'hiring_post' ? 'Zapošljavanje'
                              : post.post_type === 'service_request' ? 'Tražim uslugu'
                              : post.post_type === 'job_seeker_post' ? 'Tražim posao'
                              : post.post_type}
                          </span>
                          {post.is_promoted && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded-full font-semibold">
                              Sponzorisano
                            </span>
                          )}
                          {post.status !== 'published' && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                              {post.status}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {post.content || '(bez teksta)'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 px-2 rounded-xl text-xs font-semibold ${post.is_promoted ? 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400' : 'text-muted-foreground hover:text-yellow-600 hover:bg-yellow-50'}`}
                          title={post.is_promoted ? 'Ukloni sponzorstvo' : 'Označi kao sponzorisano'}
                          onClick={() => handleTogglePromoted(post.id, post.is_promoted)}
                        >
                          {post.is_promoted ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        </Button>
                        <Link href={`/posts/${post.id}`} target="_blank">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl" title="Pogledaj post">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                          title="Obriši post"
                          onClick={() => handleDeletePost(post.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {hasMorePosts && (
                  <button
                    onClick={loadMorePosts}
                    disabled={loadingMorePosts}
                    className="w-full py-3 rounded-2xl border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center justify-center gap-2"
                  >
                    {loadingMorePosts
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Učitavanje...</>
                      : <><ChevronDown className="h-4 w-4" /> Učitaj još</>
                    }
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── SUPPORT TAB ── */}
        {activeTab === 'support' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              {([
                { value: 'all', label: 'Svi' },
                { value: 'open', label: 'Otvoreni' },
                { value: 'in_progress', label: 'U toku' },
                { value: 'resolved', label: 'Riješeno' },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTicketFilter(value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    ticketFilter === value
                      ? 'bg-orange-500 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={fetchTickets}
                className="ml-auto px-3 py-1.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" /> Osvježi
              </button>
            </div>

            {tickets.filter(t => ticketFilter === 'all' || t.status === ticketFilter).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nema tiketa</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets
                  .filter(t => ticketFilter === 'all' || t.status === ticketFilter)
                  .map(ticket => (
                    <div key={ticket.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                      {/* Header */}
                      <button
                        onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                        className="w-full px-5 py-4 flex items-start justify-between gap-3 text-left hover:bg-accent transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                              ticket.status === 'open' ? STATUS_COLORS.open
                              : ticket.status === 'in_progress' ? STATUS_COLORS.reviewed
                              : STATUS_COLORS.resolved
                            }`}>
                              {ticket.status === 'open' ? 'Otvoren'
                                : ticket.status === 'in_progress' ? 'U toku'
                                : 'Riješeno'}
                            </span>
                            {ticket.category && (
                              <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                                {ticket.category}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-foreground truncate">{ticket.subject}</p>
                          {ticket.profiles && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {ticket.profiles.name} · {ticket.profiles.email}
                            </p>
                          )}
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform ${expandedTicket === ticket.id ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Expanded content */}
                      {expandedTicket === ticket.id && (
                        <div className="px-5 pb-4 space-y-3 border-t border-border pt-3">
                          <p className="text-sm text-foreground whitespace-pre-wrap bg-muted rounded-xl px-4 py-3">
                            {ticket.message}
                          </p>
                          {ticket.attachment_url && (
                            <a
                              href={ticket.attachment_url}
                              target="_blank"
                              className="inline-flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-500 font-medium"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              {ticket.attachment_name || 'Prilog'}
                            </a>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Select value={ticket.status} onValueChange={(v) => handleTicketStatus(ticket.id, v)}>
                              <SelectTrigger className="w-[140px] rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Otvoren</SelectItem>
                                <SelectItem value="in_progress">U toku</SelectItem>
                                <SelectItem value="resolved">Riješeno</SelectItem>
                              </SelectContent>
                            </Select>
                            <button
                              onClick={() => handleDeleteTicket(ticket.id)}
                              className="p-2 rounded-xl text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ── ANNOUNCEMENTS TAB ── */}
        {activeTab === 'announcements' && (
          <div className="space-y-5">

            {/* Create form */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-orange-500" />
                Novo obavještenje
              </p>

              {/* Serbian */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🇷🇸 Srpski (obavezno)</p>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Naslov..."
                  className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-orange-500/50 transition-colors"
                />
                <textarea
                  value={newBody}
                  onChange={e => setNewBody(e.target.value)}
                  placeholder="Tekst obavještenja..."
                  rows={3}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-orange-500/50 transition-colors resize-none"
                />
              </div>

              {/* English */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🇬🇧 English (opciono)</p>
                <input
                  type="text"
                  value={newTitleEn}
                  onChange={e => setNewTitleEn(e.target.value)}
                  placeholder="Title..."
                  className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-orange-500/50 transition-colors"
                />
                <textarea
                  value={newBodyEn}
                  onChange={e => setNewBodyEn(e.target.value)}
                  placeholder="Announcement text..."
                  rows={3}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-orange-500/50 transition-colors resize-none"
                />
              </div>

              {/* German */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🇩🇪 Deutsch (opciono)</p>
                <input
                  type="text"
                  value={newTitleDe}
                  onChange={e => setNewTitleDe(e.target.value)}
                  placeholder="Titel..."
                  className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-orange-500/50 transition-colors"
                />
                <textarea
                  value={newBodyDe}
                  onChange={e => setNewBodyDe(e.target.value)}
                  placeholder="Ankündigungstext..."
                  rows={3}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-orange-500/50 transition-colors resize-none"
                />
              </div>

              {/* Email toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setSendEmail(v => !v)}
                  className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${sendEmail ? 'bg-orange-500' : 'bg-muted-foreground/30'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${sendEmail ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm text-muted-foreground">Pošalji i mejl svim korisnicima</span>
              </label>

              <button
                onClick={handlePublishAnnouncement}
                disabled={savingAnnouncement || !newTitle.trim() || !newBody.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {savingAnnouncement
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Objavljivanje...</>
                  : <><Megaphone className="h-4 w-4" /> Objavi svim korisnicima</>
                }
              </button>
            </div>

            {/* Language breakdown table */}
            {langStats.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <p className="text-sm font-semibold text-foreground">Korisnici po jeziku</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border">
                        <th className="pb-2 pr-4 font-medium">Jezik</th>
                        <th className="pb-2 pr-4 font-medium">Korisnici</th>
                        <th className="pb-2 font-medium">Emailovi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {langStats.map(({ lang, count, emails }) => (
                        <tr key={lang} className="border-b border-border/50 last:border-0">
                          <td className="py-2.5 pr-4 font-medium">
                            {lang === 'other'
                              ? '🌍 Ostalo'
                              : `${LANG_INFO[lang]?.flag ?? '🌐'} ${LANG_INFO[lang]?.name ?? lang.toUpperCase()}`}
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{count}</td>
                          <td className="py-2.5">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(emails.join(', '));
                                toast.success(`${count} email adresa kopirano`);
                              }}
                              className="text-xs px-3 py-1 bg-muted hover:bg-accent rounded-lg border border-border transition-colors"
                            >
                              Kopiraj email adrese
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* List */}
            {announcements.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nema obavještenja</p>
                <p className="text-sm">Kreiraj prvo obavještenje gore</p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map(a => (
                  <div key={a.id} className={`bg-card border rounded-2xl p-5 ${a.active ? 'border-orange-300 dark:border-orange-800' : 'border-border opacity-60'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{a.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            a.active
                              ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {a.active ? 'Aktivno' : 'Neaktivno'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-3">{a.body}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleToggleAnnouncement(a.id, a.active)}
                          title={a.active ? 'Deaktiviraj' : 'Aktiviraj'}
                          className={`p-1.5 rounded-xl transition-colors ${
                            a.active
                              ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-950'
                              : 'text-muted-foreground hover:bg-accent'
                          }`}
                        >
                          {a.active
                            ? <ToggleRight className="h-5 w-5" />
                            : <ToggleLeft className="h-5 w-5" />
                          }
                        </button>
                        <button
                          onClick={() => handleDeleteAnnouncement(a.id)}
                          title="Obriši"
                          className="p-1.5 rounded-xl text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CREDITS TAB ── */}
        {activeTab === 'credits' && (
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">Krediti & Creator Premium</h2>
              <button onClick={fetchCreditsStats} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <RefreshCw className={`h-3.5 w-3.5 ${creditsLoading ? 'animate-spin' : ''}`} />
                Osvježi
              </button>
            </div>

            {creditsLoading && !creditsStats ? (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
            ) : creditsStats ? (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Ukupno kredita u opticaju', value: creditsStats.totalBalance, icon: <Coins className="h-4 w-4 text-orange-500" />, color: 'text-orange-500' },
                    { label: 'Creator Premium korisnika', value: creditsStats.premiumCount, icon: <Crown className="h-4 w-4 text-amber-500" />, color: 'text-amber-500' },
                    { label: 'Transakcija (30 dana)', value: creditsStats.txLast30d, icon: <TrendingUp className="h-4 w-4 text-blue-500" />, color: 'text-blue-500' },
                    { label: 'Boost kupovina (30d)', value: creditsStats.breakdown?.boost?.count || 0, icon: <Sparkles className="h-4 w-4 text-purple-500" />, color: 'text-purple-500' },
                  ].map(({ label, value, icon, color }) => (
                    <div key={label} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs font-medium">{label}</span></div>
                      <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Breakdown po tipu */}
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart2 className="h-4 w-4 text-orange-500" />
                    <h3 className="font-semibold text-sm">Gdje korisnici troše/zarađuju (30 dana)</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { key: 'podrzi', label: '🧡 Podrži dugme', color: 'bg-orange-100 text-orange-700' },
                      { key: 'boost', label: '🚀 Boost postova', color: 'bg-purple-100 text-purple-700' },
                      { key: 'creator_premium', label: '⭐ Creator Premium', color: 'bg-amber-100 text-amber-700' },
                      { key: 'nagrada', label: '🎁 Nagrade (onboarding)', color: 'bg-green-100 text-green-700' },
                      { key: 'media_nagrada', label: '📸 Media nagrade', color: 'bg-blue-100 text-blue-700' },
                      { key: 'ostalo', label: '📦 Ostalo', color: 'bg-slate-100 text-slate-700' },
                    ].map(({ key, label, color }) => {
                      const d = creditsStats.breakdown?.[key] || { count: 0, total: 0 };
                      return (
                        <div key={key} className="rounded-xl border border-border p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
                          <p className="text-lg font-bold text-foreground">{d.count} <span className="text-xs font-normal text-muted-foreground">transakcija</span></p>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>{d.total} kredita</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Posljednje transakcije */}
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="h-4 w-4 text-orange-500" />
                    <h3 className="font-semibold text-sm">Posljednjih 30 transakcija</h3>
                  </div>
                  <div className="space-y-2">
                    {creditsStats.recent.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Nema transakcija</p>
                    ) : creditsStats.recent.map((tx: any, i: number) => {
                      const isPositive = tx.amount > 0;
                      const desc = tx.description || '';
                      const typeLabel = desc.startsWith('boost_post') ? '🚀 Boost'
                        : desc === 'become_creator_premium' ? '⭐ Creator Premium'
                        : desc === 'Podrška poslata' ? '🧡 Podrži (poslato)'
                        : desc === 'Primljena podrška' ? '🧡 Podrži (primljeno)'
                        : desc === 'Nagrada: registration' ? '🎁 Registracija'
                        : desc === 'Nagrada: first_post' ? '🎁 Prvi post'
                        : desc === 'Nagrada: first_service' ? '🎁 Prva usluga'
                        : desc === 'Nagrada: first_job' ? '🎁 Posao'
                        : desc === 'Nagrada: profile_completed' ? '🎁 Profil'
                        : desc === 'Nagrada: referral' ? '🎁 Referral'
                        : desc === 'Post nagrada: slika' ? '📸 Slika'
                        : desc === 'Post nagrada: video' ? '🎥 Video'
                        : desc || '—';
                      return (
                        <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={tx.profile?.avatar_url} />
                            <AvatarFallback className="text-[10px]">{tx.profile?.name?.[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{tx.profile?.name || 'Nepoznat'}</p>
                            <p className="text-[10px] text-muted-foreground">{typeLabel}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                              {isPositive ? '+' : ''}{tx.amount}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Referral statistike */}
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      <h3 className="font-semibold text-sm">Referral pozivi ({creditsStats.referralTotal})</h3>
                    </div>
                  </div>

                  {/* Top pozivači */}
                  {creditsStats.topReferrers?.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Top pozivači</p>
                      <div className="space-y-2">
                        {creditsStats.topReferrers.map((r: any, i: number) => (
                          <div key={r.id} className="flex items-center gap-3">
                            <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}.</span>
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarImage src={r.avatar_url} />
                              <AvatarFallback className="text-[10px]">{r.name?.[0]}</AvatarFallback>
                            </Avatar>
                            <p className="text-xs font-semibold flex-1">{r.name}</p>
                            <span className="text-xs font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">{r.count} poziva</span>
                            <button onClick={() => router.push(`/profile/${r.id}`)} className="text-muted-foreground hover:text-foreground">
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Posljednji referrali */}
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Posljednji pozivi</p>
                  {creditsStats.referrals?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nema referrala još</p>
                  ) : (
                    <div className="space-y-2">
                      {creditsStats.referrals?.slice(0, 10).map((r: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">
                              <span className="text-blue-600">{r.referrer?.name || '—'}</span>
                              <span className="text-muted-foreground mx-1">→</span>
                              <span>{r.referred?.name || '—'}</span>
                            </p>
                          </div>
                          <p className="text-[10px] text-muted-foreground shrink-0">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Creator Premium korisnici */}
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Crown className="h-4 w-4 text-amber-500" />
                    <h3 className="font-semibold text-sm">Creator Premium korisnici ({creditsStats.premiumCount})</h3>
                  </div>
                  {creditsStats.premiumUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nema Premium korisnika</p>
                  ) : (
                    <div className="space-y-2">
                      {creditsStats.premiumUsers.map((u: any) => (
                        <div key={u.id} className="flex items-center gap-3">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={u.avatar_url} />
                            <AvatarFallback className="text-[10px]">{u.name?.[0]}</AvatarFallback>
                          </Avatar>
                          <p className="text-xs font-semibold flex-1">{u.name}</p>
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">⭐ Creator</span>
                          <button onClick={() => router.push(`/profile/${u.id}`)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex justify-center py-16 text-muted-foreground text-sm">Klikni Osvježi za učitavanje podataka</div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Year selector */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Godina:</span>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: new Date().getFullYear() - 2024 + 1 }, (_, i) => 2025 + i).map(year => (
                  <button
                    key={year}
                    onClick={() => {
                      setSelectedYear(year);
                      setAnalytics(null);
                      fetchAnalytics(year);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      selectedYear === year
                        ? 'bg-orange-500 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>

            {analyticsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              </div>
            ) : analytics ? (
              <>
                {/* KPI cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                  {[
                    { label: 'Aktivni danas', value: analytics.dau, icon: Activity, color: 'text-green-500' },
                    { label: 'Aktivni (7 dana)', value: analytics.wau, icon: TrendingUp, color: 'text-blue-500' },
                    { label: 'Aktivni (30 dana)', value: analytics.mau, icon: Users, color: 'text-purple-500' },
                    { label: 'Aktivni (godišnje)', value: analytics.yau, icon: TrendingUp, color: 'text-indigo-500' },
                    { label: 'Novi ove sedmice', value: analytics.newUsersThisWeek, icon: CalendarDays, color: 'text-orange-500' },
                    { label: 'Novi ovog mjeseca', value: analytics.newUsersThisMonth, icon: CalendarDays, color: 'text-pink-500' },
                    { label: 'Novi ove godine', value: analytics.newUsersThisYear, icon: CalendarDays, color: 'text-rose-500' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
                      <Icon className={`h-5 w-5 ${color}`} />
                      <p className="text-2xl font-bold text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Page views table */}
                  <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-orange-500" />
                      <h3 className="font-semibold text-sm text-foreground">Pregledi po stranicama</h3>
                    </div>
                    {analytics.pageViews.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Nema podataka</p>
                    ) : (
                      <div className="space-y-2">
                        {analytics.pageViews.map(({ page, count }) => {
                          const maxCount = analytics.pageViews[0]?.count || 1;
                          const pct = Math.round((count / maxCount) * 100);
                          return (
                            <div key={page} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-medium text-foreground capitalize">{page}</span>
                                <span className="text-muted-foreground">{count}</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-orange-500 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>

                {/* Cities and Countries side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Top cities */}
                  <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-500" />
                      <h3 className="font-semibold text-sm text-foreground">Korisnici po gradovima</h3>
                    </div>
                    {analytics.topCities.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Nema podataka</p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {analytics.topCities.map(({ city, count }) => {
                          const maxCount = analytics.topCities[0]?.count || 1;
                          const pct = Math.round((count / maxCount) * 100);
                          return (
                            <div key={city} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-medium text-foreground">{city}</span>
                                <span className="text-muted-foreground">{count}</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Top countries */}
                  <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-purple-500" />
                      <h3 className="font-semibold text-sm text-foreground">Korisnici po državama</h3>
                    </div>
                    {analytics.topCountries.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Nema podataka — korisnici još nisu unijeli državu</p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {analytics.topCountries.map(({ country, count }) => {
                          const maxCount = analytics.topCountries[0]?.count || 1;
                          const pct = Math.round((count / maxCount) * 100);
                          return (
                            <div key={country} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-medium text-foreground">{country}</span>
                                <span className="text-muted-foreground">{count}</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-purple-500 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Monthly charts — last 12 months */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Monthly new users */}
                  <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-orange-500" />
                      <h3 className="font-semibold text-sm text-foreground">Novi korisnici — {selectedYear}.</h3>
                    </div>
                    <div className="flex items-end gap-1 h-28">
                      {analytics.monthlyNewUsers.map(({ month, count }) => {
                        const maxCount = Math.max(...analytics.monthlyNewUsers.map(d => d.count), 1);
                        const heightPct = Math.max((count / maxCount) * 100, 2);
                        const label = new Date(month + '-01').toLocaleDateString('sr-RS', { month: 'short' });
                        return (
                          <div key={month} className="flex-1 flex flex-col items-center gap-1 group relative">
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] rounded px-1 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                              {count} novih
                            </div>
                            <div className="w-full bg-muted rounded-t-lg overflow-hidden flex items-end" style={{ height: '90px' }}>
                              <div className="w-full bg-orange-500 rounded-t-lg transition-all" style={{ height: `${heightPct}%` }} />
                            </div>
                            <span className="text-[9px] text-muted-foreground">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Monthly active users */}
                  <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-indigo-500" />
                      <h3 className="font-semibold text-sm text-foreground">Aktivni korisnici — {selectedYear}.</h3>
                    </div>
                    <div className="flex items-end gap-1 h-28">
                      {analytics.monthlyActiveUsers.map(({ month, count }) => {
                        const maxCount = Math.max(...analytics.monthlyActiveUsers.map(d => d.count), 1);
                        const heightPct = Math.max((count / maxCount) * 100, 2);
                        const label = new Date(month + '-01').toLocaleDateString('sr-RS', { month: 'short' });
                        return (
                          <div key={month} className="flex-1 flex flex-col items-center gap-1 group relative">
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] rounded px-1 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                              {count} aktivnih
                            </div>
                            <div className="w-full bg-muted rounded-t-lg overflow-hidden flex items-end" style={{ height: '90px' }}>
                              <div className="w-full bg-indigo-500 rounded-t-lg transition-all" style={{ height: `${heightPct}%` }} />
                            </div>
                            <span className="text-[9px] text-muted-foreground">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Signup sources */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-orange-500" />
                      <h3 className="font-semibold text-sm text-foreground">Registracije po izvoru</h3>
                    </div>
                    {analytics.signupSources.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Nema podataka</p>
                    ) : (
                      <div className="space-y-2">
                        {analytics.signupSources.map(({ source, count }) => {
                          const total = analytics.signupSources.reduce((s, x) => s + x.count, 0);
                          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                          const colors: Record<string, string> = {
                            join_page: 'bg-orange-500',
                            homepage: 'bg-blue-500',
                            guest_gate: 'bg-purple-500',
                            direct: 'bg-slate-400',
                          };
                          const labels: Record<string, string> = {
                            join_page: 'Join stranica',
                            homepage: 'Početna',
                            guest_gate: 'Guest gate',
                            direct: 'Direktno',
                          };
                          return (
                            <div key={source}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium">{labels[source] || source}</span>
                                <span className="text-muted-foreground">{count} ({pct}%)</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full ${colors[source] || 'bg-slate-500'} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Daily new users (last 30 days) */}
                  <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-emerald-500" />
                      <h3 className="font-semibold text-sm text-foreground">Novi korisnici — zadnjih 30 dana</h3>
                    </div>
                    <div className="flex items-end gap-0.5 h-28">
                      {analytics.dailyNewUsers.map(({ date, count }) => {
                        const maxCount = Math.max(...analytics.dailyNewUsers.map(d => d.count), 1);
                        const heightPct = Math.max((count / maxCount) * 100, count > 0 ? 4 : 0);
                        return (
                          <div key={date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] rounded px-1 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                              {count} — {date.slice(5)}
                            </div>
                            <div className="w-full bg-muted rounded-t overflow-hidden flex items-end" style={{ height: '90px' }}>
                              <div className="w-full bg-emerald-500 rounded-t transition-all" style={{ height: `${heightPct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">Hover za detalje · svaki stub = 1 dan</p>
                  </div>
                </div>

                {/* Daily active users chart (last 7 days) */}
                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-green-500" />
                      <h3 className="font-semibold text-sm text-foreground">Aktivni korisnici — zadnjih 7 dana</h3>
                    </div>
                    <button
                      onClick={() => fetchAnalytics(selectedYear)}
                      className="text-xs text-orange-500 hover:underline"
                    >
                      Osvježi
                    </button>
                  </div>
                  {analytics.dailyActiveUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nema podataka</p>
                  ) : (
                    <div className="flex items-end gap-2 h-32">
                      {analytics.dailyActiveUsers.map(({ date, count }) => {
                        const maxCount = Math.max(...analytics.dailyActiveUsers.map(d => d.count), 1);
                        const heightPct = Math.max((count / maxCount) * 100, 4);
                        const label = new Date(date).toLocaleDateString('sr-RS', { weekday: 'short', day: 'numeric', month: 'numeric' });
                        return (
                          <div key={date} className="flex-1 flex flex-col items-center gap-1 group relative">
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] rounded px-1 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              {count} korisnika
                            </div>
                            <div className="w-full bg-muted rounded-t-lg overflow-hidden flex items-end" style={{ height: '100px' }}>
                              <div
                                className="w-full bg-green-500 rounded-t-lg transition-all"
                                style={{ height: `${heightPct}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-muted-foreground text-center leading-tight">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              {/* ── INVEST ANALYTICS ── */}
              <div className="mt-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-orange-500" />
                    <h3 className="font-semibold text-sm text-foreground">Invest — Lista čekanja</h3>
                  </div>
                  <button
                    onClick={() => { setInvestStats(null); fetchInvestStats(); }}
                    className="text-xs text-orange-500 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" /> Osvježi
                  </button>
                </div>

                {investLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                  </div>
                ) : investStats ? (
                  <div className="space-y-4">
                    {/* Summary cards */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Ukupno na listi', value: investStats.waitlistTotal, color: 'text-orange-500' },
                        { label: 'Ukupno interesa', value: investStats.interestsTotal, color: 'text-blue-500' },
                        { label: 'Projekata', value: investStats.projectsTotal, color: 'text-purple-500' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="bg-card border border-border rounded-2xl p-4 text-center">
                          <p className={`text-2xl font-black ${color}`}>{value}</p>
                          <p className="text-xs text-muted-foreground mt-1">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Role breakdown */}
                    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Po ulozi</h4>
                      {investStats.byRole.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">Nema podataka</p>
                      ) : (
                        <div className="space-y-2">
                          {investStats.byRole.map(({ role, count }) => {
                            const pct = investStats.waitlistTotal > 0 ? Math.round((count / investStats.waitlistTotal) * 100) : 0;
                            const roleLabels: Record<string, string> = {
                              investor: 'Investitor',
                              business_owner: 'Vlasnik biznisa',
                              startup_founder: 'Osnivač startapa',
                              service_business: 'Servisni biznis',
                            };
                            const roleColors: Record<string, string> = {
                              investor: 'bg-orange-500',
                              business_owner: 'bg-blue-500',
                              startup_founder: 'bg-purple-500',
                              service_business: 'bg-emerald-500',
                            };
                            return (
                              <div key={role}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="font-medium">{roleLabels[role] || role}</span>
                                  <span className="text-muted-foreground">{count} ({pct}%)</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div className={`h-full ${roleColors[role] || 'bg-slate-500'} rounded-full`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Recent signups */}
                    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zadnjih 8 prijava</h4>
                      {investStats.recent.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">Nema prijava</p>
                      ) : (
                        <div className="space-y-2">
                          {investStats.recent.map((w, i) => {
                            const roleLabels: Record<string, string> = {
                              investor: 'Investitor',
                              business_owner: 'Vlasnik biznisa',
                              startup_founder: 'Osnivač startapa',
                              service_business: 'Servisni biznis',
                            };
                            return (
                              <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{w.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{w.email}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium">
                                    {roleLabels[w.role] || w.role}
                                  </span>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {formatDistanceToNow(new Date(w.created_at), { addSuffix: true })}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <button onClick={fetchInvestStats} className="text-orange-500 hover:underline">Učitaj invest podatke</button>
                  </div>
                )}
              </div>

              </>
            ) : (
              <div className="text-center py-20 text-muted-foreground text-sm">
                Kliknite na tab za učitavanje analitike
              </div>
            )}
          </div>
        )}

      </div>
    </div>

    {/* Send notification modal */}

    {notifTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setNotifTarget(null)}>
        <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-lg flex items-center gap-2"><Bell className="h-5 w-5 text-blue-500" /> Pošalji notifikaciju</h3>
            <button onClick={() => setNotifTarget(null)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Korisnik: <strong className="text-foreground">{notifTarget.name}</strong></p>
          <div className="space-y-3">
            <input
              type="text"
              value={notifTitle}
              onChange={e => setNotifTitle(e.target.value)}
              placeholder="Naslov notifikacije..."
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition-colors"
            />
            <textarea
              value={notifBody}
              onChange={e => setNotifBody(e.target.value)}
              placeholder="Tekst notifikacije..."
              rows={3}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition-colors resize-none"
            />
            <input
              type="text"
              value={notifLink}
              onChange={e => setNotifLink(e.target.value)}
              placeholder="Link (npr. /services)"
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition-colors"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setNotifTarget(null)}>Otkaži</Button>
            <Button
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handleSendNotification}
              disabled={sendingNotif || !notifTitle.trim() || !notifBody.trim()}
            >
              {sendingNotif
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Slanje...</>
                : <><Bell className="h-4 w-4 mr-2" />Pošalji</>}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default function AdminPage() {
  return (
    <ProtectedRoute>
      <AdminContent />
    </ProtectedRoute>
  );
}
