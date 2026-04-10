'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
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
  ChevronRight, AlertCircle
} from 'lucide-react';
import { NotificationsModal, Notification } from '@/components/notifications-modal';
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

  useEffect(() => {
    fetchDashboardData();
    fetchUnreadCount();
    fetchNotifications();
    if (profile?.account_type === 'customer') fetchPendingReview();

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
      if (profile.account_type === 'customer') {
        const { data, error } = await supabase
          .from('jobs').select('*').eq('customer_id', profile.id)
          .order('created_at', { ascending: false }).limit(5);
        if (error) throw error;
        setJobs(data || []);
      } else {
        const [{ data: threadsData, error: threadsError }, { data: reviewsData, error: reviewsError }] = await Promise.all([
          supabase.from('threads').select(`id, created_at, job:jobs(title), user1:profiles!threads_user1_id_fkey(name), user2:profiles!threads_user2_id_fkey(name)`)
            .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)
            .order('created_at', { ascending: false }).limit(5),
          supabase.from('reviews').select('*, profiles!reviews_customer_id_fkey(name)')
            .eq('pro_id', profile.id).order('created_at', { ascending: false }).limit(5),
        ]);
        if (threadsError) throw threadsError;
        if (reviewsError) throw reviewsError;
        setThreads((threadsData as any) || []);
        setReviews((reviewsData as Review[]) || []);
      }
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

  if (!profile) return null;

  const isPro = profile.account_type === 'professional';

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
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              isPro
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
            }`}>
              {isPro ? t('dashboard.badgeProfessional') : t('dashboard.badgeCustomer')}
            </span>
          </div>
          <button
            onClick={handleOpenNotifications}
            className="relative p-2.5 rounded-xl hover:bg-accent transition-colors"
          >
            <Bell className={`h-5 w-5 ${notificationsCount > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            {notificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {notificationsCount > 9 ? '9+' : notificationsCount}
              </span>
            )}
          </button>
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
          {isPro ? (
            <>
              <button
                onClick={() => router.push('/messages')}
                className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1 text-left hover:border-orange-400/50 hover:bg-accent transition-colors"
              >
                <MessageSquare className="h-5 w-5 text-green-500 mb-1" />
                <p className="text-2xl font-bold text-foreground">{threads.length}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.activeLeads')}</p>
              </button>
              <button
                onClick={() => router.push(`/profile/${profile.id}`)}
                className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1 text-left hover:border-orange-400/50 hover:bg-accent transition-colors"
              >
                <Star className="h-5 w-5 text-yellow-500 mb-1" />
                <p className="text-2xl font-bold text-foreground">{reviews.length}</p>
                <p className="text-xs text-muted-foreground">
                  {avgRating ? `⭐ ${avgRating}` : t('dashboard.reviews')}
                </p>
              </button>
              <button
                onClick={() => router.push('/messages')}
                className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1 text-left hover:border-orange-400/50 hover:bg-accent transition-colors"
              >
                <MessageSquare className="h-5 w-5 text-blue-500 mb-1" />
                <p className="text-2xl font-bold text-foreground">{unreadCount}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.messages')}</p>
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Quick actions */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Brze akcije
          </p>
          <div className="grid grid-cols-2 gap-3">
            {isPro ? (
              <>
                <button
                  onClick={() => router.push('/feed')}
                  className="bg-card border border-border rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:border-orange-400/50 hover:bg-accent transition-colors text-left"
                >
                  <div className="p-2 bg-orange-100 dark:bg-orange-950 rounded-xl">
                    <Rss className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Feed</p>
                    <p className="text-xs text-muted-foreground">Objavi sadržaj</p>
                  </div>
                </button>
                <button
                  onClick={() => router.push('/jobs')}
                  className="bg-card border border-border rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:border-orange-400/50 hover:bg-accent transition-colors text-left"
                >
                  <div className="p-2 bg-blue-100 dark:bg-blue-950 rounded-xl">
                    <Briefcase className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t('dashboard.browseJobs')}</p>
                    <p className="text-xs text-muted-foreground">Pronađi posao</p>
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
                    <p className="text-xs text-muted-foreground">Uredi profil</p>
                  </div>
                </button>
                <button
                  onClick={() => router.push('/messages')}
                  className="bg-card border border-border rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:border-orange-400/50 hover:bg-accent transition-colors text-left"
                >
                  <div className="p-2 bg-green-100 dark:bg-green-950 rounded-xl">
                    <MessageSquare className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t('dashboard.messages')}</p>
                    <p className="text-xs text-muted-foreground">
                      {unreadCount > 0 ? `${unreadCount} nepročitanih` : 'Svi razgovori'}
                    </p>
                  </div>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => router.push('/jobs/new')}
                  className="bg-orange-500 hover:bg-orange-600 text-white rounded-2xl px-4 py-3.5 flex items-center gap-3 transition-colors text-left col-span-2"
                >
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t('dashboard.postJob')}</p>
                    <p className="text-xs text-white/80">Objavi oglas za posao</p>
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
                    <p className="text-xs text-muted-foreground">Pregledaj objave</p>
                  </div>
                </button>
                <button
                  onClick={() => router.push('/messages')}
                  className="bg-card border border-border rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:border-orange-400/50 hover:bg-accent transition-colors text-left"
                >
                  <div className="p-2 bg-green-100 dark:bg-green-950 rounded-xl">
                    <MessageSquare className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t('dashboard.messages')}</p>
                    <p className="text-xs text-muted-foreground">
                      {unreadCount > 0 ? `${unreadCount} nepročitanih` : 'Svi razgovori'}
                    </p>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Recent content */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-7 w-7 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          </div>
        ) : isPro ? (
          <>
            {/* Recent reviews */}
            {reviews.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('dashboard.recentReviews')}
                  </p>
                  {avgRating && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {avgRating} ({reviews.length})
                    </span>
                  )}
                </div>
                {reviews.map(review => (
                  <div key={review.id} className="bg-card border border-border rounded-2xl px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-foreground">{review.profiles.name}</span>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`} />
                        ))}
                      </div>
                    </div>
                    {review.comment?.trim() && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{review.comment}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Recent conversations */}
            {threads.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  {t('dashboard.recentConversations')}
                </p>
                {threads.map(thread => (
                  <button
                    key={thread.id}
                    onClick={() => router.push(`/messages`)}
                    className="w-full bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-3 hover:border-orange-400/50 hover:bg-accent transition-colors text-left"
                  >
                    <div className="p-2 bg-muted rounded-xl">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {thread.job?.title || 'Razgovor'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Customer: recent jobs */
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('dashboard.recentJobs')}
              </p>
              <button
                onClick={() => router.push('/jobs/new')}
                className="text-xs text-orange-600 hover:text-orange-500 font-medium flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Novi oglas
              </button>
            </div>

            {jobs.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl px-5 py-10 text-center">
                <Briefcase className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="font-semibold text-foreground mb-1">{t('dashboard.noJobsYet')}</p>
                <p className="text-sm text-muted-foreground mb-4">{t('dashboard.noJobsDesc')}</p>
                <button
                  onClick={() => router.push('/jobs/new')}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  <Plus className="h-4 w-4 inline mr-1.5" />
                  {t('dashboard.postJob')}
                </button>
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
        )}

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
