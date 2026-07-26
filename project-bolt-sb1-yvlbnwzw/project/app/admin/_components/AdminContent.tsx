'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { notificationRepository } from '@/lib/repositories/notificationRepository';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, FileText, AlertTriangle, Shield, MessageSquare, TrendingUp,
  Crown,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  ActiveTab, AnalyticsData, Announcement, CreditsStats, InvestStats,
  LangStat, PostItem, Report, ReportFilter, Stats, SupportTicket, UserProfile,
} from './types';
import { COUNTRY_LANG_MAP, LANG_INFO, PAGE_SIZE } from './constants';
import { ReportsTab } from './tabs/ReportsTab';
import { UsersTab } from './tabs/UsersTab';
import { PostsTab } from './tabs/PostsTab';
import { SupportTab } from './tabs/SupportTab';
import { AnnouncementsTab } from './tabs/AnnouncementsTab';
import { CreditsTab } from './tabs/CreditsTab';
import { AnalyticsTab } from './tabs/AnalyticsTab';
import { SendNotifModal } from './SendNotifModal';

export function AdminContent() {
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
  const [editLocationId, setEditLocationId] = useState<string | null>(null);
  const [editLocationCity, setEditLocationCity] = useState('');
  const [editLocationCountry, setEditLocationCountry] = useState('');
  const [usersOffset, setUsersOffset] = useState(0);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const userSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedTabs = useRef<Set<ActiveTab>>(new Set());

  // Posts state
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [postsOffset, setPostsOffset] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [postTypeFilter, setPostTypeFilter] = useState<string>('all');
  const [postSearch, setPostSearch] = useState('');
  const [searchedPosts, setSearchedPosts] = useState<PostItem[] | null>(null);
  const [searchingPosts, setSearchingPosts] = useState(false);
  const postSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [emailOffset, setEmailOffset] = useState(0);
  const [langStats, setLangStats] = useState<LangStat[]>([]);

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
  const [creditsStats, setCreditsStats] = useState<CreditsStats | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditsPeriod, setCreditsPeriod] = useState(30);

  // Grant credits state
  const [creditTarget, setCreditTarget] = useState<{ id: string; name: string } | null>(null);
  const [creditAmount, setCreditAmount] = useState('30');
  const [grantingCredits, setGrantingCredits] = useState(false);

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
      await Promise.all([fetchStats(), loadReports('all', 0, false)]);
      loadedTabs.current.add('reports');
      setLoading(false);
    })();
  }, [profile]);

  // ── Post search debounce ──────────────────────────────────────────────────
  useEffect(() => {
    if (postSearchTimeout.current) clearTimeout(postSearchTimeout.current);
    if (!postSearch.trim()) { setSearchedPosts(null); return; }
    postSearchTimeout.current = setTimeout(() => searchPosts(postSearch), 350);
    return () => { if (postSearchTimeout.current) clearTimeout(postSearchTimeout.current); };
  }, [postSearch]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const fetchStats = async () => {
    const [
      { count: userCount },
      { count: professionals },
      { count: customers },
      { count: postCount },
      { count: reportCount },
      { count: openReports },
      { count: messages },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_premium', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_premium', false),
      supabase.from('posts').select('*', { count: 'exact', head: true }),
      supabase.from('reports').select('*', { count: 'exact', head: true }),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('threads').select('*', { count: 'exact', head: true }),
    ]);
    setStats({
      users: userCount || 0,
      professionals: professionals || 0,
      customers: customers || 0,
      posts: postCount || 0,
      reports: reportCount || 0,
      openReports: openReports || 0,
      messages: messages || 0,
    });
  };

  // ── Analytics ─────────────────────────────────────────────────────────────
  const fetchAnalytics = async (year?: number) => {
    const targetYear = year ?? selectedYear;
    setAnalyticsLoading(true);
    try {
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const chosenYearStart = new Date(`${targetYear}-01-01T00:00:00.000Z`);
      const chosenYearEnd = new Date(`${targetYear + 1}-01-01T00:00:00.000Z`);

      const [
        { data: allViews },
        { data: activeUserCounts },
        { count: newWeekCount },
        { count: newMonthCount },
        { count: newYearCount },
        { data: cityProfiles },
        { data: countryProfiles },
        { data: daily7 },
        { data: monthlyActiveRpc },
        { data: monthlyNewRpc },
        { data: signupSourceData },
        { data: utmSourceData },
        { data: daily30Profiles },
      ] = await Promise.all([
        supabase.rpc('get_page_view_counts'),
        supabase.rpc('get_active_user_counts', {
          today_start: todayStart.toISOString(),
          week_start:  weekStart.toISOString(),
          month_start: monthStart.toISOString(),
          year_start:  chosenYearStart.toISOString(),
          year_end:    chosenYearEnd.toISOString(),
        }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekStart.toISOString()),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', chosenYearStart.toISOString()).lt('created_at', chosenYearEnd.toISOString()),
        supabase.from('profiles').select('city').not('city', 'is', null),
        supabase.from('profiles').select('country').not('country', 'is', null),
        supabase.rpc('get_daily_active_users', { week_start: weekStart.toISOString() }),
        supabase.rpc('get_monthly_active_users', { year_start: chosenYearStart.toISOString(), year_end: chosenYearEnd.toISOString() }),
        supabase.rpc('get_monthly_new_users', { year_start: chosenYearStart.toISOString(), year_end: chosenYearEnd.toISOString() }),
        supabase.from('profiles').select('signup_source').not('signup_source', 'is', null),
        supabase.from('profiles').select('utm_source, utm_medium, utm_campaign').not('utm_source', 'is', null),
        supabase.from('profiles').select('created_at').gte('created_at', monthStart.toISOString()),
      ]);

      // Signup source aggregation
      const sourceCount: Record<string, number> = {};
      for (const p of (signupSourceData as any[] || [])) {
        const s = p.signup_source || 'direct';
        sourceCount[s] = (sourceCount[s] || 0) + 1;
      }
      const signupSources = Object.entries(sourceCount).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);

      // UTM source aggregation
      const utmCount: Record<string, number> = {};
      for (const p of (utmSourceData as any[] || [])) {
        const s = p.utm_source || 'direct';
        utmCount[s] = (utmCount[s] || 0) + 1;
      }
      const utmSources = Object.entries(utmCount).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);

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

      // Page views
      const pageViews = (allViews || []).map((r: any) => ({ page: r.page, count: Number(r.count) }));

      // Active user counts from RPC
      const counts = (activeUserCounts as any)?.[0] ?? {};
      const dau = Number(counts.dau ?? 0);
      const wau = Number(counts.wau ?? 0);
      const mau = Number(counts.mau ?? 0);
      const yau = Number(counts.yau ?? 0);

      // Monthly new users
      const monthlyNewMap: Record<string, number> = {};
      for (let m = 0; m < 12; m++) {
        monthlyNewMap[`${targetYear}-${String(m + 1).padStart(2, '0')}`] = 0;
      }
      for (const r of (monthlyNewRpc as any[] || [])) {
        if (r.month in monthlyNewMap) monthlyNewMap[r.month] = Number(r.count);
      }
      const monthlyNewUsers = Object.entries(monthlyNewMap).map(([month, count]) => ({ month, count }));

      // Monthly active users
      const rpcActiveMap: Record<string, number> = {};
      for (let m = 0; m < 12; m++) {
        rpcActiveMap[`${targetYear}-${String(m + 1).padStart(2, '0')}`] = 0;
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
        'kragujevac': 'Kragujevac', 'subotica': 'Subotica', 'curug': 'Čurug', 'čurug': 'Čurug',
        'novi pazar': 'Novi Pazar', 'leskovac': 'Leskovac', 'pancevo': 'Pančevo', 'pančevo': 'Pančevo',
        'cacak': 'Čačak', 'čačak': 'Čačak', 'krusevac': 'Kruševac', 'kruševac': 'Kruševac',
        'kraljevo': 'Kraljevo', 'smederevo': 'Smederevo', 'zagreb': 'Zagreb',
        'sarajevo': 'Sarajevo', 'vienna': 'Wien', 'wien': 'Wien',
        'munich': 'München', 'münchen': 'München', 'berlin': 'Berlin',
      };
      const normalizeCity = (city: string) => cityAliases[city.toLowerCase().trim()] || city.trim();
      const cityCount: Record<string, number> = {};
      for (const p of cityProfiles || []) {
        if (p.city) {
          const normalized = normalizeCity(p.city);
          cityCount[normalized] = (cityCount[normalized] || 0) + 1;
        }
      }
      const topCities = Object.entries(cityCount).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);

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
      const topCountries = Object.entries(countryCount).map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count);

      // Daily active users (last 7 days)
      const dailyRpcMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        dailyRpcMap[d.toISOString().slice(0, 10)] = 0;
      }
      for (const r of (daily7 as any[] || [])) {
        const key = (r.date as string).slice(0, 10);
        if (key in dailyRpcMap) dailyRpcMap[key] = Number(r.count);
      }
      const dailyActiveUsers = Object.entries(dailyRpcMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setAnalytics({
        pageViews, dau, wau, mau, yau,
        newUsersThisWeek: newWeekCount || 0,
        newUsersThisMonth: newMonthCount || 0,
        newUsersThisYear: newYearCount || 0,
        topCities, topCountries, dailyActiveUsers,
        monthlyNewUsers, monthlyActiveUsers, signupSources,
        dailyNewUsers, utmSources,
      });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // ── Invest analytics ──────────────────────────────────────────────────────
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
      for (const w of waitlist) roleMap[w.role] = (roleMap[w.role] || 0) + 1;
      const byRole = Object.entries(roleMap).map(([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count);
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

  // ── Credits analytics ─────────────────────────────────────────────────────
  const fetchCreditsStats = async (days: number = creditsPeriod) => {
    setCreditsLoading(true);
    setCreditsPeriod(days);
    try {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const [txRes, balanceRes, premiumRes, recentRes, referralsRes] = await Promise.all([
        supabase.from('credit_transactions').select('amount, platform_fee, description, created_at').gte('created_at', cutoff),
        supabase.from('credits_balance').select('balance'),
        supabase.from('profiles').select('id, name, avatar_url, is_premium').eq('is_premium', true),
        supabase.from('credit_transactions')
          .select('user_id, amount, description, created_at, profiles!credit_transactions_user_id_fkey(name, avatar_url)')
          .gte('created_at', cutoff).order('created_at', { ascending: false }).limit(50),
        supabase.from('referrals')
          .select('referrer_id, created_at, referrer:referrer_id(name, avatar_url), referred:referred_id(name, avatar_url, created_at)')
          .gte('created_at', cutoff).order('created_at', { ascending: false }).limit(200),
      ]);

      const txData = txRes.data || [];
      const totalBalance = (balanceRes.data || []).reduce((sum: number, r: any) => sum + (r.balance || 0), 0);

      const breakdown: Record<string, { count: number; total: number }> = {};
      let platformEarnings = 0;
      for (const tx of txData) {
        const desc = tx.description || '';
        const key = desc.startsWith('boost_post') ? 'boost'
          : desc === 'become_creator_premium' ? 'creator_premium'
          : desc === 'Podrška poslata' ? 'podrzi'
          : desc === 'Nagrada: referral' ? 'referral'
          : desc.startsWith('Nagrada:') ? 'nagrada'
          : desc.startsWith('Post nagrada:') ? 'media_nagrada'
          : 'ostalo';
        if (!breakdown[key]) breakdown[key] = { count: 0, total: 0 };
        breakdown[key].count++;
        breakdown[key].total += Math.abs(tx.amount);
        if (tx.platform_fee && desc === 'Podrška poslata') platformEarnings += tx.platform_fee;
      }

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
        txCount: txData.length,
        platformEarnings,
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
    if (search.trim()) query = (query as any).or(`name.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`);
    if (countryFilter.trim()) query = (query as any).ilike('country', `%${countryFilter}%`);
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

  const handleSaveLocation = async (userId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/admin/update-user-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ userId, city: editLocationCity.trim(), country: editLocationCountry.trim() }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || 'Greška pri čuvanju'); return; }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, city: editLocationCity.trim(), country: editLocationCountry.trim() } : u));
    setEditLocationId(null);
    toast.success('Lokacija ažurirana');
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!confirm(`Obrisati korisnika "${name}"? Ova akcija je nepovratna.`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
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

  const handleToggleBan = async (userId: string, name: string, currentlyBanned: boolean) => {
    const action = currentlyBanned ? 'odbanirati' : 'banovati';
    if (!confirm(`Da li želiš da ${action} korisnika "${name}"?`)) return;
    const { error } = await supabase.from('profiles').update({ is_banned: !currentlyBanned }).eq('id', userId);
    if (error) { toast.error('Greška. Provjeri da li postoji kolona is_banned u tabeli profiles.'); return; }
    toast.success(`Korisnik "${name}" je ${currentlyBanned ? 'odbaniran' : 'banovan'}`);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: !currentlyBanned } : u));
  };

  const handleGrantCredits = async () => {
    if (!creditTarget) return;
    const amount = parseInt(creditAmount);
    if (!amount || amount <= 0) return;
    setGrantingCredits(true);
    const { data, error } = await supabase.rpc('admin_grant_credits', {
      p_user_id: creditTarget.id,
      p_amount: amount,
      p_note: 'Admin dodjela',
    });
    setGrantingCredits(false);
    if (error || !(data as { ok?: boolean } | null)?.ok) {
      toast.error('Greška pri dodjeli kredita');
    } else {
      toast.success(`Dodijeljeno ${amount} kredita korisniku ${creditTarget.name}`);
      setCreditTarget(null);
      setCreditAmount('30');
    }
  };

  const handleSendNotification = async () => {
    if (!notifTarget || !notifTitle.trim() || !notifBody.trim()) return;
    setSendingNotif(true);
    try {
      await notificationRepository.insert({
        user_id: notifTarget.id,
        type: 'admin',
        title: notifTitle.trim(),
        body: notifBody.trim(),
        meta: notifLink.trim() ? { link: notifLink.trim() } : {},
      });
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

  // ── Posts ─────────────────────────────────────────────────────────────────
  const loadPosts = useCallback(async (offset: number, append: boolean) => {
    const { data, error } = await supabase
      .from('posts')
      .select('id, text, created_at, views_count, status, user_id, post_type, is_promoted, author:profiles!user_id(id, name, avatar_url)')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) { console.error('Posts fetch error:', error); return; }
    const items: PostItem[] = (data || []).map((p: any) => ({
      id: p.id, content: p.text, created_at: p.created_at,
      views_count: p.views_count || 0, status: p.status,
      post_type: p.post_type || 'social_post', is_promoted: p.is_promoted || false,
      author: p.author || null,
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

  const searchPosts = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchedPosts(null); return; }
    setSearchingPosts(true);
    const { data: matchingProfiles } = await supabase.from('profiles').select('id, name, avatar_url').ilike('name', `%${query}%`).limit(50);
    const matchingIds = (matchingProfiles || []).map((p: any) => p.id);
    const profilesMap: Record<string, { id: string; name: string; avatar_url?: string }> = {};
    (matchingProfiles || []).forEach((p: any) => { profilesMap[p.id] = p; });

    let allPosts: any[] = [];
    const { data: byContent } = await supabase.from('posts').select('id, text, created_at, views_count, status, user_id, post_type, is_promoted').ilike('text', `%${query}%`).order('created_at', { ascending: false }).limit(50);
    allPosts = [...(byContent || [])];
    if (matchingIds.length > 0) {
      const { data: byAuthor } = await supabase.from('posts').select('id, text, created_at, views_count, status, user_id, post_type, is_promoted').in('user_id', matchingIds).order('created_at', { ascending: false }).limit(50);
      (byAuthor || []).forEach((p: any) => { if (!allPosts.find((x: any) => x.id === p.id)) allPosts.push(p); });
    }
    const missingIds = [...new Set(allPosts.map((p: any) => p.user_id).filter((id: string) => !profilesMap[id]))];
    if (missingIds.length > 0) {
      const { data: extra } = await supabase.from('profiles').select('id, name, avatar_url').in('id', missingIds);
      (extra || []).forEach((p: any) => { profilesMap[p.id] = p; });
    }
    const items: PostItem[] = allPosts.map((p: any) => ({
      id: p.id, content: p.text, created_at: p.created_at,
      views_count: p.views_count || 0, status: p.status,
      post_type: p.post_type || 'social_post', is_promoted: p.is_promoted || false,
      author: profilesMap[p.user_id] || null,
    }));
    setSearchedPosts(items);
    setSearchingPosts(false);
  }, []);

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Obrisati ovaj post? Ova akcija je nepovratna.')) return;
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) { toast.error('Greška pri brisanju'); return; }
    toast.success('Post obrisan');
    setPosts(prev => prev.filter(p => p.id !== postId));
    setSearchedPosts(prev => prev ? prev.filter(p => p.id !== postId) : null);
    fetchStats();
  };

  const handleTogglePromoted = async (postId: string, current: boolean) => {
    const { error } = await supabase.from('posts').update({ is_promoted: !current }).eq('id', postId);
    if (error) { toast.error('Greška'); return; }
    const updateFn = (p: PostItem) => p.id === postId ? { ...p, is_promoted: !current } : p;
    setPosts(prev => prev.map(updateFn));
    setSearchedPosts(prev => prev ? prev.map(updateFn) : null);
    toast.success(!current ? 'Post označen kao sponzorisan' : 'Sponzorstvo uklonjeno');
  };

  const handleLiftShadow = async (postId: string) => {
    const { error } = await supabase.from('posts').update({ status: 'published' }).eq('id', postId);
    if (error) { toast.error('Greška'); return; }
    const updateFn = (p: PostItem) => p.id === postId ? { ...p, status: 'published' } : p;
    setPosts(prev => prev.map(updateFn));
    setSearchedPosts(prev => prev ? prev.map(updateFn) : null);
    toast.success('Shadow ban uklonjen');
  };

  // ── Support ───────────────────────────────────────────────────────────────
  const fetchTickets = async () => {
    const { data, error } = await supabase
      .from('support_messages')
      .select(`*, profiles:user_id (name, email)`)
      .order('created_at', { ascending: false })
      .limit(200);
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
    const { data } = await supabase.from('profiles').select('email, country, preferred_language').not('email', 'is', null).limit(10000);
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
    const stats = Object.entries(grouped).map(([lang, emails]) => ({ lang, count: emails.length, emails })).sort((a, b) => b.count - a.count);
    setLangStats(stats);
  };

  const handlePublishAnnouncement = async () => {
    if (!newTitle.trim() || !newBody.trim()) { toast.error('Popuni srpski naslov i tekst'); return; }
    setSavingAnnouncement(true);
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title: newTitle.trim(), body: newBody.trim(),
        title_en: newTitleEn.trim() || null, body_en: newBodyEn.trim() || null,
        title_de: newTitleDe.trim() || null, body_de: newBodyDe.trim() || null,
        created_by: profile?.id,
      })
      .select().single();
    if (error) { toast.error('Greška pri objavljivanju'); setSavingAnnouncement(false); return; }

    const { data: allUsers } = await supabase.from('profiles').select('id');
    if (allUsers && allUsers.length > 0) {
      const notifs = allUsers.map((u: any) => ({
        user_id: u.id, type: 'announcement', action_type: 'announcement',
        title: newTitle.trim(), body: newBody.trim(),
        meta: {
          title_en: newTitleEn.trim() || null, body_en: newBodyEn.trim() || null,
          title_de: newTitleDe.trim() || null, body_de: newBodyDe.trim() || null,
        },
      }));
      await notificationRepository.insertMany(notifs);
    }

    if (sendEmail) {
      const res = await fetch('/api/announcements/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title_sr: newTitle.trim(), body_sr: newBody.trim(),
          title_en: newTitleEn.trim() || undefined, body_en: newBodyEn.trim() || undefined,
          title_de: newTitleDe.trim() || undefined, body_de: newBodyDe.trim() || undefined,
          offset: emailOffset,
        }),
      });
      const json = await res.json();
      toast.success(`Obavještenje objavljeno — mejl poslat ${json.sent ?? 0} korisnika`);
    } else {
      toast.success('Obavještenje objavljeno i poslano svim korisnicima');
    }

    setNewTitle(''); setNewBody(''); setNewTitleEn(''); setNewBodyEn(''); setNewTitleDe(''); setNewBodyDe('');
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
  const handleTabClick = (key: ActiveTab) => {
    setActiveTab(key);
    if (!loadedTabs.current.has(key)) {
      loadedTabs.current.add(key);
      if (key === 'users') loadUsers('', 0, false);
      if (key === 'posts') loadPosts(0, false);
      if (key === 'announcements') { fetchAnnouncements(); fetchLangStats(); }
      if (key === 'support') fetchTickets();
    }
    if (key === 'analytics') {
      if (!analytics) fetchAnalytics(selectedYear);
      if (!investStats) fetchInvestStats();
    }
    if (key === 'credits') {
      if (!creditsStats) fetchCreditsStats();
    }
  };

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
                { label: 'PRO korisnici', value: stats.professionals, icon: Crown, color: 'text-orange-500' },
                { label: 'Besplatni', value: stats.customers, icon: Users, color: 'text-cyan-500' },
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
                { key: 'announcements', label: 'Obavještenja' },
                { key: 'support', label: `Support (${tickets.filter(t => t.status === 'open').length})` },
                { key: 'analytics', label: 'Analitika' },
                { key: 'credits', label: 'Krediti' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleTabClick(key)}
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

          {/* Tab content */}
          {activeTab === 'reports' && (
            <ReportsTab
              reports={reports}
              loading={loading}
              reportFilter={reportFilter}
              reportTypeFilter={reportTypeFilter}
              hasMoreReports={hasMoreReports}
              loadingMoreReports={loadingMoreReports}
              onFilterChange={handleReportFilterChange}
              onTypeFilterChange={setReportTypeFilter}
              onStatusChange={handleReportStatus}
              onDeletePost={handleDeletePostFromReport}
              onLoadMore={loadMoreReports}
            />
          )}

          {activeTab === 'users' && (
            <UsersTab
              users={users}
              loading={loading}
              userSearch={userSearch}
              userCountryFilter={userCountryFilter}
              hasMoreUsers={hasMoreUsers}
              loadingMoreUsers={loadingMoreUsers}
              editLocationId={editLocationId}
              editLocationCity={editLocationCity}
              editLocationCountry={editLocationCountry}
              creditTarget={creditTarget}
              creditAmount={creditAmount}
              grantingCredits={grantingCredits}
              onSearchChange={handleUserSearchChange}
              onCountryFilterChange={handleUserCountryFilterChange}
              onLoadMore={loadMoreUsers}
              onEditLocationStart={(userId, city, country) => { setEditLocationId(userId); setEditLocationCity(city); setEditLocationCountry(country); }}
              onEditLocationCancel={() => setEditLocationId(null)}
              onEditLocationCityChange={setEditLocationCity}
              onEditLocationCountryChange={setEditLocationCountry}
              onSaveLocation={handleSaveLocation}
              onCreditTargetSet={(target) => { setCreditTarget(target); setCreditAmount('30'); }}
              onCreditTargetClear={() => setCreditTarget(null)}
              onCreditAmountChange={setCreditAmount}
              onGrantCredits={handleGrantCredits}
              onToggleBan={handleToggleBan}
              onDeleteUser={handleDeleteUser}
              onNotifTargetSet={(target) => { setNotifTarget(target); setNotifTitle(''); setNotifBody(''); setNotifLink('/services'); }}
            />
          )}

          {activeTab === 'posts' && (
            <PostsTab
              posts={posts}
              searchedPosts={searchedPosts}
              loading={loading}
              searchingPosts={searchingPosts}
              postSearch={postSearch}
              postTypeFilter={postTypeFilter}
              hasMorePosts={hasMorePosts}
              loadingMorePosts={loadingMorePosts}
              onSearchChange={setPostSearch}
              onTypeFilterChange={setPostTypeFilter}
              onLoadMore={loadMorePosts}
              onDeletePost={handleDeletePost}
              onTogglePromoted={handleTogglePromoted}
              onLiftShadow={handleLiftShadow}
              onNotifTargetSet={setNotifTarget}
            />
          )}

          {activeTab === 'support' && (
            <SupportTab
              tickets={tickets}
              ticketFilter={ticketFilter}
              expandedTicket={expandedTicket}
              onFilterChange={setTicketFilter}
              onExpandTicket={setExpandedTicket}
              onStatusChange={handleTicketStatus}
              onDeleteTicket={handleDeleteTicket}
              onRefresh={fetchTickets}
            />
          )}

          {activeTab === 'announcements' && (
            <AnnouncementsTab
              announcements={announcements}
              langStats={langStats}
              newTitle={newTitle}
              newBody={newBody}
              newTitleEn={newTitleEn}
              newBodyEn={newBodyEn}
              newTitleDe={newTitleDe}
              newBodyDe={newBodyDe}
              sendEmail={sendEmail}
              emailOffset={emailOffset}
              savingAnnouncement={savingAnnouncement}
              onNewTitleChange={setNewTitle}
              onNewBodyChange={setNewBody}
              onNewTitleEnChange={setNewTitleEn}
              onNewBodyEnChange={setNewBodyEn}
              onNewTitleDeChange={setNewTitleDe}
              onNewBodyDeChange={setNewBodyDe}
              onSendEmailToggle={() => setSendEmail(v => !v)}
              onEmailOffsetChange={setEmailOffset}
              onPublish={handlePublishAnnouncement}
              onToggle={handleToggleAnnouncement}
              onDelete={handleDeleteAnnouncement}
            />
          )}

          {activeTab === 'credits' && (
            <CreditsTab
              creditsStats={creditsStats}
              creditsLoading={creditsLoading}
              creditsPeriod={creditsPeriod}
              onFetchStats={fetchCreditsStats}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsTab
              analytics={analytics}
              analyticsLoading={analyticsLoading}
              selectedYear={selectedYear}
              investStats={investStats}
              investLoading={investLoading}
              onFetchAnalytics={fetchAnalytics}
              onYearChange={(year) => { setSelectedYear(year); setAnalytics(null); }}
              onFetchInvestStats={() => { setInvestStats(null); fetchInvestStats(); }}
            />
          )}

        </div>
      </div>

      <SendNotifModal
        target={notifTarget}
        title={notifTitle}
        body={notifBody}
        link={notifLink}
        sending={sendingNotif}
        onClose={() => setNotifTarget(null)}
        onTitleChange={setNotifTitle}
        onBodyChange={setNotifBody}
        onLinkChange={setNotifLink}
        onSend={handleSendNotification}
      />
    </>
  );
}
