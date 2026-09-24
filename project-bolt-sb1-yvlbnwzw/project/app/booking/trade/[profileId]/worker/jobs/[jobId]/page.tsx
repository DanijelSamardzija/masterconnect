'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeWorkerLayout } from '@/components/trade/TradeWorkerLayout';
import { supabase } from '@/lib/supabase/client';
import { compressImage } from '@/lib/utils/compress-image';
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, Camera, Package, FileText,
  Clock, MapPin, CheckCircle2, PauseCircle, Play,
  RotateCcw, Upload, Image as ImageIcon, Plus, Trash2, User,
  Navigation, Check,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type JobStatus = 'pending' | 'confirmed' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
type PhotoType = 'before' | 'during' | 'after' | 'document';

type Material = {
  id: string; name: string; quantity: number; unit: string | null;
  sale_price: number | null; added_by: string | null; created_at: string;
};

type Photo = {
  id: string; photo_type: PhotoType; storage_path: string;
  caption: string | null; uploaded_by: string | null; created_at: string;
};

type Job = {
  id: string; business_id: string; title: string; description: string | null;
  status: JobStatus; priority: string; origin_type: string;
  client_id: string | null; client_name: string | null;
  assigned_to: string | null; assigned_name: string | null;
  scheduled_start: string | null; actual_start: string | null; actual_end: string | null;
  location: string | null; notes: string | null; report_text: string | null;
  eta_time: string | null; on_the_way_at: string | null;
  materials: Material[]; photos: Photo[];
  total_materials_cost: number | null; total_expenses: number | null;
  can_view_client_records: boolean;
  can_create_job_reports: boolean;
  can_add_materials: boolean;
};

