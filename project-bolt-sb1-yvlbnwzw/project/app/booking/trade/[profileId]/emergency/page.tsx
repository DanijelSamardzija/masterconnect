'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeDashboardLayout } from '@/components/trade/TradeDashboardLayout';
import { WhatsAppIcon, ViberIcon } from '@/components/brand-icons';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Zap,
  Plus,
  Loader2,
  Phone,
  MapPin,
  Clock,
  User,
  X,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Truck,
  Home,
  XCircle,
  Circle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type EmergencyStatus =
  | 'pending'
  | 'accepted'
  | 'in_transit'
  | 'arrived'
  | 'completed'
  | 'cancelled';

type EmergencyRequest = {
  id: string;
  business_id: string;
  client_id: string | null;
  contact_name: string | null;
  contact_phone: string;
  whatsapp: string | null;
  viber: string | null;
  title: string;
  description: string | null;
  address: string | null;
  status: EmergencyStatus;
  eta_minutes: number | null;
  accepted_at: string | null;
  dispatched_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  job_id: string | null;
  created_at: string;
};

type EligibleStaff = {
  user_id: string;
  name: string;
  role: string;
};

type AcceptForm = { assigned_to: string; eta_minutes: string };
type CreateForm = {
  title: string;
  description: string;
  contact_name: string;
  contact_phone: string;
  whatsapp: string;
  viber: string;
  address: string;
};

const EMPTY_CREATE: CreateForm = {
  title: '', description: '', contact_name: '',
  contact_phone: '', whatsapp: '', viber: '', address: '',
};

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_TABS: { key: EmergencyStatus | 'all'; label_key: string }[] = [
  { key: 'all',        label_key: 'trade.emergency.filterAll' },
  { key: 'pending',    label_key: 'trade.emergency.status_pending' },
  { key: 'accepted',   label_key: 'trade.emergency.status_accepted' },
  { key: 'in_transit', label_key: 'trade.emergency.status_in_transit' },
  { key: 'arrived',    label_key: 'trade.emergency.status_arrived' },
  { key: 'completed',  label_key: 'trade.emergency.status_completed' },
  { key: 'cancelled',  label_key: 'trade.emergency.status_cancelled' },
];

const STATUS_COLORS: Record<EmergencyStatus, string> = {
  pending:    'bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-400',
  accepted:   'bg-blue-100   text-blue-800   dark:bg-blue-900/30   dark:text-blue-400',
  in_transit: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  arrived:    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  completed:  'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400',
  cancelled:  'bg-muted      text-muted-foreground',
};

const NEXT_STATUSES: Record<EmergencyStatus, EmergencyStatus[]> = {
  pending:    ['accepted', 'cancelled'],
  accepted:   ['in_transit', 'cancelled'],
  in_transit: ['arrived', 'cancelled'],
  arrived:    ['completed', 'cancelled'],
  completed:  [],
  cancelled:  [],
};

// ─── Small components ─────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: EmergencyStatus }) {
  switch (status) {
    case 'pending':    return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case 'accepted':   return <Circle        className="w-4 h-4 text-blue-500" />;
    case 'in_transit': return <Truck         className="w-4 h-4 text-orange-500" />;
    case 'arrived':    return <Home          className="w-4 h-4 text-purple-500" />;
    case 'completed':  return <CheckCircle2  className="w-4 h-4 text-green-500" />;
    case 'cancelled':  return <XCircle       className="w-4 h-4 text-muted-foreground" />;
  }
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-red-500' : 'bg-muted'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

const WA_SVG = <WhatsAppIcon className="w-3.5 h-3.5" />;
const VIBER_SVG = <ViberIcon className="w-3.5 h-3.5" />;

// ─── Request Card ─────────────────────────────────────────────────────────────

