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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

type Slot = { slot_start: string; slot_end: string; available: boolean };

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

function weekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - (day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
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
    hour: '2-digit', minute: '2-digit',
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
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ bookingId: string; proId: string; proName: string } | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Booking | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleWeek, setRescheduleWeek] = useState<Date>(weekMonday(new Date()));
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

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
    fetch('/api/booking/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cancellation', booking_id: cancelTarget }),
    }).catch(() => {});
    setCancelTarget(null);
    setCancelReason('');
    setUpcoming((prev) => prev.filter((b) => b.id !== cancelTarget));
  }

  async function handleReschedule() {
    if (!rescheduleTarget || !selectedSlot) return;
    setRescheduling(true);
    const { data } = await (supabase as any).rpc('client_reschedule_booking', {
      p_booking_id:    rescheduleTarget.id,
      p_new_starts_at: selectedSlot,
      p_reason:        rescheduleReason.trim() || null,
    });
    setRescheduling(false);
    const result = data as { ok: boolean; error?: string } | null;
    if (!result?.ok) {
      const key = result?.error === 'conflict'
        ? 'booking.rescheduleError.conflict'
        : 'booking.rescheduleError.tooSoon';
      toast.error(t(key as Parameters<typeof t>[0]));
      return;
    }
    toast.success(t('booking.rescheduled'));
    fetch('/api/booking/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'reschedule', booking_id: rescheduleTarget.id }),
    }).catch(() => {});
    setRescheduleTarget(null);
    setRescheduleReason('');
    setSelectedSlot(null);
    setSlots([]);
    setUpcoming(prev => prev.map(b =>
      b.id === rescheduleTarget.id
        ? { ...b, starts_at: selectedSlot }
        : b
    ));
  }

  const canCancel = (b: Booking) =>
    ['pending', 'confirmed'].includes(b.status) && new Date(b.starts_at) > new Date();

  const canReschedule = (b: Booking) =>
    ['pending', 'confirmed'].includes(b.status) && new Date(b.starts_at) > new Date();

  const openReschedule = (b: Booking) => {
    const d = new Date(b.starts_at);
    setRescheduleDate(toDateKey(d));
    setRescheduleWeek(weekMonday(d));
    setSelectedSlot(null);
    setSlots([]);
    setRescheduleTarget(b);
  };

  useEffect(() => {
    if (!rescheduleTarget || !rescheduleDate) { setSlots([]); return; }
    const { business_id, location_id, service_id, staff_member_id } = rescheduleTarget;
    if (!business_id || !location_id || !service_id) { setSlots([]); return; }
    setSlotsLoading(true);
    setSelectedSlot(null);
    const weekStart = weekMonday(new Date(rescheduleDate + 'T00:00:00'));
    ;(supabase as any).rpc('get_available_slots', {
      p_business_id:      business_id,
      p_location_id:      location_id,
      p_service_id:       service_id,
      p_week_start:       weekStart.toISOString(),
      p_staff_member_id:  staff_member_id ?? null,
    }).then(({ data }: { data: Slot[] | null }) => {
      setSlotsLoading(false);
      const all = (data ?? []) as Slot[];
      setSlots(all.filter(s => toDateKey(new Date(s.slot_start)) === rescheduleDate && s.available));
    });
  }, [rescheduleDate, rescheduleTarget]);

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
                    {past.map((b) => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        t={t}
                        locale={locale}
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

        {/* Reschedule dialog */}
        <Dialog open={!!rescheduleTarget} onOpenChange={o => { if (!o) setRescheduleTarget(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                {t('booking.rescheduleModal.title')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{t('booking.rescheduleModal.dateLabel')}</label>
                <div className="flex items-center justify-between mb-1">
                  <button onClick={() => setRescheduleWeek(w => addDays(w, -7))}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                    <ChevronRight className="h-4 w-4 rotate-180" />
                  </button>
                  <span className="text-xs font-semibold text-foreground">
                    {rescheduleWeek.toLocaleDateString(locale, { day: 'numeric', month: 'long' })}
                    {' – '}
                    {addDays(rescheduleWeek, 6).toLocaleDateString(locale, { day: 'numeric', month: 'long' })}
                  </span>
                  <button onClick={() => setRescheduleWeek(w => addDays(w, 7))}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 7 }, (_, i) => addDays(rescheduleWeek, i)).map(day => {
                    const key = toDateKey(day);
                    const isSelected = rescheduleDate === key;
                    const isToday = toDateKey(new Date()) === key;
                    const isPast = day < new Date(new Date().toDateString());
                    return (
                      <button key={key} onClick={() => !isPast && setRescheduleDate(key)}
                        disabled={isPast}
                        className={`flex flex-col items-center py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
                          isSelected
                            ? 'bg-primary text-white'
                            : isPast
                            ? 'bg-muted/40 text-muted-foreground/60 cursor-default'
                            : 'bg-muted text-foreground hover:bg-primary/10'
                        }`}
                      >
                        <span>{day.toLocaleDateString(locale, { weekday: 'short' }).replace(/\.$/, '')}</span>
                        <span className={`text-xs font-bold ${isToday && !isSelected ? 'text-primary' : ''}`}>{day.getDate()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{t('booking.rescheduleModal.timeLabel')}</label>
                {slotsLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">{rescheduleDate ? t('booking.rescheduleModal.noSlots') : ''}</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                    {slots.map(s => {
                      const timeStr = new Date(s.slot_start).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
                      const isSelected = selectedSlot === s.slot_start;
                      return (
                        <button
                          key={s.slot_start}
                          onClick={() => setSelectedSlot(s.slot_start)}
                          className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                            isSelected
                              ? 'bg-primary text-white'
                              : 'bg-muted text-foreground hover:bg-primary/10'
                          }`}
                        >
                          {timeStr}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {t('booking.rescheduleModal.reasonLabel')}
                </label>
                <textarea
                  value={rescheduleReason}
                  onChange={e => setRescheduleReason(e.target.value)}
                  placeholder={t('booking.rescheduleModal.reasonPlaceholder')}
                  rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setRescheduleTarget(null); setRescheduleReason(''); }}
                  className="flex-1 border border-border rounded-lg py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
                >
                  {t('block.cancel')}
                </button>
                <button onClick={handleReschedule} disabled={rescheduling || !rescheduleDate || !selectedSlot}
                  className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors"
                >
                  {rescheduling ? '...' : t('booking.rescheduleModal.confirm')}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
            <p className="text-xs text-muted-foreground">{(b.business as any).name}</p>
          )}
        </div>
        <StatusBadge status={b.status} t={t} />
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Calendar className="w-3 h-3" />
        {formatDt(b.starts_at, locale)}
      </div>
      {b.location && (
        <p className="text-xs text-muted-foreground">{(b.location as any).name}</p>
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