const PHOTO_TYPE_TABS: { key: PhotoType; labelKey: string }[] = [
  { key: 'before',   labelKey: 'trade.photos.type_before' },
  { key: 'during',   labelKey: 'trade.photos.type_during' },
  { key: 'after',    labelKey: 'trade.photos.type_after' },
  { key: 'document', labelKey: 'trade.photos.type_document' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkerJobDetailPage({
  params,
}: {
  params: Promise<{ profileId: string; jobId: string }>;
}) {
  const { profileId, jobId } = useParams() as { profileId: string; jobId: string };
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { setActiveProfileId } = useBookingProfile();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingStatus, setActingStatus] = useState(false);
  const [etaValue, setEtaValue] = useState('');
  const [savingEta, setSavingEta] = useState(false);

  // Report editing
  const [editingReport, setEditingReport] = useState(false);
  const [reportText, setReportText] = useState('');
  const [savingReport, setSavingReport] = useState(false);

  // Photo upload
  const [activePhotoTab, setActivePhotoTab] = useState<PhotoType>('during');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Material add
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [matForm, setMatForm] = useState({ name: '', quantity: '1', unit: '', sale_price: '' });
  const [savingMat, setSavingMat] = useState(false);

  useEffect(() => {
    if (!user || !profileId) return;
    setActiveProfileId(profileId);
    loadJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileId, jobId]);

  async function loadJob() {
    setLoading(true);
    const { data } = await (supabase as any).rpc('get_trade_job', {
      p_job_id: jobId,
    });
    if (data?.ok && data.job) {
      const j = data.job;
      setJob({
        ...j,
        can_view_client_records: data.can_view_client_records ?? false,
        can_create_job_reports:  data.can_create_job_reports  ?? false,
        can_add_materials:       data.can_add_materials        ?? false,
      });
      setReportText(j.report_text ?? '');
    } else {
      toast.error(data?.error ?? 'error');
    }
    setLoading(false);
  }

  // ── Status actions ─────────────────────────────────────────────────────────

  async function handleStatusChange(newStatus: JobStatus) {
    setActingStatus(true);
    const { data } = await (supabase as any).rpc('worker_update_job_status', {
      p_job_id: jobId,
      p_status: newStatus,
    });
    if (data?.ok) {
      if (newStatus === 'on_the_way') {
        toast.success(t('trade.worker.onTheWayConfirm'));
        setEtaValue(job?.eta_time ?? '');
      } else {
        toast.success(t('trade.worker.statusUpdated'));
      }
      loadJob();
    } else {
      toast.error(data?.error ?? 'error');
    }
    setActingStatus(false);
  }

  async function handleSaveEta() {
    setSavingEta(true);
    const { data } = await (supabase as any).rpc('update_trade_job_eta', {
      p_job_id:   jobId,
      p_eta_time: etaValue.trim() || null,
    });
    if (data?.ok) {
      toast.success(t('trade.worker.etaUpdated'));
      loadJob();
    } else {
      toast.error(data?.error ?? 'error');
    }
    setSavingEta(false);
  }

  // ── Save report ────────────────────────────────────────────────────────────

  async function saveReport() {
    setSavingReport(true);
    const { data } = await (supabase as any).rpc('update_trade_job', {
      p_job_id:      jobId,
      p_report_text: reportText.trim() || null,
    });
    if (data?.ok) {
      toast.success(t('trade.worker.reportSaved'));
      setEditingReport(false);
      loadJob();
    } else {
      toast.error(data?.error ?? 'error');
    }
    setSavingReport(false);
  }

  // ── Photo upload ───────────────────────────────────────────────────────────

  async function handlePhotoUpload(file: File) {
    if (!job) return;
    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file, 1400, 0.82);
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${job.business_id}/${jobId}/${activePhotoTab}/${Date.now()}.${ext}`;

      const { error: uploadError } = await (supabase as any).storage
        .from('trade-photos')
        .upload(path, compressed, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data } = await (supabase as any).rpc('add_trade_photo', {
        p_job_id:       jobId,
        p_storage_path: path,
        p_photo_type:   activePhotoTab,
        p_caption:      null,
      });

      if (data?.ok) {
        toast.success(t('trade.photos.uploaded'));
        loadJob();
      } else {
        // Clean up orphaned storage file
        await (supabase as any).storage.from('trade-photos').remove([path]);
        toast.error(data?.error ?? 'error');
      }
    } catch {
      toast.error(t('trade.photos.uploadError'));
    }
    setUploadingPhoto(false);
  }

  // ── Add material ───────────────────────────────────────────────────────────

  async function handleAddMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!matForm.name) return;
    setSavingMat(true);
    const { data } = await (supabase as any).rpc('upsert_trade_material', {
      p_job_id:    jobId,
      p_name:      matForm.name.trim(),
      p_quantity:  parseFloat(matForm.quantity) || 1,
      p_unit:      matForm.unit.trim() || null,
      p_sale_price:matForm.sale_price ? parseFloat(matForm.sale_price) : null,
    });
    if (data?.ok) {
      toast.success(t('trade.materials.saved'));
      setMatForm({ name: '', quantity: '1', unit: '', sale_price: '' });
      setShowMaterialForm(false);
      loadJob();
    } else {
      toast.error(data?.error ?? 'error');
    }
    setSavingMat(false);
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  async function getPhotoUrl(path: string) {
    const { data } = await (supabase as any).storage
      .from('trade-photos')
      .createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <TradeWorkerLayout profileId={profileId} active="jobs">
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </TradeWorkerLayout>
    );
  }

  if (!job) {
    return (
      <TradeWorkerLayout profileId={profileId} active="jobs">
        <button onClick={() => router.push(`/booking/trade/${profileId}/worker/jobs`)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t('common.back')}
        </button>
        <p className="text-center text-muted-foreground py-12">
          {t('trade.jobs.notFound')}
        </p>
      </TradeWorkerLayout>
    );
  }

  const isTerminal = job.status === 'completed' || job.status === 'cancelled';

  return (
    <TradeWorkerLayout profileId={profileId} active="jobs">
      {/* Back + title */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => router.push(`/booking/trade/${profileId}/worker/jobs`)}
          className="p-2 rounded-xl hover:bg-accent text-muted-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-foreground truncate">{job.title}</h1>
          <p className="text-xs text-muted-foreground">
            {t(`trade.jobs.status_${job.status}` as Parameters<typeof t>[0])}
            {' · '}
            {t(`trade.jobs.priority_${job.priority}` as Parameters<typeof t>[0])}
          </p>
        </div>
      </div>

      {/* Status quick-actions */}
      {!isTerminal && (
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex gap-2 flex-wrap">
            {/* On the way */}
            {(job.status === 'pending' || job.status === 'confirmed') && (
              <button
                onClick={() => handleStatusChange('on_the_way')}
                disabled={actingStatus}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                {actingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                {t('trade.worker.onTheWay')}
              </button>
            )}
            {/* Start / Arrived */}
            {(job.status === 'pending' || job.status === 'confirmed' || job.status === 'on_the_way') && (
              <button
                onClick={() => handleStatusChange('in_progress')}
                disabled={actingStatus}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                {actingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : job.status === 'on_the_way' ? <CheckCircle2 className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {job.status === 'on_the_way' ? t('trade.worker.arrived') : t('trade.worker.startJob')}
              </button>
            )}
            {job.status === 'on_hold' && (
              <button
                onClick={() => handleStatusChange('in_progress')}
                disabled={actingStatus}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                {actingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                {t('trade.worker.resumeJob')}
              </button>
            )}
            {job.status === 'in_progress' && (
              <>
                <button
                  onClick={() => handleStatusChange('completed')}
                  disabled={actingStatus}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  {actingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {t('trade.worker.completeJob')}
                </button>
                <button
                  onClick={() => handleStatusChange('on_hold')}
                  disabled={actingStatus}
                  className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:border-orange-400 hover:text-orange-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  <PauseCircle className="w-4 h-4" />
                  {t('trade.worker.putOnHold')}
                </button>
              </>
            )}
          </div>
          {/* ETA row — shown when on_the_way */}
          {job.status === 'on_the_way' && (
            <div className="flex items-center gap-2 px-1">
              <Clock className="w-4 h-4 text-purple-500 shrink-0" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">{t('trade.worker.etaTime')}:</span>
              <input
                type="time"
                value={etaValue || (job.eta_time ?? '')}
                onChange={e => setEtaValue(e.target.value)}
                className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary w-32"
              />
              <button
                onClick={handleSaveEta}
                disabled={savingEta}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {savingEta ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                {t('trade.worker.etaSave')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Info card */}
      <div className="rounded-xl border border-border bg-card p-4 mb-4 flex flex-col gap-2 text-sm">
        {job.description && (
          <p className="text-muted-foreground text-xs">{job.description}</p>
        )}
        {job.location && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {job.location}
          </div>
        )}
        {job.scheduled_start && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            {formatDate(job.scheduled_start)}
          </div>
        )}
        {/* Client — only if worker has can_view_client_records */}
        {job.can_view_client_records && job.client_name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="w-3.5 h-3.5 shrink-0" />
            {job.client_name}
          </div>
        )}
      </div>

      {/* ── Report section ───────────────────────────────────────────────── */}
      {job.can_create_job_reports && (
        <section className="rounded-xl border border-border bg-card p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              {t('trade.worker.reportLabel')}
            </h2>
            {!editingReport && !isTerminal && (
              <button
                onClick={() => setEditingReport(true)}
                className="text-xs text-primary hover:underline"
              >
                {job.report_text ? t('trade.jobs.editReport') : t('trade.worker.logReport')}
              </button>
            )}
          </div>

          {editingReport ? (
            <div className="flex flex-col gap-2">
              <textarea
                rows={4}
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder={t('trade.worker.reportPh')}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveReport}
                  disabled={savingReport}
                  className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {savingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {t('trade.jobs.saveReport')}
                </button>
                <button
                  onClick={() => { setEditingReport(false); setReportText(job.report_text ?? ''); }}
                  className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:bg-accent transition-colors"
                >
                  {t('trade.jobs.cancelEdit')}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {job.report_text || <span className="italic">{t('trade.jobs.noReport')}</span>}
            </p>
          )}
        </section>
      )}

      {/* ── Photos section ───────────────────────────────────────────────── */}
      {job.can_create_job_reports && (
        <section className="rounded-xl border border-border bg-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Camera className="w-4 h-4" />
              {t('trade.photos.title')}
            </h2>
            {!isTerminal && (
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                {uploadingPhoto ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                {t('trade.photos.upload')}
              </button>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePhotoUpload(f);
                e.target.value = '';
              }}
            />
          </div>

          {/* Photo type tabs */}
          <div className="flex gap-1 mb-3 overflow-x-auto scrollbar-none">
            {PHOTO_TYPE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActivePhotoTab(tab.key)}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                  activePhotoTab === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {t(tab.labelKey as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>

          {/* Photo grid */}
          {(() => {
            const filtered = job.photos.filter((p) => p.photo_type === activePhotoTab);
            if (filtered.length === 0) {
              return (
                <div className="flex flex-col items-center py-6 gap-2">
                  <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">{t('trade.photos.empty')}</p>
                </div>
              );
            }
            return (
              <PhotoGrid photos={filtered} getUrl={getPhotoUrl} />
            );
          })()}
        </section>
      )}

      {/* ── Materials section ────────────────────────────────────────────── */}
      {job.can_add_materials && (
        <section className="rounded-xl border border-border bg-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Package className="w-4 h-4" />
              {t('trade.materials.title')}
            </h2>
            {!isTerminal && !showMaterialForm && (
              <button
                onClick={() => setShowMaterialForm(true)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                {t('trade.materials.add')}
              </button>
            )}
          </div>

          {showMaterialForm && (
            <form onSubmit={handleAddMaterial} className="flex flex-col gap-2 mb-3">
              <input
                type="text"
                required
                placeholder={t('trade.materials.namePh')}
                value={matForm.name}
                onChange={(e) => setMatForm((f) => ({ ...f, name: e.target.value }))}
                className="border border-border rounded-lg px-3 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  type="number" min="0" step="0.01"
                  placeholder={t('trade.materials.qty')}
                  value={matForm.quantity}
                  onChange={(e) => setMatForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="border border-border rounded-lg px-3 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="text"
                  placeholder={t('trade.materials.unit')}
                  value={matForm.unit}
                  onChange={(e) => setMatForm((f) => ({ ...f, unit: e.target.value }))}
                  className="border border-border rounded-lg px-3 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="number" min="0" step="0.01"
                  placeholder={t('trade.materials.salePrice')}
                  value={matForm.sale_price}
                  onChange={(e) => setMatForm((f) => ({ ...f, sale_price: e.target.value }))}
                  className="border border-border rounded-lg px-3 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-1.5">
                <button type="submit" disabled={savingMat}
                  className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
                  {savingMat ? '…' : t('trade.materials.save')}
                </button>
                <button type="button" onClick={() => setShowMaterialForm(false)}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground">
                  {t('trade.jobs.cancelEdit')}
                </button>
              </div>
            </form>
          )}

          {job.materials.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('trade.materials.empty')}</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {job.materials.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 text-foreground">{m.name}</span>
                  <span className="text-muted-foreground">
                    {m.quantity}{m.unit ? ` ${m.unit}` : ''}
                  </span>
                  {m.sale_price != null && (
                    <span className="text-muted-foreground font-medium">
                      {m.sale_price.toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </TradeWorkerLayout>
  );
}

// ─── Photo Grid helper ────────────────────────────────────────────────────────

function PhotoGrid({
  photos,
  getUrl,
}: {
  photos: { id: string; storage_path: string; caption: string | null }[];
  getUrl: (path: string) => Promise<string | null>;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    photos.forEach(async (p) => {
      if (urls[p.id]) return;
      const url = await getUrl(p.storage_path);
      if (url) setUrls((prev) => ({ ...prev, [p.id]: url }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {photos.map((p) =>
        urls[p.id] ? (
          <a key={p.id} href={urls[p.id]} target="_blank" rel="noopener noreferrer">
            <img
              src={urls[p.id]}
              alt={p.caption ?? ''}
              className="w-full aspect-square object-cover rounded-lg border border-border"
            />
          </a>
        ) : (
          <div
            key={p.id}
            className="w-full aspect-square rounded-lg border border-border bg-muted flex items-center justify-center"
          >
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ),
      )}
    </div>
  );
}
