'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeDashboardLayout } from '@/components/trade/TradeDashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { compressImage } from '@/lib/utils/compress-image';
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, Pencil, X, Check, Trash2,
  Plus, Package, Receipt, Camera, FileText,
  User, Clock, MapPin, AlertCircle, CheckCircle2,
  PauseCircle, XCircle, Circle, ChevronDown,
  Upload, Image as ImageIcon, Navigation,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type JobStatus   = 'pending' | 'confirmed' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
type JobPriority = 'low' | 'normal' | 'high' | 'urgent';
type PhotoType   = 'before' | 'during' | 'after' | 'document';
type ExpenseType = 'fuel' | 'tool' | 'subcontractor' | 'parking' | 'other';

type Material = {
  id: string; name: string; quantity: number; unit: string | null;
  sale_price: number | null; purchase_price: number | null;
  supplier: string | null; notes: string | null; added_by: string | null; created_at: string;
};

type Expense = {
  id: string; expense_type: ExpenseType; description: string;
  amount: number; receipt_path: string | null; added_by: string | null; created_at: string;
};

type Photo = {
  id: string; photo_type: PhotoType; storage_path: string;
  caption: string | null; uploaded_by: string | null; created_at: string;
};

type Job = {
  id: string; business_id: string; title: string; description: string | null;
  status: JobStatus; priority: JobPriority;
  origin_type: string; origin_id: string | null;
  client_id: string | null; client_name: string | null;
  asset_id: string | null; asset_name: string | null;
  assigned_to: string | null; assigned_name: string | null;
  scheduled_start: string | null; scheduled_end: string | null;
  actual_start: string | null; actual_end: string | null;
  eta_time: string | null; on_the_way_at: string | null;
  location: string | null; notes: string | null; report_text: string | null;
  is_invoiced: boolean | null; invoice_amount: number | null;
  total_labor_cost: number | null; total_materials_cost: number | null;
  total_expenses: number | null;
  cancelled_at: string | null; created_at: string; updated_at: string;
  can_view_purchase_prices: boolean;
  materials: Material[]; expenses: Expense[]; photos: Photo[];
};

// ─── Utilities ────────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<JobPriority, string> = {
  low:    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  normal: 'bg-blue-100  text-blue-700  dark:bg-blue-950  dark:text-blue-400',
  high:   'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  urgent: 'bg-red-100   text-red-700   dark:bg-red-950   dark:text-red-400',
};

const STATUS_COLOR: Record<JobStatus, string> = {
  pending:     'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  confirmed:   'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400',
  on_the_way:  'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  completed:   'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  cancelled:   'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
  on_hold:     'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
};

function StatusIcon({ status }: { status: JobStatus }) {
  switch (status) {
    case 'completed':   return <CheckCircle2 className="w-4 h-4" />;
    case 'in_progress': return <Clock className="w-4 h-4" />;
    case 'on_the_way':  return <Navigation className="w-4 h-4" />;
    case 'confirmed':   return <Circle className="w-4 h-4" />;
    case 'on_hold':     return <PauseCircle className="w-4 h-4" />;
    case 'cancelled':   return <XCircle className="w-4 h-4" />;
    default:            return <AlertCircle className="w-4 h-4" />;
  }
}

const inputCls = 'border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary w-full';

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Materials section ────────────────────────────────────────────────────────

