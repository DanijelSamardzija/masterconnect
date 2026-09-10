'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { Calendar, Check, X, ChevronRight, Users } from 'lucide-react';
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

type BookingRow = {
  id: string;
  service_name_snapshot: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  party_size: number;
  notes: string | null;
  client: { name: string; avatar_url: string | null } | null;
  location: { name: string } | null;
  business_id: string;
};

type FilterValue = 'all' | 'pending' | 'confirmed' | 'cancelled';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  no_show: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function formatDt(isoStr: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(isoStr));
}

export default function BusinessBookingsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterValue>('all');

  // Action state
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      // Find businesses where user is active staff
      const { data: staffRows } = await supabase
        .from('staff_members')
        .select('business_id')
        .eq('user_id', user!.id)
        .eq('is_active', true);

      const businessIds = (staffRows ?? []).map((r) => r.business_id);
      if (businessIds.length === 0) {
        setBookings([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('bookings')
        .select(`
          id, service_name_snapshot, starts_at, ends_at,
          status, party_size, notes, business_id,
          client:client_id(name, avatar_url),
          location:location_id(name)
        `)
        .in('business_id', businessIds)
        .order('starts_at', { ascending: false })
        .limit(100);

      setBookings((data as unknown as BookingRow[]) ?? []);
      setLoading(false);
    }
    load();
  }, [user]);

  async function handleConfirm() {
    if (!confirmTarget) return;
    setActionLoading(true);
    const { data } = await (supabase as any).rpc('confirm_booking', {
      p_booking_id: confirmTarget,
    });
    setActionLoading(false);
    const result = data as { ok: boolean; error?: string } | null;
    if (!result?.ok) {
      toast.error(result?.error === 'not_pending' ? t('booking.error.notPending') : t('booking.error.generic'));
      setConfirmTarget(null);
      return;
    }
    toast.success(t('booking.confirmSuccess'));
    setBookings((prev) =>
      prev.map((b) => b.id === confirmTarget ? { ...b, status: 'confirmed' } : b)
    );
    setConfirmTarget(null);
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    setActionLoading(true);
    const { data } = await (supabase as any).rpc('cancel_booking', {
      p_booking_id: cancelTarget,
      p_reason: cancelReason.trim() || null,
    });
    setActionLoading(false);
    const result = data as { ok: boolean } | null;
    if (!result?.ok) {
      toast.error(t('booking.error.generic'));
      setCancelTarget(null);
      return;
    }
    toast.success(t('booking.cancelSuccess'));
    setBookings((prev) =>
      prev.map((b) => b.id === cancelTarget ? { ...b, status: 'cancelled' } : b)
    );
    setCancelTarget(null);
    setCancelReason('');
  }

  const FILTERS: FilterValue[] = ['all', 'pending', 'confirmed', 'cancelled'];
  const filtered = bookings.filter((b) => {
    if (filter === 'all') return true;
    return b.status === filter;
  });

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.push('/dashboard')} className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <h1 className="text-xl font-semibold">{t('booking.businessBookings')}</h1>
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-2 mb-6">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-accent text-accent-foreground hover:bg-accent/80'
                }`}
              >
                {t(`booking.filter.${f}`)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
              {t('booking.noBookings')}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((b) => (
                <div key={b.id} className="border border-border rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {b.service_name_snapshot ?? t('booking.service')}
                      </p>
                      {b.client && (
                        <p className="text-xs text-muted-foreground">
                          {t('booking.client')}: {(b.client as any).name}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status] ?? STATUS_COLORS.pending}`}>
                      {t(`booking.status.${b.status}`) ?? b.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDt(b.starts_at)}
                    </span>
                    {b.party_size > 1 && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {b.party_size}
                      </span>
                    )}
                  </div>

                  {b.location && (
                    <p className="text-xs text-muted-foreground">{(b.location as any).name}</p>
                  )}

                  {b.notes && (
                    <p className="text-xs text-muted-foreground italic">&ldquo;{b.notes}&rdquo;</p>
                  )}

                  {(b.status === 'pending' || b.status === 'confirmed') && new Date(b.starts_at) > new Date() && (
                    <div className="flex gap-2 pt-1">
                      {b.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
                          onClick={() => setConfirmTarget(b.id)}
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          {t('booking.confirmBooking')}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                        onClick={() => { setCancelTarget(b.id); setCancelReason(''); }}
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        {t('booking.cancelBooking')}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confirm dialog */}
        <AlertDialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('booking.confirmBooking')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('booking.status.pending')} → {t('booking.status.confirmed')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading}>{t('block.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm} disabled={actionLoading}>
                {actionLoading ? t('booking.confirming') : t('booking.confirmBooking')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
              <AlertDialogCancel disabled={actionLoading}>{t('block.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancel}
                disabled={actionLoading}
                className="bg-destructive hover:bg-destructive/90"
              >
                {actionLoading ? t('booking.cancelling') : t('booking.cancelBooking')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ProtectedRoute>
  );
}
