'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { langToLocale } from '@/lib/utils/locale';
import { useBookingAccess } from '@/lib/hooks/use-booking-access';
import { BookingBetaBanner } from '@/components/booking-beta-banner';
import { toast } from 'sonner';
import { Calendar, Clock, X, ChevronRight, ChevronLeft, Star, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ReviewModal } from '@/components/review-modal';

type Booking = {
  id: string;
  service_name_snapshot: string | null;
  service_id: string | null;
  staff_member_id: string | null;
  location_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  party_size: number;
  notes: string | null;
  business_id: string | null;
  business: { name: string; id?: string } | null;
  location: { name: string } | null;
};

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    no_show: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? map.pending}`}>
      {t(`booking.status.${status}`) ?? status}
    </span>
  );
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDt(isoStr: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(isoStr));
}

function formatTime(isoStr: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(isoStr));
}

export default function MyBookingsPage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const locale = langToLocale(language);
  const router = useRouter();
  const { hasAccess, loading: authLoading } = useBookingAccess();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [past, setPast] = useState<Booking[]>([]);
  const [followed, setFollowed] = useState<{ id: string; name: string; avatar_url: string | null; city: string | null }[]>([]);
  const [followedLoading, setFollowedLoading] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'past' | 'following'>('upcoming');
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ bookingId: string; proId: string; proName: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      const now = new Date().toISOString();
      const [upRes, pastRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, service_name_snapshot, service_id, staff_member_id, location_id, starts_at, ends_at, status, party_size, notes, business_id, business:business_id(name), location:location_id(name)')
          .eq('client_id', user!.id)
          .not('status', 'in', '(cancelled,completed,no_show)')
          .gte('starts_at', now)
          .order('starts_at'),
        supabase
          .from('bookings')
          .select('id, service_name_snapshot, service_id, staff_member_id, location_id, starts_at, ends_at, status, party_size, notes, business_id, business:business_id(name), location:location_id(name)')
          .eq('client_id', user!.id)
          .or(`status.in.(cancelled,completed,no_show),starts_at.lt.${now}`)
          .order('starts_at', { ascending: false })
          .limit(30),
      ]);
      setUpcoming((upRes.data as unknown as Booking[]) ?? []);
      setPast((pastRes.data as unknown as Booking[]) ?? []);
      setLoading(false);
    }
    load();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setFollowedLoading(true);
    (supabase as any).rpc('get_followed_businesses').then(({ data }: { data: any[] | null }) => {
      setFollowed((data as any) ?? []);
      setFollowedLoading(false);
    });
  }, [user]);

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    const { data } = await (supabase as any).rpc('cancel_booking', {
      p_booking_id: cancelTarget,
      p_reason: cancelReason.trim() || null,
    });
    setCancelling(false);
    const result = data as { ok: boolean } | null;
    if (!result?.ok) {
      toast.error(t('booking.error.generic'));
      return;
    }
    toast.success(t('booking.cancelSuccess'));
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch('/api/booking/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ type: 'cancellation', booking_id: cancelTarget }),
      }).catch(() => {});
    });
    setCancelTarget(null);
    setCancelReason('');
    setUpcoming((prev) => prev.filter((b) => b.id !== cancelTarget));
  }


  const canCancel = (b: Booking) =>
    ['pending', 'confirmed'].includes(b.status) && new Date(b.starts_at) > new Date();

  const canReschedule = (b: Booking) =>
    ['pending', 'confirmed'].includes(b.status) && new Date(b.starts_at) > new Date();

  const openReschedule = (b: Booking) => {
    const params = new URLSearchParams({
      bookingId:  b.id,
      businessId: b.business_id ?? '',
      serviceId:  b.service_id ?? '',
      staffId:    b.staff_member_id ?? '',
      locationId: b.location_id ?? '',
    });
    router.push(`/booking/my/reschedule?${params.toString()}`);
  };


  if (!authLoading && !hasAccess) {
    return (
      <ProtectedRoute>
        <BookingBetaBanner />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.push('/booking')} className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <h1 className="text-xl font-semibold">{t('booking.myBookings')}</h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-border">
            {(['upcoming', 'past', 'following'] as const).map((tab_) => (
              <button
                key={tab_}
                onClick={() => setTab(tab_)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === tab_
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab_ === 'upcoming'
                  ? t('booking.upcomingBookings')
                  : tab_ === 'past'
                  ? t('booking.pastBookings')
                  : t('booking.following.title')}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {tab === 'upcoming' && (
                upcoming.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    {t('booking.noUpcoming')}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {upcoming.map((b) => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        t={t}
                        locale={locale}
                        onCancel={canCancel(b) ? () => { setCancelTarget(b.id); setCancelReason(''); } : undefined}
                        onReschedule={canReschedule(b) ? () => openReschedule(b) : undefined}
                      />
                    ))}
                  </div>
                )
              )}
              {tab === 'past' && (
                past.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    {t('booking.noPast')}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {past.map((b) => {
                      const isPastTime = new Date(b.starts_at) < new Date();
                      const canReview = b.business_id && (b.status === 'completed' || (b.status === 'confirmed' && isPastTime));
                      return (
                        <BookingCard
                          key={b.id}
                          booking={b}
                          t={t}
                          locale={locale}
                          onReview={canReview ? () => setReviewTarget({
                            bookingId: b.id,
                            proId: b.business_id!,
                            proName: (b.business as any)?.name ?? '',
                          }) : undefined}
                        />
                      );
                    })}
                  </div>
                )
              )}
              {tab === 'following' && (
                followedLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : followed.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    {t('booking.following.empty')}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {followed.map((biz) => (
                      <button
                        key={biz.id}
                        onClick={() => router.push(`/booking/${biz.id}`)}
                        className="w-full text-left border border-border rounded-xl p-3 bg-card hover:border-primary/50 hover:bg-accent/30 transition-colors flex items-center gap-3"
                      >
                        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center shrink-0 text-sm font-bold text-orange-700 dark:text-orange-300">
                          {(biz.name ?? '?')[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{biz.name}</p>
                          {biz.city && <p className="text-sm text-muted-foreground">{biz.city}</p>}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>

        {/* Review modal for completed bookings */}
        {reviewTarget && (
          <ReviewModal
            open={!!reviewTarget}
            onClose={() => setReviewTarget(null)}
            proId={reviewTarget.proId}
            proName={reviewTarget.proName}
            bookingId={reviewTarget.bookingId}
            onSuccess={() => setReviewTarget(null)}
          />
        )}

        {/* Cancel dialog */}
        <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('booking.cancelBooking')}</AlertDialogTitle>
              <AlertDialogDescription>{t('booking.cancelConfirm')}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="px-0 pb-2">
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t('booking.cancelReason')}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelling}>{t('block.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancel}
                disabled={cancelling}
                className="bg-destructive hover:bg-destructive/90"
              >
                {cancelling ? t('booking.cancelling') : t('booking.cancelBooking')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ProtectedRoute>
  );
}

function BookingCard({
  booking: b,
  t,
  locale,
  onCancel,
  onReview,
  onReschedule,
}: {
  booking: Booking;
  t: (k: string) => string;
  locale: string;
  onCancel?: () => void;
  onReview?: () => void;
  onReschedule?: () => void;
}) {
  return (
    <div className="border border-border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {b.service_name_snapshot ?? t('booking.service')}
          </p>
          {b.business && (
            <p className="text-sm text-muted-foreground">{(b.business as any).name}</p>
          )}
        </div>
        <StatusBadge status={b.status} t={t} />
      </div>
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Calendar className="w-3 h-3" />
        {formatDt(b.starts_at, locale)}{b.ends_at ? ` – ${formatTime(b.ends_at)}` : ''}
      </div>
      {b.location && (
        <p className="text-sm text-muted-foreground">{(b.location as any).name}</p>
      )}
      {(onCancel || onReview || onReschedule) && (
        <div className="flex flex-wrap gap-2 mt-1">
          {onReschedule && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              onClick={onReschedule}
            >
              <CalendarClock className="w-3.5 h-3.5 mr-1" />
              {t('booking.reschedule')}
            </Button>
          )}
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10 px-2 -ml-2"
              onClick={onCancel}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              {t('booking.cancelBooking')}
            </Button>
          )}
          {onReview && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/20 px-2"
              onClick={onReview}
            >
              <Star className="w-3.5 h-3.5 mr-1" />
              {t('booking.leaveReview')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
