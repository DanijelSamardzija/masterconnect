'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeWorkerLayout } from '@/components/trade/TradeWorkerLayout';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Zap, Loader2, Phone, MapPin, Clock, Truck, Home, ChevronRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type EmergencyStatus = 'pending' | 'accepted' | 'in_transit' | 'arrived' | 'completed' | 'cancelled';

type MyEmergency = {
  id: string;
  title: string;
  description: string | null;
  contact_name: string | null;
  contact_phone: string;
  address: string | null;
  status: EmergencyStatus;
  eta_minutes: number | null;
  job_id: string | null;
  created_at: string;
};

const STATUS_COLORS: Record<EmergencyStatus, string> = {
  pending:    'bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-400',
  accepted:   'bg-blue-100   text-blue-800   dark:bg-blue-900/30   dark:text-blue-400',
  in_transit: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  arrived:    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  completed:  'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400',
  cancelled:  'bg-muted      text-muted-foreground',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkerEmergencyPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = use(params);
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { setActiveProfileId } = useBookingProfile();

  const [emergencies, setEmergencies] = useState<MyEmergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !profileId) return;
    setActiveProfileId(profileId);
  }, [user, profileId, setActiveProfileId]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !profileId) return;

    const channel = (supabase as any)
      .channel(`worker_emergency_${profileId}_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trade_emergency_requests',
          filter: `business_id=eq.${profileId}`,
        },
        () => {
          load();
        },
      )
      .subscribe();

    return () => {
      (supabase as any).removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Fetch all business emergencies then filter client-side to assigned ones
    // (list_emergency_requests returns all; filtering by assigned_to on client
    //  is safe here — server enforces business-level RLS already)
    const { data } = await (supabase as any).rpc('list_emergency_requests', {
      p_business_id: profileId,
      p_status:      null,
      p_limit:       100,
      p_offset:      0,
    });
    if (data?.ok) {
      const mine = (data.requests ?? []).filter(
        (r: MyEmergency & { assigned_to?: string }) =>
          r.assigned_to === user.id &&
          r.status !== 'completed' &&
          r.status !== 'cancelled',
      );
      setEmergencies(mine);
    }
    setLoading(false);
  }, [profileId, user]);

  useEffect(() => {
    if (user && profileId) load();
  }, [user, profileId, load]);

  // ── Status actions ─────────────────────────────────────────────────────────

  async function handleStatusChange(requestId: string, newStatus: 'in_transit' | 'arrived') {
    setActingId(requestId);
    const { data } = await (supabase as any).rpc('worker_update_emergency_status', {
      p_request_id: requestId,
      p_status:     newStatus,
    });
    if (data?.ok) {
      toast.success(t('trade.worker.emergencyUpdated'));
      load();
    } else {
      toast.error(data?.error ?? 'error');
    }
    setActingId(null);
  }

  function timeAgo(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60)   return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <TradeWorkerLayout profileId={profileId} active="emergency">
      <h1 className="text-lg font-bold text-foreground mb-4">
        {t('trade.worker.myEmergencies')}
      </h1>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && emergencies.length === 0 && (
        <div className="text-center py-12 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Zap className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{t('trade.worker.noEmergencies')}</p>
        </div>
      )}

      {!loading && emergencies.length > 0 && (
        <div className="flex flex-col gap-3">
          {emergencies.map((req) => {
            const isActing = actingId === req.id;
            return (
              <div
                key={req.id}
                className="border border-border rounded-xl bg-card overflow-hidden"
              >
                {/* Header */}
                <div className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground leading-snug">
                      {req.title}
                    </p>
                    <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS[req.status]}`}>
                      {t(`trade.emergency.status_${req.status}` as Parameters<typeof t>[0])}
                    </span>
                  </div>
                  {req.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {req.description}
                    </p>
                  )}
                </div>

                {/* Meta */}
                <div className="px-4 pb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <a
                    href={`tel:${req.contact_phone}`}
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Phone className="w-3 h-3" />
                    {req.contact_name
                      ? `${req.contact_name} · ${req.contact_phone}`
                      : req.contact_phone}
                  </a>
                  {req.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {req.address}
                    </span>
                  )}
                  {req.eta_minutes != null && (
                    <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-medium">
                      <Clock className="w-3 h-3" />
                      {t('trade.emergency.etaMinutes').replace('{n}', String(req.eta_minutes))}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeAgo(req.created_at)}
                  </span>
                </div>

                {/* Actions */}
                <div className="px-4 pb-4 flex gap-2 flex-wrap">
                  {req.status === 'accepted' && (
                    <button
                      onClick={() => handleStatusChange(req.id, 'in_transit')}
                      disabled={isActing}
                      className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                      {t('trade.worker.inTransit')}
                    </button>
                  )}
                  {req.status === 'in_transit' && (
                    <button
                      onClick={() => handleStatusChange(req.id, 'arrived')}
                      disabled={isActing}
                      className="flex-1 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Home className="w-3.5 h-3.5" />}
                      {t('trade.worker.markArrived')}
                    </button>
                  )}
                  {req.job_id && (
                    <button
                      onClick={() =>
                        router.push(
                          `/booking/trade/${profileId}/worker/jobs/${req.job_id}`,
                        )
                      }
                      className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center gap-1"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                      {t('trade.emergency.viewJob')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </TradeWorkerLayout>
  );
}
