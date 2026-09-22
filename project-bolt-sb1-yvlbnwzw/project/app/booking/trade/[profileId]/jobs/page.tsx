'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeDashboardLayout } from '@/components/trade/TradeDashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Plus,
  Briefcase,
  Loader2,
  ChevronRight,
  Clock,
  MapPin,
  User,
  AlertCircle,
  CheckCircle2,
  Circle,
  PauseCircle,
  XCircle,
  Download,
} from 'lucide-react';
import { toCsv, downloadCsv } from '@/lib/utils/export-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type JobStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

type JobSummary = {
  id: string;
  title: string;
  status: JobStatus;
  priority: JobPriority;
  client_id: string | null;
  client_name: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  location: string | null;
  created_at: string;
};

const STATUS_TABS: { key: JobStatus | 'all'; label_key: string }[] = [
  { key: 'all',         label_key: 'trade.jobs.statusAll' },
  { key: 'pending',     label_key: 'trade.jobs.statusPending' },
  { key: 'confirmed',   label_key: 'trade.jobs.statusConfirmed' },
  { key: 'in_progress', label_key: 'trade.jobs.statusInProgress' },
  { key: 'completed',   label_key: 'trade.jobs.statusCompleted' },
  { key: 'on_hold',     label_key: 'trade.jobs.statusOnHold' },
];

const PRIORITY_COLOR: Record<JobPriority, string> = {
  low:    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  normal: 'bg-blue-100  text-blue-700  dark:bg-blue-950  dark:text-blue-400',
  high:   'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  urgent: 'bg-red-100   text-red-700   dark:bg-red-950   dark:text-red-400',
};

function StatusIcon({ status }: { status: JobStatus }) {
  switch (status) {
    case 'completed':   return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'in_progress': return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />;
    case 'confirmed':   return <Circle className="w-4 h-4 text-indigo-500" />;
    case 'on_hold':     return <PauseCircle className="w-4 h-4 text-amber-500" />;
    case 'cancelled':   return <XCircle className="w-4 h-4 text-muted-foreground" />;
    default:            return <AlertCircle className="w-4 h-4 text-slate-400" />;
  }
}

function JobRow({ job, profileId, onClick }: { job: JobSummary; profileId: string; onClick: () => void }) {
  const { t } = useLanguage();

  const scheduledLabel = job.scheduled_start
    ? new Date(job.scheduled_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/30 transition-colors text-left"
    >
      <div className="shrink-0">
        <StatusIcon status={job.status} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground truncate">{job.title}</p>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${PRIORITY_COLOR[job.priority]}`}>
            {t(`trade.jobs.priority${job.priority.charAt(0).toUpperCase()}${job.priority.slice(1)}` as any)}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {job.client_name && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <User className="w-3 h-3" /> {job.client_name}
            </span>
          )}
          {scheduledLabel && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Clock className="w-3 h-3" /> {scheduledLabel}
            </span>
          )}
          {job.location && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5 truncate max-w-[160px]">
              <MapPin className="w-3 h-3 shrink-0" /> {job.location}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TradeJobsPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = use(params);
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { setActiveProfileId } = useBookingProfile();

  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<JobStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profileId) return;
    setActiveProfileId(profileId);
  }, [user, profileId, setActiveProfileId]);

  const load = useCallback(async (status: JobStatus | 'all') => {
    setLoading(true);
    const { data } = await (supabase as any).rpc('list_trade_jobs', {
      p_business_id: profileId,
      p_status:      status === 'all' ? null : status,
      p_limit:       100,
      p_offset:      0,
    });
    if (data?.ok) {
      setJobs(data.jobs ?? []);
      setTotal(data.total ?? 0);
    } else {
      toast.error(data?.error ?? 'error');
    }
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    if (user && profileId) load(activeTab);
  }, [user, profileId, activeTab, load]);

  function handleTabChange(tab: JobStatus | 'all') {
    setActiveTab(tab);
  }

  const isEmpty = !loading && jobs.length === 0;

  function exportCsv() {
    if (!jobs.length) return;
    const date = new Date().toISOString().slice(0, 10);
    const csv = toCsv(
      ['Title', 'Status', 'Priority', 'Client', 'Assigned To', 'Scheduled Start', 'Scheduled End', 'Location', 'Created'],
      jobs.map(j => [
        j.title,
        j.status,
        j.priority,
        j.client_name,
        j.assigned_name,
        j.scheduled_start,
        j.scheduled_end,
        j.location,
        j.created_at,
      ]),
    );
    downloadCsv(`jobs-${activeTab}-${date}.csv`, csv);
  }

  return (
    <TradeDashboardLayout profileId={profileId} active="jobs">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-foreground">{t('trade.dashboard.jobs.title')}</h1>
        <div className="flex items-center gap-2">
          {jobs.length > 0 && (
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={t('trade.export.csvJobs')}
            >
              <Download className="w-3.5 h-3.5" />
              {t('trade.export.csv')}
            </button>
          )}
          <button
            onClick={() => router.push(`/booking/trade/${profileId}/jobs/new`)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('trade.jobs.new')}
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 scrollbar-none">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {t(tab.label_key as any)}
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
          <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
            <Briefcase className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-sm text-muted-foreground">
            {activeTab === 'all' ? t('trade.jobs.empty') : t('trade.jobs.emptyStatus')}
          </p>
          {activeTab === 'all' && (
            <button
              onClick={() => router.push(`/booking/trade/${profileId}/jobs/new`)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('trade.jobs.createFirst')}
            </button>
          )}
        </div>
      )}

      {/* Job list */}
      {!loading && jobs.length > 0 && (
        <div className="flex flex-col gap-2">
          {jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              profileId={profileId}
              onClick={() => router.push(`/booking/trade/${profileId}/jobs/${job.id}`)}
            />
          ))}
          {total > jobs.length && (
            <p className="text-xs text-muted-foreground text-center py-2">
              {t('trade.jobs.showingOf').replace('{n}', String(jobs.length)).replace('{total}', String(total))}
            </p>
          )}
        </div>
      )}
    </TradeDashboardLayout>
  );
}
