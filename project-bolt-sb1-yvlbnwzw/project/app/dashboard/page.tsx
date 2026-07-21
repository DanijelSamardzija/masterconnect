'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { ProfessionalBadge } from '@/components/professional-badge';
import { useAuth } from '@/lib/contexts/auth-context';
import { usePageTracking } from '@/lib/hooks/use-page-tracking';
import { supabase } from '@/lib/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import {
  Briefcase, MessageSquare, Star, Plus,
  CheckCircle2, Clock, Bell, Trash2, Rss, UserCircle,
  ChevronRight, AlertCircle, Eye, TrendingUp, Calendar, Coins, ShieldCheck,
  Search, Wrench
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NotificationsModal, Notification } from '@/components/notifications-modal';
import { CreateMarketplacePostModal } from '@/components/create-marketplace-post-modal';
import { ReviewModal } from '@/components/review-modal';
import { OnboardingModal } from '@/components/onboarding-modal';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/contexts/language-context';
import { formatDistanceToNow } from 'date-fns';
import { sr } from 'date-fns/locale';
import { translateNotification } from '@/lib/notification-translations';

export const revalidate = 0;

type Job = {
  id: string;
  title: string;
  description: string;
  category: string;
  city: string;
  status: string;
  created_at: string;
};

type Thread = {
  id: string;
  job: { title: string } | null;
  customer: { name: string } | null;
  pro: { name: string } | null;
  created_at: string;
};

type Review = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  profiles: { name: string };
};

function DashboardContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const { t, language } = useLanguage();
  usePageTracking('dashboard');

  const [jobs, setJobs] = useState<Job[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingReviewPro, setPendingReviewPro] = useState<{ id: string; name: string } | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [profileViews, setProfileViews] = useState<{ total: number; week: number; today: number } | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [recentViewers, setRecentViewers] = useState<{ id: string; name: string; avatar_url: string | null; viewed_at: string }[]>([]);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [donations, setDonations] = useState<{ id: string; amount: number; anonymous: boolean; sender_name: string | null; sender_avatar: string | null; created_at: string }[]>([]);
  const [donationsOpen, setDonationsOpen] = useState(false);
  const [allReviewsOpen, setAllReviewsOpen] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPostType, setSelectedPostType] = useState<'service_listing' | 'service_request' | 'job_seeker_post' | 'hiring_post' | null>(null);

  useEffect(() => {
    fetchDashboardData();
    fetchUnreadCount();
    fetchNotifications();
    if (profile?.account_type === 'customer') fetchPendingReview();
    if (profile?.account_type === 'professional' || (profile as any)?.is_premium) fetchProfileViews();
    if ((profile as any)?.is_premium) { fetchCreditBalance(); fetchRecentViewers(); fetchDonations(); }

    const handleUnreadCountChanged = () => {
      fetchUnreadCount();
      fetchNotifications();
    };
    window.addEventListener('unreadCountChanged', handleUnreadCountChanged);

    const channel = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchUnreadCount())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload: any) => {
        if (payload.new?.user_id === profile?.id) fetchNotifications();
      })
      .subscribe();

    return () => {
      window.removeEventListener('unreadCountChanged', handleUnreadCountChanged);
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const fetchDashboardData = async () => {
    if (!profile) return;
    try {
      setLoading(true);
      setError('');
      const [jobsResult, reviewsResult] = await Promise.all([
        supabase.from('jobs').select('*').eq('customer_id', profile.id)
          .order('created_at', { ascending: false }).limit(5),
        supabase.from('reviews').select('*, profiles!reviews_customer_id_fkey(name)')
          .eq('pro_id', profile.id).order('created_at', { ascending: false }).limit(5),
      ]);
      if (jobsResult.error) throw jobsResult.error;
      if (reviewsResult.error) throw reviewsResult.error;
      setJobs(jobsResult.data || []);
      setReviews((reviewsResult.data as Review[]) || []);
    } catch (err: any) {
      setError(err.message || t('dashboard.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    if (!profile) return;
    const { data: participants } = await supabase
      .from('thread_participants').select('thread_id, last_read_at')
      .eq('user_id', profile.id).is('deleted_at', null);
    let total = 0;
    for (const p of participants || []) {
      const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true })
        .eq('thread_id', p.thread_id).neq('sender_id', profile.id)
        .gt('created_at', p.last_read_at || '1970-01-01');
      total += count || 0;
    }
    setUnreadCount(total);
  };

  const fetchPendingReview = async () => {
    if (!profile) return;
    // Find professionals the customer has chatted with but not reviewed
    const { data: participants } = await supabase
      .from('thread_participants').select('thread_id').eq('user_id', profile.id).is('deleted_at', null);
    if (!participants?.length) return;
    const threadIds = participants.map((p: any) => p.thread_id);
    const { data: otherParticipants } = await supabase
      .from('thread_participants').select('user_id, thread_id')
      .in('thread_id', threadIds).neq('user_id', profile.id);
    if (!otherParticipants?.length) return;
    const proIds = [...new Set(otherParticipants.map((p: any) => p.user_id))];
    const { data: pros } = await supabase
      .from('profiles').select('id, name, account_type').in('id', proIds).eq('account_type', 'professional');
    if (!pros?.length) return;
    const { data: existingReviews } = await supabase
      .from('reviews').select('pro_id').eq('customer_id', profile.id);
    const reviewedIds = new Set((existingReviews || []).map((r: any) => r.pro_id));
    const unreviewed = pros.find((p: any) => !reviewedIds.has(p.id));
    if (unreviewed) setPendingReviewPro({ id: unreviewed.id, name: unreviewed.name });
  };

  const fetchProfileViews = async () => {
    if (!profile) return;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: allViews } = await supabase
      .from('profile_views')
      .select('viewer_id, viewed_at')
      .eq('profile_id', profile.id);

    const rows = allViews || [];
    const unique = (list: typeof rows) => new Set(list.map(r => r.viewer_id)).size;

    const total = unique(rows);
    const week = unique(rows.filter(r => r.viewed_at >= startOfWeek));
    const today = unique(rows.filter(r => r.viewed_at >= startOfToday));

    setProfileViews({ total, week, today });
  };

  const fetchRecentViewers = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('profile_views')
      .select('viewer_id, viewed_at, profiles!profile_views_viewer_id_fkey(id, name, avatar_url)')
      .eq('profile_id', profile.id)
      .not('viewer_id', 'is', null)
      .neq('viewer_id', profile.id)
      .order('viewed_at', { ascending: false })
      .limit(20);

    if (!data) return;

    // Deduplicate — keep only latest view per viewer
    const seen = new Set<string>();
    const unique = data.filter((row: any) => {
      if (seen.has(row.viewer_id)) return false;
      seen.add(row.viewer_id);
      return true;
    });

    setRecentViewers(unique.map((row: any) => ({
      id: row.viewer_id,
      name: row.profiles?.name || 'Nepoznat',
      avatar_url: row.profiles?.avatar_url || null,
      viewed_at: row.viewed_at,
    })));
  };

  const fetchCreditBalance = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('credits_balance')
      .select('balance')
      .eq('user_id', profile.id)
      .maybeSingle();
    setCreditBalance(data?.balance ?? 0);
  };

  const fetchDonations = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('credit_transactions')
      .select('id, amount, anonymous, created_at, sender_id, profiles!credit_transactions_sender_id_fkey(name, avatar_url)')
      .eq('user_id', profile.id)
      .eq('type', 'support')
      .order('created_at', { ascending: false })
      .limit(10);
    setDonations((data || []).map((d: any) => ({
      id: d.id,
      amount: d.amount,
      anonymous: d.anonymous,
      sender_name: d.anonymous ? null : (d.profiles?.name ?? null),
      sender_avatar: d.anonymous ? null : (d.profiles?.avatar_url ?? null),
      created_at: d.created_at,
    })));
  };

  const fetchNotifications = async () => {
    if (!profile) return;
    const { data } = await supabase.from('notifications').select('*')
      .eq('user_id', profile.id).order('created_at', { ascending: false });
    const mapped: Notification[] = (data || []).map((n: any) => {
      const translated = translateNotification({ title: n.title, body: n.body, action_type: n.action_type, meta: n.meta }, language);
      return {
        id: n.id, type: n.type, title: translated.title, body: translated.body,
        time: formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: language === 'sr' ? sr : undefined }),
        read: !!n.read_at, meta: { ...(n.meta || {}), post_id: n.post_id },
      };
    });
    setNotifications(mapped);
    setNotificationsCount(mapped.filter(n => !n.read).length);
  };

  const handleOpenNotifications = async () => {
    setNotificationsOpen(true);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setNotificationsCount(0);
    await (supabase.from('notifications') as any).update({ read_at: new Date().toISOString() })
      .eq('user_id', profile?.id).is('read_at', null);
    window.dispatchEvent(new Event('unreadCountChanged'));
  };

  const handleMarkAllRead = async () => {
    if (!profile) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setNotificationsCount(0);
    await (supabase.from('notifications') as any).update({ read_at: new Date().toISOString() })
      .eq('user_id', profile.id).is('read_at', null);
    window.dispatchEvent(new Event('unreadCountChanged'));
  };

  const handleClearAll = async () => {
    if (!profile) return;
    setNotifications([]);
    setNotificationsCount(0);
    await supabase.from('notifications').delete().eq('user_id', profile.id);
    window.dispatchEvent(new Event('unreadCountChanged'));
  };

  const handleNotificationClick = (notification: Notification) => {
    setNotificationsOpen(false);
    if (notification.type === 'message' && notification.meta?.thread_id) { router.push(`/messages/${notification.meta.thread_id}`); return; }
    if (notification.type === 'save') {
      const pt = notification.meta?.post_type as string | undefined;
      if (pt === 'service_listing') router.push(`/services/${notification.meta?.post_id}`);
      else if (['hiring_post', 'service_request', 'job_seeker_post'].includes(pt || '')) router.push('/jobs');
      else router.push('/feed');
      return;
    }
    if (['comment', 'reply', 'reaction'].includes(notification.type)) { if (notification.meta?.post_id) router.push('/feed'); return; }
    if (notification.type === 'follow') { if (notification.meta?.follower_id) router.push(`/profile/${notification.meta.follower_id}`); return; }
    if (notification.linkUrl) { router.push(notification.linkUrl); return; }
    if (notification.messageId) { router.push(`/messages/${notification.messageId}`); return; }
    if (notification.jobId) { router.push(`/jobs/${notification.jobId}`); return; }
    switch (notification.type) {
      case 'message': router.push('/messages'); break;
      case 'job': case 'job_request': router.push('/jobs'); break;
      case 'review': router.push(`/profile/${profile?.id}`); break;
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    const { error } = await supabase.from('jobs').delete().eq('id', jobId);
    if (error) { toast.error('Greška pri brisanju'); return; }
    toast.success('Posao obrisan');
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
          <p className="text-sm text-muted-foreground">Učitavamo vaš profil...</p>
        </div>
      </div>
    );
  }

  const isPro = (profile as any).is_premium === true;
  const isPremium = (profile as any).is_premium === true;

  // Profile completeness
  const completenessFields = [
    { key: 'avatar', done: !!profile.avatar_url, label: t('profileComplete.addAvatar') },
    { key: 'bio', done: !!(profile as any).bio?.trim(), label: t('profileComplete.addBio') },
    { key: 'category', done: !!(profile as any).category?.trim(), label: t('profileComplete.addCategory') },
    { key: 'city', done: !!(profile as any).city?.trim(), label: t('profileComplete.addCity') },
  ];
  const completePct = Math.round((completenessFields.filter(f => f.done).length / completenessFields.length) * 100);
  const missingFields = completenessFields.filter(f => !f.done);
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Welcome header */}
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
          <Avatar className="h-14 w-14 flex-shrink-0">
            <AvatarImage src={profile.avatar_url} />
            <AvatarFallback className="bg-orange-100 text-orange-700 font-bold text-lg">
              {profile.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">
              {t('dashboard.greeting')} {profile.name.split(' ')[0]}
            </h1>
            {isPremium && <ProfessionalBadge size="sm" variant="premium" />}
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="rounded-2xl">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Profile completeness card */}
        {completePct < 100 && (
          <div className="bg-card border border-orange-200 dark:border-orange-900 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <p className="text-sm font-semibold text-foreground">{t('profileComplete.title')}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                completePct >= 75 ? 'bg-green-100 text-green-700' :
                completePct >= 50 ? 'bg-yellow-100 text-yellow-700' :
                'bg-orange-100 text-orange-700'
              }`}>
                {completePct}% {t('profileComplete.complete')}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mb-3">
              <div
                className="h-1.5 rounded-full bg-orange-500 transition-all"
                style={{ width: `${completePct}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {missingFields.map(f => (
                <span key={f.key} className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                  + {f.label}
                </span>
              ))}
            </div>
            <button
              onClick={() => router.push('/profile/edit')}
              className="text-xs font-semibold text-orange-600 hover:text-orange-500"
            >
              {t('profileComplete.editProfile')} →
            </button>
          </div>
        )}

        {/* Pending review card (customers only) */}
        {pendingReviewPro && !isPro && (
          <div className="bg-card border border-yellow-200 dark:border-yellow-900 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-yellow-100 dark:bg-yellow-950 rounded-xl shrink-0">
              <Star className="h-4 w-4 text-yellow-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{t('dashboard.pendingReview')}</p>
              <p className="text-xs text-muted-foreground truncate">
                {t('dashboard.pendingReviewDesc').replace('{name}', pendingReviewPro.name)}
              </p>
            </div>
            <button
              onClick={() => setReviewModalOpen(true)}
              className="text-xs font-semibold text-orange-600 hover:text-orange-500 shrink-0"
            >
              {t('dashboard.leaveReview')}
            </button>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
            <Briefcase className="h-5 w-5 text-blue-500 mb-1" />
            <p className="text-2xl font-bold text-foreground">
              {jobs.filter(j => j.status === 'open').length}
            </p>
            <p className="text-xs text-muted-foreground">{t('dashboard.activeJobs')}</p>
          </div>
          <button
            onClick={() => router.push('/messages')}
            className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1 text-left hover:border-orange-400/50 hover:bg-accent transition-colors"
          >
            <MessageSquare className="h-5 w-5 text-green-500 mb-1" />
            <p className="text-2xl font-bold text-foreground">{unreadCount}</p>
            <p className="text-xs text-muted-foreground">{t('dashboard.messages')}</p>
          </button>
          <button
            onClick={handleOpenNotifications}
            className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1 text-left hover:border-orange-400/50 hover:bg-accent transition-colors"
          >
            <Bell className="h-5 w-5 text-orange-500 mb-1" />
            <p className="text-2xl font-bold text-foreground">{notificationsCount}</p>
            <p className="text-xs text-muted-foreground">{t('dashboard.notifications')}</p>
          </button>
        </div>

        {/* Analytics card — klikabilna, otvara modal s detaljima */}
        {(isPro || isPremium) && profileViews !== null && (
          <button
            onClick={() => setAnalyticsOpen(true)}
            className="w-full bg-card border border-border rounded-2xl p-4 hover:border-orange-400/50 hover:bg-accent transition-colors text-left"
          >
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <p className="text-sm font-semibold text-foreground">{t('analytics.title')}</p>
              <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                {isPremium && recentViewers.length > 0 && (
                  <span className="text-orange-500 font-semibold">{recentViewers.length} {t('analytics.visitors')} ·</span>
                )}
                {t('analytics.profileViews')}
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{profileViews.today}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('analytics.today')}</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{profileViews.week}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('analytics.thisWeek')}</p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-950/30 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{profileViews.total}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('analytics.total')}</p>
              </div>
            </div>
          </button>
        )}

        {/* Premium widgets: credit balance + rating */}
        {isPremium && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-yellow-200 dark:border-yellow-900 rounded-2xl p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Coins className="h-4 w-4 text-yellow-500" />
                  <span className="text-xs font-semibold text-muted-foreground">{t('dashboard.credits')}</span>
                </div>
                {donations.length > 0 && (
                  <button onClick={() => setDonationsOpen(true)} className="text-[10px] text-orange-500 hover:text-orange-600 font-semibold">Pogledaj sve →</button>
                )}
              </div>
              <p className="text-3xl font-bold text-foreground">
                {creditBalance !== null ? creditBalance : '—'}
              </p>
              <p className="text-xs text-muted-foreground">{t('dashboard.creditBalance')}</p>
              {donations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Donacije</p>
                  {donations.slice(0, 3).map(d => (
                    <div key={d.id} className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {d.anonymous || !d.sender_avatar
                          ? <span className="text-xs">🎭</span>
                          : <img src={d.sender_avatar} alt="" className="h-6 w-6 object-cover" />
                        }
                      </div>
                      <p className="text-[10px] text-foreground truncate flex-1">
                        {d.anonymous ? 'Anonimni' : (d.sender_name || 'Korisnik')}
                      </p>
                      <span className="text-[10px] font-bold text-green-500">+{d.amount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-yellow-400" />
                  <span className="text-xs font-semibold text-muted-foreground">{t('dashboard.rating')}</span>
                </div>
                {reviews.length > 0 && (
                  <button onClick={() => setAllReviewsOpen(true)} className="text-[10px] text-orange-500 hover:text-orange-600 font-semibold">Pogledaj sve →</button>
                )}
              </div>
              {avgRating ? (
                <>
                  <p className="text-3xl font-bold text-foreground">{avgRating}</p>
                  <p className="text-xs text-muted-foreground">{reviews.length} {t('dashboard.reviews')}</p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-bold text-muted-foreground/30">—</p>
                  <p className="text-xs text-muted-foreground">{t('dashboard.noReviewsYet')}</p>
                </>
              )}
              {reviews.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  {reviews.slice(0, 2).map(review => (
                    <div key={review.id} className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-foreground truncate">{review.profiles.name}</span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`h-2.5 w-2.5 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`} />
                          ))}
                        </div>
                      </div>
                      {review.comment?.trim() && (
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rating widget for free users */}
        {!isPremium && (
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 text-yellow-400" />
                <span className="text-xs font-semibold text-muted-foreground">{t('dashboard.rating')}</span>
              </div>
              {reviews.length > 0 && (
                <button onClick={() => setAllReviewsOpen(true)} className="text-[10px] text-orange-500 hover:text-orange-600 font-semibold">Pogledaj sve →</button>
              )}
            </div>
            {avgRating ? (
              <>
                <p className="text-3xl font-bold text-foreground">{avgRating}</p>
                <p className="text-xs text-muted-foreground">{reviews.length} {t('dashboard.reviews')}</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-muted-foreground/30">—</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.noReviewsYet')}</p>
              </>
            )}
            {reviews.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                {reviews.slice(0, 2).map(review => (
                  <div key={review.id} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-foreground truncate">{review.profiles.name}</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`h-2.5 w-2.5 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`} />
                        ))}
                      </div>
                    </div>
                    {review.comment?.trim() && (
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Analytics modal */}
        {/* Donations dialog */}
        <Dialog open={donationsOpen} onOpenChange={setDonationsOpen}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-yellow-500" />
                Analitika donacija
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-1">
              {/* Totals */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-500">+{donations.reduce((s, d) => s + d.amount, 0)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ukupno primljeno</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{donations.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Broj donatora</p>
                </div>
              </div>

              {/* Bar chart — last 7 days */}
              {(() => {
                const days = Array.from({ length: 7 }, (_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - (6 - i));
                  return d.toISOString().slice(0, 10);
                });
                const byDay = Object.fromEntries(days.map(d => [d, 0]));
                donations.forEach(d => {
                  const day = d.created_at.slice(0, 10);
                  if (byDay[day] !== undefined) byDay[day] += d.amount;
                });
                const vals = days.map(d => byDay[d]);
                const max = Math.max(...vals, 1);
                return (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Posljednjih 7 dana</p>
                    <div className="flex items-end gap-1.5 h-20">
                      {days.map((day, i) => (
                        <div key={day} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full rounded-t-md bg-orange-400 dark:bg-orange-500 transition-all"
                            style={{ height: `${(vals[i] / max) * 64}px`, minHeight: vals[i] > 0 ? '4px' : '0' }}
                          />
                          <span className="text-[9px] text-muted-foreground">{new Date(day).toLocaleDateString('sr-RS', { day: 'numeric', month: 'numeric' })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Full donor list */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Lista donatora</p>
                {donations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Još nema donacija</p>
                ) : (
                  <div className="space-y-2">
                    {donations.map(d => (
                      <div key={d.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                        <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {d.anonymous || !d.sender_avatar
                            ? <span className="text-sm">🎭</span>
                            : <img src={d.sender_avatar} alt="" className="h-8 w-8 object-cover" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {d.anonymous ? 'Anonimni korisnik' : (d.sender_name || 'Korisnik')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(d.created_at).toLocaleDateString('sr-RS', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-green-500 shrink-0">+{d.amount} kr</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* All reviews dialog */}
        <Dialog open={allReviewsOpen} onOpenChange={setAllReviewsOpen}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-400" />
                {t('dashboard.recentReviews')} ({reviews.length})
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              {reviews.map(review => (
                <div key={review.id} className="bg-muted/50 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-foreground">{review.profiles.name}</span>
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`} />
                      ))}
                    </div>
                  </div>
                  {review.comment?.trim() && (
                    <p className="text-sm text-muted-foreground">{review.comment}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-500" />
                {t('analytics.title')}
              </DialogTitle>
            </DialogHeader>

            {/* Views breakdown */}
            {profileViews && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{profileViews.today}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('analytics.today')}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{profileViews.week}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('analytics.thisWeek')}</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-950/30 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{profileViews.total}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('analytics.total')}</p>
                </div>
              </div>
            )}

            {/* Who viewed — premium only */}
            {isPremium && recentViewers.length > 0 && (
              <div className="space-y-2 mt-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> {t('analytics.whoViewed')} ({recentViewers.length})
                </p>
                {recentViewers.map(viewer => (
                  <button
                    key={viewer.id}
                    onClick={() => { setAnalyticsOpen(false); router.push(`/profile/${viewer.id}`); }}
                    className="w-full flex items-center gap-3 hover:bg-accent rounded-xl px-2 py-1.5 transition-colors text-left"
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={viewer.avatar_url || undefined} />
                      <AvatarFallback className="bg-orange-100 text-orange-700 text-xs font-bold">
                        {viewer.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{viewer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(viewer.viewed_at), { addSuffix: true })}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {isPremium && recentViewers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t('analytics.noViewsYet')}</p>
            )}
          </DialogContent>
        </Dialog>

        {/* Quick actions */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            {t('dashboard.quickActions')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {isPro ? (
              <>
                <button
                  onClick={() => setShowTypePicker(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-white rounded-2xl px-4 py-3.5 flex items-center gap-3 transition-colors text-left"
                >
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t('dashboard.postAd')}</p>
                    <p className="text-xs text-white/80">{t('dashboard.postAdDesc')}</p>
                  </div>
                </button>
                <button
                  onClick={() => router.push('/feed')}
                  className="bg-card border border-border rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:border-orange-400/50 hover:bg-accent transition-colors text-left"
                >
                  <div className="p-2 bg-orange-100 dark:bg-orange-950 rounded-xl">
                    <Rss className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Feed</p>
                    <p className="text-xs text-muted-foreground">{t('dashboard.feedDesc')}</p>
                  </div>
                </button>
                <button
                  onClick={() => router.push(`/profile/${profile.id}`)}
                  className="bg-card border border-border rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:border-orange-400/50 hover:bg-accent transition-colors text-left"
                >
                  <div className="p-2 bg-purple-100 dark:bg-purple-950 rounded-xl">
                    <UserCircle className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t('dashboard.updateProfile')}</p>
                    <p className="text-xs text-muted-foreground">{t('dashboard.updateProfileShort')}</p>
                  </div>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowTypePicker(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-white rounded-2xl px-4 py-3.5 flex items-center gap-3 transition-colors text-left"
                >
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t('dashboard.postAd')}</p>
                    <p className="text-xs text-white/80">{t('dashboard.postAdDesc')}</p>
                  </div>
                </button>
                <button
                  onClick={() => router.push('/feed')}
                  className="bg-card border border-border rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:border-orange-400/50 hover:bg-accent transition-colors text-left"
                >
                  <div className="p-2 bg-orange-100 dark:bg-orange-950 rounded-xl">
                    <Rss className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Feed</p>
                    <p className="text-xs text-muted-foreground">{t('dashboard.feedBrowseDesc')}</p>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Post type picker modal */}
        <Dialog open={showTypePicker} onOpenChange={setShowTypePicker}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('jobs.createPost')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              {([
                { type: 'service_listing' as const, icon: <Wrench className="h-5 w-5 text-orange-400" />, title: t('jobs.postTypeServiceListing'), desc: t('jobs.postTypeServiceListingDesc') },
                { type: 'service_request' as const, icon: <Search className="h-5 w-5 text-orange-400" />, title: t('jobs.postTypeServiceRequest'), desc: t('jobs.postTypeServiceRequestDesc') },
                { type: 'job_seeker_post' as const, icon: <UserCircle className="h-5 w-5 text-orange-400" />, title: t('jobs.postTypeJobSeeker'), desc: t('jobs.postTypeJobSeekerDesc') },
                { type: 'hiring_post' as const, icon: <Briefcase className="h-5 w-5 text-orange-400" />, title: t('jobs.postTypeHiring'), desc: t('jobs.postTypeHiringDesc') },
              ] as const).map(({ type, icon, title, desc }) => (
                <button
                  key={type}
                  onClick={() => { setSelectedPostType(type); setShowTypePicker(false); setShowCreateModal(true); }}
                  className="w-full flex items-start gap-4 p-4 rounded-xl border border-border hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                    {icon}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <CreateMarketplacePostModal
          open={showCreateModal}
          onOpenChange={(open) => { setShowCreateModal(open); if (!open) setSelectedPostType(null); }}
          onPostCreated={() => { setShowCreateModal(false); }}
          initialPostType={selectedPostType || undefined}
          allowedTypes={['service_listing', 'hiring_post', 'job_seeker_post', 'service_request']}
        />

        {loading && (
          <div className="flex justify-center py-8">
            <div className="h-7 w-7 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          </div>
        )}

        {/* Recent jobs — isti za sve korisnike */}
        <div className="space-y-3">
          <div className="flex items-center px-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('dashboard.recentJobs')}
            </p>
          </div>
          {jobs.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl px-5 py-10 text-center">
              <Briefcase className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="font-semibold text-foreground mb-1">{t('dashboard.noJobsYet')}</p>
              <p className="text-sm text-muted-foreground">{t('dashboard.noJobsDesc')}</p>
            </div>
          ) : (
            jobs.map(job => (
              <div key={job.id} className="bg-card border border-border rounded-2xl px-4 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{job.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                      job.status === 'open'
                        ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {job.status === 'open'
                        ? <><Clock className="h-3 w-3" />{t('dashboard.statusOpen')}</>
                        : <><CheckCircle2 className="h-3 w-3" />{t('dashboard.statusClosed')}</>
                      }
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{job.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {job.category} · {job.city} · {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="p-1.5 rounded-xl text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('dashboard.deleteJobTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('dashboard.deleteJobConfirm')} "{job.title}".
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('dashboard.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteJob(job.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {t('dashboard.delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))
          )}
        </div>

      </div>

      <NotificationsModal
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        notifications={notifications}
        onNotificationClick={handleNotificationClick}
        onMarkAllRead={handleMarkAllRead}
        onClearAll={handleClearAll}
      />

      {pendingReviewPro && (
        <ReviewModal
          open={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          proId={pendingReviewPro.id}
          proName={pendingReviewPro.name}
          onSuccess={() => { setPendingReviewPro(null); setReviewModalOpen(false); }}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
      <OnboardingModal />
    </ProtectedRoute>
  );
}