function RequestCard({
  req,
  actingId,
  onAccept,
  onStatusChange,
  onViewJob,
  timeAgo,
  t,
}: {
  req: EmergencyRequest;
  actingId: string | null;
  onAccept: () => void;
  onStatusChange: (s: EmergencyStatus) => void;
  onViewJob: () => void;
  timeAgo: (iso: string) => string;
  t: (k: string) => string;
}) {
  const isActing = actingId === req.id;
  const nextStatuses = NEXT_STATUSES[req.status];

  return (
    <div
      className={`border rounded-xl bg-card overflow-hidden ${
        req.status === 'pending'
          ? 'border-red-300 dark:border-red-800'
          : 'border-border'
      }`}
    >
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <StatusIcon status={req.status} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground leading-snug">{req.title}</p>
            <span
              className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS[req.status]}`}
            >
              {t(`trade.emergency.status_${req.status}` as Parameters<typeof t>[0])}
            </span>
          </div>
          {req.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{req.description}</p>
          )}
        </div>
      </div>

      {/* Contact + meta */}
      <div className="px-4 pb-3 flex flex-col gap-1.5">
        {/* Phone + messaging */}
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`tel:${req.contact_phone}`}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Phone className="w-3 h-3" />
            {req.contact_name
              ? `${req.contact_name} · ${req.contact_phone}`
              : req.contact_phone}
          </a>
          {req.whatsapp && (
            <a
              href={`https://wa.me/${req.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#25D366]/15 hover:bg-[#25D366]/30 text-[#25D366] transition-colors"
            >
              {WA_SVG}
            </a>
          )}
          {req.viber && (
            <a
              href={`viber://chat?number=${req.viber.replace(/\D/g, '')}`}
              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#7B519D]/15 hover:bg-[#7B519D]/30 text-[#7B519D] transition-colors"
            >
              {VIBER_SVG}
            </a>
          )}
        </div>

        {/* Address / ETA / assigned / age */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {req.address && (
            <span className="flex items-center gap-0.5">
              <MapPin className="w-3 h-3 shrink-0" />
              {req.address}
            </span>
          )}
          {req.eta_minutes != null && (
            <span className="flex items-center gap-0.5 text-orange-600 dark:text-orange-400 font-medium">
              <Clock className="w-3 h-3" />
              {t('trade.emergency.etaMinutes').replace('{n}', String(req.eta_minutes))}
            </span>
          )}
          {req.assigned_name && (
            <span className="flex items-center gap-0.5">
              <User className="w-3 h-3" />
              {req.assigned_name}
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <Clock className="w-3 h-3" />
            {timeAgo(req.created_at)}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      {(nextStatuses.length > 0 || req.job_id) && (
        <div className="px-4 pb-4 flex gap-2 flex-wrap">
          {req.status === 'pending' && (
            <button
              onClick={onAccept}
              disabled={isActing}
              className="flex-1 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {t('trade.emergency.accept')}
            </button>
          )}
          {req.status === 'accepted' && (
            <button
              onClick={() => onStatusChange('in_transit')}
              disabled={isActing}
              className="flex-1 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {isActing ? '…' : t('trade.emergency.dispatch')}
            </button>
          )}
          {req.status === 'in_transit' && (
            <button
              onClick={() => onStatusChange('arrived')}
              disabled={isActing}
              className="flex-1 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {isActing ? '…' : t('trade.emergency.markArrived')}
            </button>
          )}
          {req.status === 'arrived' && (
            <button
              onClick={() => onStatusChange('completed')}
              disabled={isActing}
              className="flex-1 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isActing ? '…' : t('trade.emergency.complete')}
            </button>
          )}
          {req.job_id && (
            <button
              onClick={onViewJob}
              className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center gap-1"
            >
              <ChevronRight className="w-3 h-3" />
              {t('trade.emergency.viewJob')}
            </button>
          )}
          {nextStatuses.includes('cancelled') && (
            <button
              onClick={() => onStatusChange('cancelled')}
              disabled={isActing}
              className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-50 transition-colors"
            >
              {t('trade.emergency.cancel')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TradeEmergencyPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = use(params);
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { setActiveProfileId } = useBookingProfile();

  const [emergencyEnabled, setEmergencyEnabled] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<EmergencyStatus | 'all'>('all');

  const [acceptModal, setAcceptModal] = useState<string | null>(null);
  const [eligibleStaff, setEligibleStaff] = useState<EligibleStaff[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [acceptForm, setAcceptForm] = useState<AcceptForm>({ assigned_to: '', eta_minutes: '' });
  const [accepting, setAccepting] = useState(false);

  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [creating, setCreating] = useState(false);

  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !profileId) return;
    setActiveProfileId(profileId);
    loadEnabled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileId]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!profileId) return;

    const channel = (supabase as any)
      .channel(`emergency_${profileId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trade_emergency_requests',
          filter: `business_id=eq.${profileId}`,
        },
        (payload: { eventType: string; new?: { title?: string } }) => {
          if (payload.eventType === 'INSERT') {
            toast(t('trade.emergency.newRequest'), {
              description: payload.new?.title,
            });
          }
          // Reload to pick up joined fields (assigned_name)
          load(activeTab);
        },
      )
      .subscribe();

    return () => {
      (supabase as any).removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, activeTab]);

  // ── Data loading ───────────────────────────────────────────────────────────

  async function loadEnabled() {
    const { data } = await (supabase as any)
      .from('booking_profiles')
      .select('emergency_enabled')
      .eq('id', profileId)
      .single();
    setEmergencyEnabled(data?.emergency_enabled ?? false);
  }

  const load = useCallback(
    async (status: EmergencyStatus | 'all') => {
      setLoading(true);
      const { data } = await (supabase as any).rpc('list_emergency_requests', {
        p_business_id: profileId,
        p_status:      status === 'all' ? null : status,
        p_limit:       100,
        p_offset:      0,
      });
      if (data?.ok) {
        setRequests(data.requests ?? []);
      }
      setLoading(false);
    },
    [profileId],
  );

  useEffect(() => {
    if (user && profileId) load(activeTab);
  }, [user, profileId, activeTab, load]);

  // ── Toggle emergency enabled ───────────────────────────────────────────────

  async function handleToggle(enabled: boolean) {
    setToggling(true);
    const { data } = await (supabase as any).rpc('toggle_emergency_enabled', {
      p_business_id: profileId,
      p_enabled:     enabled,
    });
    if (data?.ok) {
      setEmergencyEnabled(enabled);
    } else {
      toast.error(data?.error ?? 'error');
    }
    setToggling(false);
  }

  // ── Accept modal ───────────────────────────────────────────────────────────

  async function openAcceptModal(requestId: string) {
    setAcceptModal(requestId);
    setAcceptForm({ assigned_to: '', eta_minutes: '' });
    setStaffLoading(true);
    const { data } = await (supabase as any).rpc('list_emergency_eligible_staff', {
      p_business_id: profileId,
    });
    setEligibleStaff(Array.isArray(data) ? data : []);
    setStaffLoading(false);
  }

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptModal) return;
    setAccepting(true);
    const { data } = await (supabase as any).rpc('accept_emergency_request', {
      p_request_id:  acceptModal,
      p_assigned_to: acceptForm.assigned_to || null,
      p_eta_minutes: acceptForm.eta_minutes ? parseInt(acceptForm.eta_minutes, 10) : null,
    });
    if (data?.ok) {
      toast.success(t('trade.emergency.accepted'));
      setAcceptModal(null);
      load(activeTab);
    } else {
      toast.error(data?.error ?? 'error');
    }
    setAccepting(false);
  }

  // ── Status change ──────────────────────────────────────────────────────────

  async function handleStatusChange(requestId: string, newStatus: EmergencyStatus) {
    setActingId(requestId);
    const { data } = await (supabase as any).rpc('update_emergency_status', {
      p_request_id: requestId,
      p_status:     newStatus,
    });
    if (data?.ok) {
      const toastKey =
        newStatus === 'in_transit' ? 'trade.emergency.dispatched'
        : newStatus === 'arrived'  ? 'trade.emergency.arrived'
        : newStatus === 'completed'? 'trade.emergency.completed'
        :                            'trade.emergency.cancelled';
      toast.success(t(toastKey as Parameters<typeof t>[0]));
      load(activeTab);
    } else {
      toast.error(data?.error ?? 'error');
    }
    setActingId(null);
  }

  // ── Create request ─────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.title || !createForm.contact_phone) return;
    setCreating(true);
    const { data } = await (supabase as any).rpc('create_emergency_request', {
      p_business_id:   profileId,
      p_title:         createForm.title.trim(),
      p_contact_phone: createForm.contact_phone.trim(),
      p_description:   createForm.description.trim() || null,
      p_contact_name:  createForm.contact_name.trim() || null,
      p_address:       createForm.address.trim() || null,
      p_whatsapp:      createForm.whatsapp.trim() || null,
      p_viber:         createForm.viber.trim() || null,
    });
    if (data?.ok) {
      toast.success(t('trade.emergency.created'));
      setCreateModal(false);
      setCreateForm(EMPTY_CREATE);
      load(activeTab);
    } else {
      toast.error(data?.error ?? 'error');
    }
    setCreating(false);
  }

  // ── Utils ──────────────────────────────────────────────────────────────────

  function timeAgo(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60)   return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  }

  const isEmpty = !loading && requests.length === 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <TradeDashboardLayout profileId={profileId} active="emergency">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-foreground">
          {t('trade.dashboard.emergency.title')}
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {emergencyEnabled
              ? t('trade.emergency.enabled')
              : t('trade.emergency.disabled')}
          </span>
          <Toggle checked={emergencyEnabled} onChange={handleToggle} disabled={toggling} />
        </div>
      </div>

      {/* Disabled banner */}
      {!emergencyEnabled && (
        <div className="mb-4 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 flex items-start gap-3">
          <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 dark:text-amber-200 leading-snug">
            {t('trade.emergency.disabledBanner')}
          </p>
        </div>
      )}

      {/* Create button */}
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('trade.emergency.new')}
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 scrollbar-none">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-red-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {t(tab.label_key as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty */}
      {isEmpty && (
        <div className="text-center py-12 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950 flex items-center justify-center">
            <Zap className="w-7 h-7 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-sm text-muted-foreground">
            {activeTab === 'all'
              ? t('trade.emergency.empty')
              : t('trade.emergency.emptyStatus')}
          </p>
        </div>
      )}

      {/* Request list */}
      {!loading && requests.length > 0 && (
        <div className="flex flex-col gap-3">
          {requests.map((req) => (
            <RequestCard
              key={req.id}
              req={req}
              actingId={actingId}
              onAccept={() => openAcceptModal(req.id)}
              onStatusChange={(s) => handleStatusChange(req.id, s)}
              onViewJob={() =>
                router.push(`/booking/trade/${profileId}/jobs/${req.job_id}`)
              }
              timeAgo={timeAgo}
              t={t}
            />
          ))}
        </div>
      )}

      {/* ── Accept Modal ────────────────────────────────────────────────────── */}
      {acceptModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setAcceptModal(null)}
          />
          <div className="relative z-10 w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-2xl border border-border p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">
                {t('trade.emergency.acceptModal')}
              </h2>
              <button
                onClick={() => setAcceptModal(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              {t('trade.emergency.acceptModalDesc')}
            </p>

            <form onSubmit={handleAccept} className="flex flex-col gap-3">
              {/* Assign to */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-muted-foreground">
                  {t('trade.emergency.assignTo')}
                </label>
                {staffLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>…</span>
                  </div>
                ) : eligibleStaff.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t('trade.emergency.noEligibleStaff')}
                  </p>
                ) : (
                  <select
                    value={acceptForm.assigned_to}
                    onChange={(e) =>
                      setAcceptForm((f) => ({ ...f, assigned_to: e.target.value }))
                    }
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">{t('trade.emergency.noAssign')}</option>
                    {eligibleStaff.map((s) => (
                      <option key={s.user_id} value={s.user_id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* ETA */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-muted-foreground">
                  {t('trade.emergency.etaLabel')}
                </label>
                <input
                  type="number"
                  min="1"
                  max="480"
                  placeholder={t('trade.emergency.etaPh')}
                  value={acceptForm.eta_minutes}
                  onChange={(e) =>
                    setAcceptForm((f) => ({ ...f, eta_minutes: e.target.value }))
                  }
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                type="submit"
                disabled={accepting}
                className="w-full py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {accepting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                {t('trade.emergency.acceptBtn')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Create Modal ─────────────────────────────────────────────────────── */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setCreateModal(false)}
          />
          <div className="relative z-10 w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-2xl border border-border p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">
                {t('trade.emergency.createModal')}
              </h2>
              <button
                onClick={() => setCreateModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              {/* Problem title */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-muted-foreground">
                  {t('trade.emergency.titleLabel')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('trade.emergency.titlePh')}
                  value={createForm.title}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Contact name + phone */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('trade.emergency.contactName')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('trade.emergency.contactNamePh')}
                    value={createForm.contact_name}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, contact_name: e.target.value }))
                    }
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('trade.emergency.contactPhone')} *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder={t('trade.emergency.contactPhonePh')}
                    value={createForm.contact_phone}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, contact_phone: e.target.value }))
                    }
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* WhatsApp + Viber */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground">WhatsApp</label>
                  <input
                    type="text"
                    placeholder="+387 61…"
                    value={createForm.whatsapp}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, whatsapp: e.target.value }))
                    }
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground">Viber</label>
                  <input
                    type="text"
                    placeholder="+387 61…"
                    value={createForm.viber}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, viber: e.target.value }))
                    }
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-muted-foreground">
                  {t('trade.emergency.address')}
                </label>
                <input
                  type="text"
                  placeholder="Ulica i broj, grad…"
                  value={createForm.address}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, address: e.target.value }))
                  }
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-muted-foreground">
                  {t('trade.emergency.description')}
                </label>
                <textarea
                  rows={2}
                  placeholder={t('trade.emergency.descPh')}
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={creating || !createForm.title || !createForm.contact_phone}
                className="w-full py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {t('trade.emergency.new')}
              </button>
            </form>
          </div>
        </div>
      )}
    </TradeDashboardLayout>
  );
}
