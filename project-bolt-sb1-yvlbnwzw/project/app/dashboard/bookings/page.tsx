'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { Calendar, Clock, X, ChevronRight, Star } from 'lucide-react';
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

function formatDt(isoStr: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(isoStr));
}

export default function MyBookingsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [past, setPast] = useState<Booking[]>([]);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
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
          .select('id, service_name_snapshot, starts_at, ends_at, status, party_size, notes, business_id, business:business_id(name), location:location_id(name)')
          .eq('client_id', user!.id)
          .not('status', 'in', '(cancelled,completed,no_show)')
          .gte('starts_at', now)
          .order('starts_at'),
        supabase
          .from('bookings')
          .select('id, service_name_snapshot, starts_at, ends_at, status, party_size, notes, business_id, business:business_id(name), location:location_id(name)')
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
    setCancelTarget(null);
    setCancelReason('');
    setUpcoming((prev) => prev.filter((b) => b.id !== cancelTarget));
  }

  const canCancel = (b: Booking) =>
    ['pending', 'confirmed'].includes(b.status) && new Date(b.starts_at) > new Date();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.push('/dashboard')} className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <h1 className="text-xl font-semibold">{t('booking.myBookings')}</h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-border">
            {(['upcoming', 'past'] as const).map((tab_) => (
              <button
                key={tab_}
                onClick={() => setTab(tab_)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === tab_
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(tab_ === 'upcoming' ? 'booking.upcomingBookings' : 'booking.pastBookings')}
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
                        onCancel={canCancel(b) ? () => { setCancelTarget(b.id); setCancelReason(''); } : undefined}
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
                    {past.map((b) => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        t={t}
                        onReview={b.status === 'completed' && b.business_id ? () => setReviewTarget({
                          bookingId: b.id,
                          proId: b.business_id!,
                          proName: (b.business as any)?.name ?? '',
                        }) : undefined}
                      />
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
  onCancel,
  onReview,
}: {
  booking: Booking;
  t: (k: string) => string;
  onCancel?: () => void;
  onReview?: () => void;
}) {
  return (
    <div className="border border-border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {b.service_name_snapshot ?? t('booking.service')}
          </p>
          {b.business && (
            <p className="text-xs text-muted-foreground">{(b.business as any).name}</p>
          )}
        </div>
        <StatusBadge status={b.status} t={t} />
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Calendar className="w-3 h-3" />
        {formatDt(b.starts_at)}
      </div>
      {b.location && (
        <p className="text-xs text-muted-foreground">{(b.location as any).name}</p>
      )}
      {(onCancel || onReview) && (
        <div className="flex gap-2 mt-1">
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
