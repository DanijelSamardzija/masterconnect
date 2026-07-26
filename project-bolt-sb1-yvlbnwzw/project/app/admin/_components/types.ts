export type Report = {
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

export type UserProfile = {
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

export type PostItem = {
  id: string;
  content: string;
  created_at: string;
  views_count: number;
  status: string;
  post_type: string;
  is_promoted: boolean;
  author: { id: string; name: string; avatar_url?: string } | null;
};

export type Stats = {
  users: number;
  professionals: number;
  customers: number;
  posts: number;
  reports: number;
  openReports: number;
  messages: number;
};

export type SupportTicket = {
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

export type Announcement = {
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

export type ActiveTab = 'reports' | 'users' | 'posts' | 'announcements' | 'support' | 'analytics' | 'credits';

export type PageViewStat = {
  page: string;
  count: number;
};

export type DailyActiveUsers = {
  date: string;
  count: number;
};

export type FunnelStep = {
  key: string;
  label: string;
  sublabel: string;
  count: number;
  available: boolean;
  color: string;
};

// ── Phase 18 – Global Date Filter ────────────────────────────────────────────
export type DatePreset = '7d' | '30d' | '90d' | 'year' | 'custom';

export type DateRange = {
  preset: DatePreset;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  year?: number; // set when preset === 'year'
};

export type AnalyticsData = {
  pageViews: PageViewStat[];
  dau: number;
  wau: number;
  mau: number;
  yau: number;
  // kept for KPI cards (current calendar week/month/year, always "now")
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  newUsersThisYear: number;
  topCities: { city: string; count: number }[];
  topCountries: { country: string; count: number }[];
  dailyActiveUsers: DailyActiveUsers[];
  monthlyNewUsers: { month: string; count: number }[];
  monthlyActiveUsers: { month: string; count: number }[];
  signupSources: { source: string; count: number }[]; // filtered by dateRange
  dailyNewUsers: { date: string; count: number }[];   // filtered by dateRange
  utmSources: { source: string; count: number }[];    // filtered by dateRange
  contentStats: {
    todayByType: Record<string, number>;
    weekByType: Record<string, number>;
    monthByType: Record<string, number>;
  };
  reportAnalytics: {
    byStatus: { status: string; count: number }[];
    byReason: { reason: string; count: number }[];
    byType: { type: string; count: number }[];
    topReported: { id: string; name: string; avatar_url?: string; count: number }[];
    dailyTrend: { date: string; count: number }[];
  };
  // Phase 3 – Period comparison
  comparison: {
    rangeNewUsers: number;
    prevRangeNewUsers: number;
    rangeNewPosts: number;
    prevRangeNewPosts: number;
    rangeNewThreads: number;
    prevRangeNewThreads: number;
    rangeLabel: string;
  };
  // Phase 6 – Extended marketing
  marketingExtended: {
    utmCampaigns: { campaign: string; count: number }[];
    utmMediums: { medium: string; count: number }[];
  };
  // Phase 9 – Top content
  topContent: {
    id: string;
    content: string;
    post_type: string;
    views_count: number;
    created_at: string;
    author: { id: string; name: string; avatar_url?: string } | null;
  }[];
  // Phase 10 – Message analytics
  messageAnalytics: {
    newThreadsInRange: number;
    dailyTrend: { date: string; count: number }[];
  };
  // Always-current today KPIs (independent of active date range filter)
  todayNewUsers:   number;
  todayNewReports: number;
  // Activation Funnel
  funnel: {
    registeredUsers: number;
    usersWithPost: number;
  };
  // Churn Analytics
  churnData: {
    totalDeleted:  number;
    todayDeleted:  number;
    weekDeleted:   number;
    monthDeleted:  number;
    rangeDeleted:  number;
    byCountry:     { country: string; count: number }[];
    byReason:      { reason: string; count: number }[];
    dailyTrend:    { date: string; count: number }[];
  };
};

export type InvestStats = {
  waitlistTotal: number;
  byRole: { role: string; count: number }[];
  recent: { name: string; email: string; role: string; created_at: string }[];
  interestsTotal: number;
  projectsTotal: number;
};

export type CreditsStats = {
  totalBalance: number;
  premiumCount: number;
  premiumUsers: { id: string; name: string; avatar_url?: string; is_premium: boolean }[];
  txCount: number;
  platformEarnings: number;
  breakdown: Record<string, { count: number; total: number }>;
  recent: { amount: number; description: string; created_at: string; profile?: { name?: string; avatar_url?: string } }[];
  referrals: { referrer_id: string; created_at: string; referrer?: { name?: string; avatar_url?: string }; referred?: { name?: string; avatar_url?: string } }[];
  topReferrers: { id: string; name: string; avatar_url?: string; count: number }[];
  referralTotal: number;
};

export type ReportFilter = 'all' | 'open' | 'reviewed' | 'resolved';

export type LangStat = { lang: string; count: number; emails: string[] };