function MaterialsSection({ job, canViewPurchasePrice, profileId, onReload }: { job: Job; canViewPurchasePrice: boolean; profileId: string; onReload: () => void }) {
  const { t } = useLanguage();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const emptyForm = { name: '', quantity: '1', unit: '', sale_price: '', purchase_price: '', supplier: '', notes: '' };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function startEdit(m: Material) {
    setForm({
      name:           m.name,
      quantity:       String(m.quantity),
      unit:           m.unit ?? '',
      sale_price:     m.sale_price != null ? String(m.sale_price) : '',
      purchase_price: m.purchase_price != null ? String(m.purchase_price) : '',
      supplier:       m.supplier ?? '',
      notes:          m.notes ?? '',
    });
    setEditing(m.id);
    setShowAdd(false);
  }

  async function save(materialId?: string) {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data } = await (supabase as any).rpc('upsert_trade_material', {
      p_job_id:         job.id,
      p_name:           form.name.trim(),
      p_quantity:       parseFloat(form.quantity) || 1,
      p_unit:           form.unit.trim()           || null,
      p_sale_price:     form.sale_price            ? parseFloat(form.sale_price)     : null,
      p_purchase_price: form.purchase_price        ? parseFloat(form.purchase_price) : null,
      p_supplier:       form.supplier.trim()       || null,
      p_notes:          form.notes.trim()          || null,
      p_material_id:    materialId ?? null,
    });
    setSaving(false);
    if (!data?.ok) { toast.error(data?.error ?? 'error'); return; }
    toast.success(t('trade.materials.saved'));
    setShowAdd(false); setEditing(null); setForm(emptyForm);
    onReload();
  }

  async function deleteMaterial(id: string) {
    const { data } = await (supabase as any).rpc('delete_trade_material', { p_material_id: id });
    if (!data?.ok) { toast.error(data?.error ?? 'error'); return; }
    toast.success(t('trade.materials.deleted'));
    onReload();
  }

  const FormFields = (
    <div className="flex flex-col gap-2 mt-2">
      <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        placeholder={t('trade.materials.name')} className={inputCls} />
      <div className="grid grid-cols-3 gap-2">
        <input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
          placeholder={t('trade.materials.qty')} className={inputCls} />
        <input type="text" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
          placeholder={t('trade.materials.unit')} className={inputCls} />
        <input type="number" value={form.sale_price} onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))}
          placeholder={t('trade.materials.salePrice')} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {canViewPurchasePrice && (
          <input type="number" value={form.purchase_price} onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))}
            placeholder={t('trade.materials.purchasePrice')} className={inputCls} />
        )}
        <input type="text" value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
          placeholder={t('trade.materials.supplier')} className={`${inputCls} ${canViewPurchasePrice ? '' : 'col-span-2'}`} />
      </div>
      <div className="flex gap-2">
        <button onClick={() => { setShowAdd(false); setEditing(null); setForm(emptyForm); }}
          className="flex-1 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors">
          {t('common.cancel')}
        </button>
        <button onClick={() => save(editing ?? undefined)} disabled={saving || !form.name.trim()}
          className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1 transition-colors hover:bg-primary/90">
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          {t('common.save')}
        </button>
      </div>
    </div>
  );

  return (
    <Section title={t('trade.materials.title')} icon={<Package className="w-4 h-4" />}>
      {job.materials.length === 0 && !showAdd && (
        <p className="text-sm text-muted-foreground mb-3">{t('trade.materials.empty')}</p>
      )}
      <div className="flex flex-col gap-2">
        {job.materials.map((m) => (
          <div key={m.id} className="border border-border rounded-xl p-3">
            {editing === m.id ? FormFields : (
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{m.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {m.quantity}{m.unit ? ` ${m.unit}` : ''}
                    {m.sale_price != null ? ` · ${m.sale_price}` : ''}
                    {canViewPurchasePrice && m.purchase_price != null ? ` (${t('trade.materials.purchasePrice')}: ${m.purchase_price})` : ''}
                    {m.supplier ? ` · ${m.supplier}` : ''}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(m)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteMaterial(m.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {showAdd && FormFields}
      </div>
      {!showAdd && !editing && (
        <button onClick={() => { setShowAdd(true); setEditing(null); setForm(emptyForm); }}
          className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-full justify-center">
          <Plus className="w-3.5 h-3.5" /> {t('trade.materials.add')}
        </button>
      )}
    </Section>
  );
}

// ─── Expenses section ─────────────────────────────────────────────────────────

const EXPENSE_TYPES: ExpenseType[] = ['fuel', 'tool', 'subcontractor', 'parking', 'other'];

function ExpensesSection({ job, profileId, onReload }: { job: Job; profileId: string; onReload: () => void }) {
  const { t } = useLanguage();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const emptyForm = { description: '', expense_type: 'other' as ExpenseType, amount: '' };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function startEdit(e: Expense) {
    setForm({ description: e.description, expense_type: e.expense_type, amount: String(e.amount) });
    setEditing(e.id); setShowAdd(false);
  }

  async function save(expenseId?: string) {
    if (!form.description.trim() || !form.amount) return;
    setSaving(true);
    const { data } = await (supabase as any).rpc('upsert_trade_expense', {
      p_job_id:       job.id,
      p_description:  form.description.trim(),
      p_expense_type: form.expense_type,
      p_amount:       parseFloat(form.amount),
      p_expense_id:   expenseId ?? null,
    });
    setSaving(false);
    if (!data?.ok) { toast.error(data?.error ?? 'error'); return; }
    toast.success(t('trade.expenses.saved'));
    setShowAdd(false); setEditing(null); setForm(emptyForm);
    onReload();
  }

  async function deleteExpense(id: string) {
    const { data } = await (supabase as any).rpc('delete_trade_expense', { p_expense_id: id });
    if (!data?.ok) { toast.error(data?.error ?? 'error'); return; }
    toast.success(t('trade.expenses.deleted'));
    onReload();
  }

  const total = job.expenses.reduce((sum, e) => sum + e.amount, 0);

  const FormFields = (
    <div className="flex flex-col gap-2 mt-2">
      <input type="text" value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        placeholder={t('trade.expenses.description')} className={inputCls} />
      <div className="grid grid-cols-2 gap-2">
        <select value={form.expense_type}
          onChange={(e) => setForm((f) => ({ ...f, expense_type: e.target.value as ExpenseType }))}
          className={inputCls}>
          {EXPENSE_TYPES.map((et) => (
            <option key={et} value={et}>{t(`trade.expenses.type_${et}` as any)}</option>
          ))}
        </select>
        <input type="number" value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          placeholder={t('trade.expenses.amount')} className={inputCls} min="0" step="0.01" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => { setShowAdd(false); setEditing(null); setForm(emptyForm); }}
          className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-colors">
          {t('common.cancel')}
        </button>
        <button onClick={() => save(editing ?? undefined)} disabled={saving || !form.description.trim() || !form.amount}
          className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1 transition-colors hover:bg-primary/90">
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          {t('common.save')}
        </button>
      </div>
    </div>
  );

  return (
    <Section title={t('trade.expenses.title')} icon={<Receipt className="w-4 h-4" />}>
      {job.expenses.length === 0 && !showAdd && (
        <p className="text-sm text-muted-foreground mb-3">{t('trade.expenses.empty')}</p>
      )}
      <div className="flex flex-col gap-2">
        {job.expenses.map((e) => (
          <div key={e.id} className="border border-border rounded-xl p-3">
            {editing === e.id ? FormFields : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{e.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`trade.expenses.type_${e.expense_type}` as any)} · {e.amount.toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(e)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteExpense(e.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {showAdd && FormFields}
      </div>
      {job.expenses.length > 0 && (
        <p className="text-xs font-semibold text-foreground mt-2 text-right">
          {t('trade.expenses.total')}: {total.toFixed(2)}
        </p>
      )}
      {!showAdd && !editing && (
        <button onClick={() => { setShowAdd(true); setEditing(null); setForm(emptyForm); }}
          className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-full justify-center">
          <Plus className="w-3.5 h-3.5" /> {t('trade.expenses.add')}
        </button>
      )}
    </Section>
  );
}

// ─── Photos section ───────────────────────────────────────────────────────────

const PHOTO_TYPES: PhotoType[] = ['before', 'during', 'after', 'document'];

function PhotosSection({ job, profileId, onReload }: { job: Job; profileId: string; onReload: () => void }) {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<PhotoType>('during');
  const [caption, setCaption] = useState('');
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  // Get signed URLs for private bucket photos
  useEffect(() => {
    if (job.photos.length === 0) return;
    (async () => {
      const urls: Record<string, string> = {};
      await Promise.all(
        job.photos.map(async (ph) => {
          const { data } = await supabase.storage
            .from('trade-photos')
            .createSignedUrl(ph.storage_path, 3600);
          if (data?.signedUrl) urls[ph.id] = data.signedUrl;
        })
      );
      setPhotoUrls(urls);
    })();
  }, [job.photos]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      // Compress photos; documents keep original
      const toUpload = selectedType === 'document'
        ? file
        : await compressImage(file, 1920, 0.85);

      const ext      = file.name.split('.').pop() ?? 'jpg';
      const filename = `${Date.now()}.${ext}`;
      const path     = `${job.business_id}/${job.id}/${selectedType}/${filename}`;

      const { error: upErr } = await supabase.storage
        .from('trade-photos')
        .upload(path, toUpload, { upsert: false });

      if (upErr) { toast.error(upErr.message); setUploading(false); return; }

      const { data } = await (supabase as any).rpc('add_trade_photo', {
        p_job_id:       job.id,
        p_storage_path: path,
        p_photo_type:   selectedType,
        p_caption:      caption.trim() || null,
      });

      if (!data?.ok) {
        // Clean up orphaned upload if RPC fails
        await supabase.storage.from('trade-photos').remove([path]);
        toast.error(data?.error ?? 'error');
      } else {
        toast.success(t('trade.photos.uploaded'));
        setCaption('');
        onReload();
      }
    } catch {
      toast.error(t('trade.photos.uploadError'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function deletePhoto(ph: Photo) {
    const { data } = await (supabase as any).rpc('delete_trade_photo', { p_photo_id: ph.id });
    if (!data?.ok) { toast.error(data?.error ?? 'error'); return; }
    // Remove from storage
    await supabase.storage.from('trade-photos').remove([ph.storage_path]);
    toast.success(t('trade.photos.deleted'));
    onReload();
  }

  return (
    <Section title={t('trade.photos.title')} icon={<Camera className="w-4 h-4" />}>
      {/* Type selector + caption + upload */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {PHOTO_TYPES.map((pt) => (
            <button key={pt} onClick={() => setSelectedType(pt)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedType === pt
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}>
              {t(`trade.photos.type_${pt}` as any)}
            </button>
          ))}
        </div>
        <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)}
          placeholder={t('trade.photos.captionPh')} className={inputCls} />
        <input ref={fileRef} type="file" accept="image/*,application/pdf"
          className="hidden" onChange={handleFileSelect} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? t('trade.photos.uploading') : t('trade.photos.upload')}
        </button>
      </div>

      {/* Photo grid */}
      {job.photos.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('trade.photos.empty')}</p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {job.photos.map((ph) => (
          <div key={ph.id} className="relative aspect-square rounded-xl overflow-hidden bg-muted group">
            {photoUrls[ph.id] ? (
              <img src={photoUrls[ph.id]} alt={ph.caption ?? ''} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <button onClick={() => deletePhoto(ph)}
                className="p-1.5 rounded-lg bg-destructive/90 text-white">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-black/50">
              <p className="text-[10px] text-white truncate">
                {t(`trade.photos.type_${ph.photo_type}` as any)}
                {ph.caption ? ` · ${ph.caption}` : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── Report section ───────────────────────────────────────────────────────────

function ReportSection({ job, onReload }: { job: Job; onReload: () => void }) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(job.report_text ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { data } = await (supabase as any).rpc('update_trade_job', {
      p_job_id:     job.id,
      p_report_text: text.trim() || null,
    });
    setSaving(false);
    if (!data?.ok) { toast.error(data?.error ?? 'error'); return; }
    setEditing(false);
    onReload();
  }

  return (
    <Section title={t('trade.jobs.reportTitle')} icon={<FileText className="w-4 h-4" />}>
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)}
            rows={5} className={`${inputCls} resize-none`}
            placeholder={t('trade.jobs.reportPh')} />
          <div className="flex gap-2">
            <button onClick={() => { setEditing(false); setText(job.report_text ?? ''); }}
              className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-colors">
              {t('common.cancel')}
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1 transition-colors hover:bg-primary/90">
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              {t('common.save')}
            </button>
          </div>
        </div>
      ) : (
        <div>
          {job.report_text ? (
            <p className="text-sm text-foreground whitespace-pre-wrap">{job.report_text}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t('trade.jobs.reportEmpty')}</p>
          )}
          <button onClick={() => setEditing(true)}
            className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:underline">
            <Pencil className="w-3 h-3" />
            {job.report_text ? t('common.edit') : t('trade.jobs.reportAdd')}
          </button>
        </div>
      )}
    </Section>
  );
}

// ─── Status change panel ──────────────────────────────────────────────────────

const NEXT_STATUSES: Record<JobStatus, JobStatus[]> = {
  pending:     ['confirmed', 'on_the_way', 'cancelled'],
  confirmed:   ['on_the_way', 'in_progress', 'on_hold', 'cancelled'],
  on_the_way:  ['in_progress', 'cancelled'],
  in_progress: ['completed', 'on_hold', 'cancelled'],
  on_hold:     ['confirmed', 'in_progress', 'cancelled'],
  completed:   [],
  cancelled:   [],
};

function StatusPanel({ job, onReload }: { job: Job; onReload: () => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const nextStatuses = NEXT_STATUSES[job.status];

  async function changeStatus(newStatus: JobStatus) {
    if (newStatus === 'cancelled') {
      const { data } = await (supabase as any).rpc('cancel_trade_job', { p_job_id: job.id });
      if (!data?.ok) { toast.error(data?.error ?? 'error'); return; }
    } else {
      const { data } = await (supabase as any).rpc('update_trade_job_status', {
        p_job_id: job.id, p_status: newStatus,
      });
      if (!data?.ok) { toast.error(data?.error ?? 'error'); return; }
    }
    setOpen(false);
    onReload();
  }

  if (nextStatuses.length === 0) return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:bg-accent hover:text-foreground transition-colors">
        <ChevronDown className="w-3.5 h-3.5" />
        {t('trade.jobs.changeStatus')}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[160px]">
          {nextStatuses.map((s) => (
            <button key={s} onClick={() => changeStatus(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2">
              <StatusIcon status={s} />
              {t(`trade.jobs.status_${s}` as any)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TradeJobDetailPage() {
  const { profileId, jobId } = useParams() as { profileId: string; jobId: string };
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { setActiveProfileId } = useBookingProfile();

  const [job, setJob]       = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [etaValue, setEtaValue] = useState('');
  const [savingEta, setSavingEta] = useState(false);

  useEffect(() => {
    if (!user || !profileId) return;
    setActiveProfileId(profileId);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileId, jobId]);

  async function handleSaveEta() {
    if (!etaValue || !job) return;
    setSavingEta(true);
    const { data } = await (supabase as any).rpc('update_trade_job_eta', {
      p_job_id: job.id, p_eta_time: etaValue,
    });
    setSavingEta(false);
    if (!data?.ok) { toast.error(data?.error ?? 'error'); return; }
    toast.success(t('trade.worker.etaUpdated'));
    load();
  }

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any).rpc('get_trade_job', { p_job_id: jobId });
    if (!data?.ok) {
      setNotFound(true);
    } else {
      const d = data as any;
      setJob({
        ...d.job,
        can_view_purchase_prices: d.can_view_purchase_prices ?? true,
      } as Job);
    }
    setLoading(false);
  }

  if (loading) return (
    <TradeDashboardLayout profileId={profileId} active="jobs">
      <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
    </TradeDashboardLayout>
  );

  if (notFound || !job) return (
    <TradeDashboardLayout profileId={profileId} active="jobs">
      <button onClick={() => router.push(`/booking/trade/${profileId}/jobs`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> {t('common.back')}
      </button>
      <p className="text-sm text-muted-foreground">{t('trade.jobs.notFound')}</p>
    </TradeDashboardLayout>
  );

  const scheduledLabel = job.scheduled_start
    ? new Date(job.scheduled_start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <TradeDashboardLayout profileId={profileId} active="jobs">
      {/* Back */}
      <button onClick={() => router.push(`/booking/trade/${profileId}/jobs`)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t('common.back')}
      </button>

      {/* Header card */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-foreground leading-snug">{job.title}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[job.status]}`}>
                <StatusIcon status={job.status} />
                {t(`trade.jobs.status_${job.status}` as any)}
              </span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${PRIORITY_COLOR[job.priority]}`}>
                {t(`trade.jobs.priority${job.priority.charAt(0).toUpperCase()}${job.priority.slice(1)}` as any)}
              </span>
            </div>
          </div>
          <StatusPanel job={job} onReload={load} />
        </div>

        {job.description && (
          <p className="text-sm text-muted-foreground mt-2">{job.description}</p>
        )}

        {/* Meta */}
        <div className="mt-3 flex flex-col gap-1.5">
          {job.client_name && (
            <div className="flex items-center gap-2 text-sm">
              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <button
                onClick={() => job.client_id && router.push(`/booking/trade/${profileId}/clients/${job.client_id}`)}
                className="text-primary hover:underline"
              >
                {job.client_name}
              </button>
            </div>
          )}
          {scheduledLabel && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-foreground">{scheduledLabel}</span>
            </div>
          )}
          {job.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-foreground">{job.location}</span>
            </div>
          )}
          {job.assigned_name && (
            <div className="flex items-center gap-2 text-sm">
              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">{t('trade.jobs.assignedTo')}: </span>
              <span className="text-foreground">{job.assigned_name}</span>
            </div>
          )}
          {job.status === 'on_the_way' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-sm">
                <Navigation className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <span className="text-purple-700 dark:text-purple-400 font-medium">
                  {t('trade.jobs.status_on_the_way')}
                  {job.eta_time && ` · ${t('trade.worker.etaTime')} ${job.eta_time}`}
                </span>
              </div>
              <div className="flex items-center gap-2 pl-5">
                <input
                  type="time"
                  value={etaValue}
                  onChange={(e) => setEtaValue(e.target.value)}
                  className="border border-border rounded-lg px-2 py-1 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary w-32"
                />
                <button
                  onClick={handleSaveEta}
                  disabled={savingEta || !etaValue}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600 text-white text-xs font-medium disabled:opacity-50 hover:bg-purple-700 transition-colors"
                >
                  {savingEta ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  {t('trade.worker.etaSave')}
                </button>
              </div>
            </div>
          )}
          {job.notes && (
            <p className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded-lg px-2 py-1.5">{job.notes}</p>
          )}
        </div>

        {/* Financial summary (only shown if data returned) */}
        {(job.total_materials_cost != null || job.invoice_amount != null) && (
          <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2">
            {job.total_materials_cost != null && (
              <div>
                <p className="text-[10px] text-muted-foreground">{t('trade.jobs.totalMaterials')}</p>
                <p className="text-sm font-semibold text-foreground">{job.total_materials_cost.toFixed(2)}</p>
              </div>
            )}
            {job.total_expenses != null && (
              <div>
                <p className="text-[10px] text-muted-foreground">{t('trade.jobs.totalExpenses')}</p>
                <p className="text-sm font-semibold text-foreground">{job.total_expenses.toFixed(2)}</p>
              </div>
            )}
            {job.invoice_amount != null && (
              <div>
                <p className="text-[10px] text-muted-foreground">{t('trade.jobs.invoiceAmount')}</p>
                <p className="text-sm font-semibold text-foreground">{job.invoice_amount.toFixed(2)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-4">
        <MaterialsSection job={job} canViewPurchasePrice={job.can_view_purchase_prices} profileId={profileId} onReload={load} />
        <ExpensesSection  job={job} profileId={profileId} onReload={load} />
        <PhotosSection    job={job} profileId={profileId} onReload={load} />
        <ReportSection    job={job} onReload={load} />
      </div>
    </TradeDashboardLayout>
  );
}
