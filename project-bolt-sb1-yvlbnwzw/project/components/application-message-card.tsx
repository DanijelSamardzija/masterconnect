'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Phone, Mail, MapPin, FileText, Download, CheckCircle2, XCircle, Clock, Loader2, User } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/contexts/language-context';

export type ApplicationData = {
  applicationId?: string | null;
  postOwnerId?: string | null;
  applicantId?: string | null;
  threadId?: string | null;
  applicantName: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  bio: string;
  skills?: string | null;
  experience: string;
  salaryType?: string | null;
  salaryAmount?: string | null;
  salaryCurrency?: string;
  imageUrl?: string | null;
  cvUrl?: string | null;
  cvFileName?: string | null;
  videoUrl?: string | null;
  postTitle?: string;
  submittedAt?: string;
};

const salaryTypeLabel: Record<string, string> = {
  hourly: 'po satu / per hour',
  monthly: 'mesečno / monthly',
  fixed: 'fiksno / fixed',
};

export function ApplicationMessageCard({
  data,
  createdAt,
  currentUserId,
}: {
  data: ApplicationData;
  createdAt: string;
  currentUserId?: string;
}) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<'pending' | 'accepted' | 'declined'>('pending');
  const [responding, setResponding] = useState(false);

  // Load real status from DB on mount + live subscription
  useEffect(() => {
    if (!data.applicationId) return;

    // Initial fetch — resolve applicationId if missing (legacy messages)
    const resolveAndFetch = async () => {
      let appId = data.applicationId;
      if (!appId && data.applicantId && data.threadId) {
        const { data: thread } = await supabase
          .from('threads').select('post_id, job_id').eq('id', data.threadId).maybeSingle();
        const postId = thread?.post_id || thread?.job_id;
        if (postId) {
          const { data: appRow } = await supabase
            .from('job_applications').select('id').eq('applicant_id', data.applicantId).eq('post_id', postId).maybeSingle();
          appId = appRow?.id ?? null;
        }
      }
      if (!appId) return;
      const { data: row } = await supabase
        .from('job_applications').select('status').eq('id', appId).maybeSingle();
      if (row?.status === 'accepted' || row?.status === 'declined') setStatus(row.status);
    };
    resolveAndFetch();

    // Real-time: update status for BOTH sides when owner responds
    const channelId = data.applicationId || `${data.applicantId}-${data.threadId}`;
    const channel = supabase
      .channel(`app-status-${channelId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'job_applications', filter: data.applicationId ? `id=eq.${data.applicationId}` : undefined },
        (payload: any) => {
          const s = payload.new?.status;
          if (s === 'accepted' || s === 'declined') setStatus(s);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [data.applicationId]);

  const isOwner = currentUserId === data.postOwnerId;

  const formattedDate = (() => {
    try { return format(new Date(data.submittedAt || createdAt), 'dd.MM.yyyy. HH:mm'); }
    catch { return ''; }
  })();

  const initials = data.applicantName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleRespond = async (newStatus: 'accepted' | 'declined') => {
    setResponding(true);

    // Resolve applicationId — may be missing in older messages
    let appId = data.applicationId;
    if (!appId && data.applicantId) {
      // Look up by applicant + thread (find the post linked to this thread)
      const { data: thread } = await supabase
        .from('threads')
        .select('post_id, job_id')
        .eq('id', data.threadId)
        .maybeSingle();

      const postId = thread?.post_id || thread?.job_id;
      if (postId) {
        const { data: appRow } = await supabase
          .from('job_applications')
          .select('id')
          .eq('applicant_id', data.applicantId)
          .eq('post_id', postId)
          .maybeSingle();
        appId = appRow?.id ?? null;
      }
    }

    if (!appId) {
      toast.error('Greška: ID prijave nije pronađen');
      setResponding(false);
      return;
    }

    // Use server API (service role) to bypass RLS
    const res = await fetch('/api/job-applications/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: appId, status: newStatus, callerId: currentUserId }),
    });

    if (!res.ok) {
      toast.error('Greška / Error');
      setResponding(false);
      return;
    }

    setStatus(newStatus);
    toast.success(newStatus === 'accepted' ? t('offer.card.applicationAccepted') : t('offer.card.applicationDeclined'));

    // Send notification to applicant
    if (data.applicantId && data.postOwnerId) {
      const ownerName = (await supabase.from('profiles').select('name').eq('id', data.postOwnerId).maybeSingle()).data?.name || 'Neko';
      const titleSr = newStatus === 'accepted'
        ? `${ownerName} je prihvatio vašu prijavu`
        : `${ownerName} je odbio vašu prijavu`;
      const titleEn = newStatus === 'accepted'
        ? `${ownerName} accepted your application`
        : `${ownerName} declined your application`;
      await supabase.from('notifications').insert({
        user_id: data.applicantId,
        type: newStatus === 'accepted' ? 'application_accepted' : 'application_declined',
        action_type: newStatus === 'accepted' ? 'application_accepted' : 'application_declined',
        title: titleSr,
        body: data.postTitle || '',
        meta: { actor_name: ownerName, post_title: data.postTitle, status: newStatus },
      });
    }

    // Send system message in thread
    if (data.threadId) {
      const statusText = newStatus === 'accepted'
        ? '✅ Prijava je prihvaćena / Application accepted'
        : '❌ Prijava je odbijena / Application declined';
      await supabase.from('messages').insert({
        thread_id: data.threadId,
        sender_id: data.postOwnerId,
        receiver_id: data.applicantId,
        content: statusText,
        is_system: true,
      });
    }

    setResponding(false);
  };

  return (
    <div className="w-64 sm:w-72 rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">

      {/* Header */}
      <div className="bg-slate-900 dark:bg-slate-800 px-4 pt-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1.5 bg-orange-500/20 border border-orange-500/30 text-orange-400 text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 inline-block" />
            {t('offer.card.application')}
          </span>
          {formattedDate && <span className="text-[10px] text-slate-400">{formattedDate}</span>}
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          {data.imageUrl ? (
            <img src={data.imageUrl} alt={data.applicantName} className="h-12 w-12 rounded-xl object-cover ring-2 ring-orange-500/40 flex-shrink-0" />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-base leading-none">{initials}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">{data.applicantName}</p>
            {data.postTitle && <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{data.postTitle}</p>}
            {data.city && (
              <span className="flex items-center gap-0.5 text-[11px] text-slate-400 mt-0.5">
                <MapPin className="h-3 w-3" />{data.city}
              </span>
            )}
          </div>
        </div>

        {/* Contact pills */}
        {(data.phone || data.email) && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {data.phone && (
              <a href={`tel:${data.phone}`} className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-full px-2.5 py-1 hover:bg-slate-700 transition-colors">
                <Phone className="h-3 w-3 text-orange-400" />
                <span className="text-[11px] text-slate-300">{data.phone}</span>
              </a>
            )}
            {data.email && (
              <a href={`mailto:${data.email}`} className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-full px-2.5 py-1 hover:bg-slate-700 transition-colors">
                <Mail className="h-3 w-3 text-orange-400" />
                <span className="text-[11px] text-slate-300 truncate max-w-[120px]">{data.email}</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">

        {data.bio && (
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('offer.card.aboutMe')}</p>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3 whitespace-pre-line">{data.bio}</p>
          </div>
        )}

        {data.skills && (
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{t('offer.card.skills')}</p>
            <div className="flex flex-wrap gap-1">
              {data.skills.split(/[,;]+/).map((s, i) => s.trim() && (
                <span key={i} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] px-2 py-0.5 rounded-full">
                  {s.trim()}
                </span>
              ))}
            </div>
          </div>
        )}

        {data.experience && (
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('offer.card.experience')}</p>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3 whitespace-pre-line">{data.experience}</p>
          </div>
        )}

        {data.salaryType && data.salaryAmount && (
          <div className="px-4 py-2.5 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t('offer.card.expectedSalary')}</p>
            <span className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
              {Number(data.salaryAmount).toLocaleString()} {data.salaryCurrency ?? 'RSD'}
              <span className="font-normal opacity-70 ml-1">/ {salaryTypeLabel[data.salaryType] ?? data.salaryType}</span>
            </span>
          </div>
        )}

        {data.cvUrl && (
          <div className="px-4 py-3">
            <a href={data.cvUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 group">
              <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-blue-600 transition-colors">
                  {data.cvFileName || 'CV'}
                </p>
                <p className="text-[10px] text-slate-400">{t('offer.card.openDoc')}</p>
              </div>
              <Download className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
            </a>
          </div>
        )}

        {data.videoUrl && (
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('offer.card.videoPresentation')}</p>
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black">
              <video src={data.videoUrl} controls className="w-full max-h-36 object-contain" />
            </div>
          </div>
        )}

        {/* Status / Actions */}
        <div className="px-4 py-3">
          {isOwner && status === 'pending' && (
            <div className="flex gap-2">
              <button
                onClick={() => handleRespond('accepted')}
                disabled={responding}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {responding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {t('offer.card.accept')}
              </button>
              <button
                onClick={() => handleRespond('declined')}
                disabled={responding}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {responding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                {t('offer.card.decline')}
              </button>
            </div>
          )}
          {!isOwner && status === 'pending' && (
            <div className="flex items-center justify-center gap-2 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <Clock className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('offer.card.awaitingReview')}</span>
            </div>
          )}
          {status === 'accepted' && (
            <div className="flex items-center justify-center gap-2 h-9 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs font-semibold text-green-700 dark:text-green-400">{t('offer.card.applicationAccepted')}</span>
            </div>
          )}
          {status === 'declined' && (
            <div className="flex items-center justify-center gap-2 h-9 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-xs font-semibold text-red-700 dark:text-red-400">{t('offer.card.applicationDeclined')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
