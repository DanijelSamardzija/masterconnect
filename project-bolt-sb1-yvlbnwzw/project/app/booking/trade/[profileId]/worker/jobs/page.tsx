'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { friendlyError } from '@/lib/utils/friendly-error';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeWorkerLayout } from '@/components/trade/TradeWorkerLayout';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Briefcase,
  Loader2,
  Clock,
  MapPin,
  ChevronRight,
  Play,
  CheckCircle2,
  PauseCircle,
  RotateCcw,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { toCsv, downloadCsv } from '@/lib/utils/export-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type JobStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';

type MyJob = {
  id: string;
  title: string;
  description: string | null;
  status: JobStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  origin_type: string;
  location: string | null;
  scheduled_start: string | null;
  actual_start: string | null;
  actual_end: string | null;
  client_name: string | null;
  client_phone: string | null;
  created_at: string;
};

const STATUS_TABS: { key: JobStatus | 'all'; labelKey: string }[] = [
  { key: 'all',         labelKey: 'trade.jobs.statusAll' },
  { key: 'pending',     labelKey: 'trade.jobs.status_pending' },
  { key: 'confirmed',   labelKey: 'trade.jobs.status_confirmed' },
  { key: 'in_progress', labelKey: 'trade.jobs.status_in_progress' },
  { key: 'on_hold',     labelKey: 'trade.jobs.status_on_hold' },
  { key: 'completed',   labelKey: 'trade.jobs.status_completed' },
];

const STATUS_COLORS: Record<JobStatus, string> = {
  pending:     'bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-400',
  confirmed:   'bg-blue-100   text-blue-800   dark:bg-blue-900/30   dark:text-blue-400',
  in_progress: 'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400',
  on_hold:     'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  completed:   'bg-muted      text-muted-foreground',
  cancelled:   'bg-muted      text-muted-foreground',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-red-600   dark:text-red-400',
  high:   'text-orange-600 dark:text-orange-400',
  normal: 'text-foreground',
  low:    'text-muted-foreground',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkerJobsPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = use(params);
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { setActiveProfileId } = useBookingProfile();

  const [jobs, setJobs] = useState<MyJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<JobStatus | 'all'>('all');
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !profileId) return;
    setActiveProfileId(profileId);
  }, [user, profileId, setActiveProfileId]);

  // ── Realtime: notify when a new job is assigned ───────────────────────────
  useEffect(() => {
    if (!user || !profileId) return;

    const channel = (supabase as any)
      .channel(`worker_jobs_${profileId}_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trade_jobs',
          filter: `assigned_to=eq.${user.id}`,
        },
        (payload: { new?: { title?: string } }) => {
          toast(t('trade.worker.newAssignment'), {
            description: payload.new?.title,
          });
          load(activeTab);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trade_jobs',
          filter: `assigned_to=eq.${user.id}`,
        },
        () => {
          load(activeTab);
        },
      )
      .subscribe();

    return () => {
      (supabase as any).removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, user, activeTab]);

  const load = useCallback(
    async (status: JobStatus | 'all') => {
      setLoading(true);
      const { data } = await (supabase as any).rpc('list_my_trade_jobs', {
        p_business_id: profileId,
        p_status:      status === 'all' ? null : status,
        p_limit:       100,
        p_offset:      0,
      });
      if (data?.ok) setJobs(data.jobs ?? []);
      setLoading(false);
    },
    [profileId],
  );

  useEffect(() => {
    if (user && profileId) load(activeTab);
  }, [user, profileId, activeTab, load]);

  async function handleStatusChange(jobId: string, newStatus: JobStatus) {
    setActingId(jobId);
    const { data } = await (supabase as any).rpc('worker_update_job_status', {
      p_job_id: jobId,
      p_status: newStatus,
    });
    if (data?.ok) {
      toast.success(t('trade.worker.statusUpdated'));
      load(activeTab);
    } else {
      toast.error(friendlyError(data?.error, t));
    }
    setActingId(null);
  }

  function formatDate(iso: string | null) {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  function exportCsv() {
    if (!jobs.length) return;
    const date = new Date().toISOString().slice(0, 10);
    const csv = toCsv(
      ['Title', 'Status', 'Priority', 'Client', 'Scheduled Start', 'Location', 'Created'],
      jobs.map(j => [
        j.title,
        j.status,
        j.priority,
        j.client_name,
        j.scheduled_start,
        j.location,
        j.created_at,
      ]),
    );
    downloadCsv(`my-jobs-${activeTab}-${date}.csv`, csv);
  }

  return (
    <TradeWorkerLayout profileId={profileId} active="jobs">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-foreground">
          {t('trade.worker.myJobs')}
        </h1>
        {jobs.length > 0 && (
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title={t('trade.export.csvJobs')}
          >
            <Download className="w-3.5 h-3.5" />
            {t('trade.export.csv')}
          </button>
        )}
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 scrollbar-none">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {t(tab.labelKey as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && jobs.length === 0 && (
        <div className="text-center py-12 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Briefcase className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {activeTab === 'all'
              ? t('trade.worker.noJobs')
              : t('trade.worker.noJobsStatus')}
          </p>
        </div>
      )}

      {!loading && jobs.length > 0 && (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => {
            const isActing = actingId === job.id;
            return (
              <div
                key={job.id}
                className={`border rounded-xl bg-card overflow-hidden ${
                  job.status === 'in_progress'
                    ? 'border-green-300 dark:border-green-800'
                    : job.priority === 'urgent' || job.origin_type === 'emergency'
                      ? 'border-red-300 dark:border-red-800'
                      : 'border-border'
                }`}
              >
                {/* Header */}
                <div className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold leading-snug ${PRIORITY_COLORS[job.priority]}`}>
                      {job.origin_type === 'emergency' && (
                        <AlertTriangle className="inline w-3.5 h-3.5 mr-1 text-red-500" />
                      )}
                      {job.title}
                    </p>
                    <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS[job.status]}`}>
                      {t(`trade.jobs.status_${job.status}` as Parameters<typeof t>[0])}
                    </span>
                  </div>
                  {job.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {job.description}
                    </p>
                  )}
                </div>

                {/* Meta */}
                <div className="px-4 pb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {job.client_name && (
                    <span>{job.client_name}</span>
                  )}
                  {job.location && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />
                      {job.location}
                    </span>
                  )}
                  {job.scheduled_start && (
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {formatDate(job.scheduled_start)}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="px-4 pb-4 flex gap-2 flex-wrap items-center">
                  {/* Start / Resume */}
                  {(job.status === 'pending' || job.status === 'confirmed') && (
                    <button
                      onClick={() => handleStatusChange(job.id, 'in_progress')}
                      disabled={isActing}
                      className="flex-1 py-2 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      {t('trade.worker.startJob')}
                    </button>
                  )}
                  {job.status === 'on_hold' && (
                    <button
                      onClick={() => handleStatusChange(job.id, 'in_progress')}
                      disabled={isActing}
                      className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      {t('trade.worker.resumeJob')}
                    </button>
                  )}
                  {job.status === 'in_progress' && (
                    <>
                      <button
                        onClick={() => handleStatusChange(job.id, 'completed')}
                        disabled={isActing}
                        className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                      >
                        {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        {t('trade.worker.completeJob')}
                      </button>
                      <button
                        onClick={() => handleStatusChange(job.id, 'on_hold')}
                        disabled={isActing}
                        className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:border-orange-400 hover:text-orange-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                      >
                        <PauseCircle className="w-3.5 h-3.5" />
                        {t('trade.worker.putOnHold')}
                      </button>
                    </>
                  )}
                  {/* Detail link — always visible */}
                  <button
                    onClick={() =>
                      router.push(
                        `/booking/trade/${profileId}/worker/jobs/${job.id}`,
                      )
                    }
                    className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    {t('trade.jobs.viewDetail')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </TradeWorkerLayout>
  );
}
