'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeDashboardLayout } from '@/components/trade/TradeDashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  FileText, List, Table2, Plus, Loader2, AlertCircle,
  ChevronRight, Trash2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

type DocType = 'table' | 'note' | 'list';

type DocMeta = {
  id: string;
  doc_type: DocType;
  title: string;
  description: string | null;
  schema: SchemaCol[];
  row_count: number;
  sort_order: number;
  updated_at: string;
};

type SchemaCol = { name: string; type: 'text' | 'number' | 'date' | 'boolean'; required?: boolean };

// ── Component ──────────────────────────────────────────────────────────────

export default function TradeDocsPage() {
  const { profileId } = useParams() as { profileId: string };
  const { t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const { setActiveProfileId } = useBookingProfile();

  const [docs, setDocs]         = useState<DocMeta[]>([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showNew, setShowNew]   = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType]   = useState<DocType>('table');
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    setActiveProfileId(profileId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const load = useCallback(async () => {
    if (!user || !profileId) return;
    setLoading(true);
    const { data } = await (supabase as any).rpc('list_trade_custom_docs', { p_business_id: profileId });
    if (data?.ok) setDocs(data.docs ?? []);
    setLoading(false);
  }, [profileId, user]);

  useEffect(() => { load(); }, [load]);

  async function createDoc() {
    if (!newTitle.trim()) return;
    setSaving(true);
    const { data } = await (supabase as any).rpc('upsert_trade_custom_doc', {
      p_business_id: profileId,
      p_title:       newTitle.trim(),
      p_doc_type:    newType,
    });
    if (data?.ok) {
      setShowNew(false);
      setNewTitle('');
      setNewType('table');
      router.push(`/booking/trade/${profileId}/docs/${data.doc_id}`);
    } else {
      toast.error(data?.error ?? 'error');
    }
    setSaving(false);
  }

  async function deleteDoc(id: string) {
    if (!confirm(t('trade.docs.deleteConfirm'))) return;
    setDeleting(id);
    const { data } = await (supabase as any).rpc('delete_trade_custom_doc', { p_doc_id: id });
    if (data?.ok) {
      toast.success(t('trade.docs.deleteSuccess'));
      setDocs(d => d.filter(x => x.id !== id));
    } else {
      toast.error(data?.error ?? 'error');
    }
    setDeleting(null);
  }

  function docIcon(type: DocType) {
    if (type === 'table') return <Table2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    if (type === 'note')  return <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
    return <List className="w-5 h-5 text-green-600 dark:text-green-400" />;
  }

  function docIconBg(type: DocType) {
    if (type === 'table') return 'bg-blue-100 dark:bg-blue-950';
    if (type === 'note')  return 'bg-amber-100 dark:bg-amber-950';
    return 'bg-green-100 dark:bg-green-950';
  }

  function rowLabel(doc: DocMeta) {
    if (doc.doc_type === 'list') return `${doc.row_count} ${t('trade.docs.items')}`;
    if (doc.doc_type === 'table') return `${doc.row_count} ${t('trade.docs.rows')}`;
    return null;
  }

  const types: { key: DocType; label: string }[] = [
    { key: 'table', label: t('trade.docs.type.table') },
    { key: 'note',  label: t('trade.docs.type.note') },
    { key: 'list',  label: t('trade.docs.type.list') },
  ];

  return (
    <TradeDashboardLayout profileId={profileId} active="docs">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-foreground">{t('trade.dashboard.docs.title')}</h1>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('trade.docs.newDoc')}
        </button>
      </div>

      {/* New doc form */}
      {showNew && (
        <div className="mb-4 p-4 rounded-xl border border-border bg-card flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">{t('trade.docs.newDoc')}</p>
          <div className="flex flex-wrap gap-2">
            {types.map(tp => (
              <button
                key={tp.key}
                onClick={() => setNewType(tp.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  newType === tp.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {tp.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createDoc(); if (e.key === 'Escape') setShowNew(false); }}
            placeholder={t('trade.docs.editTitle')}
            autoFocus
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={createDoc}
              disabled={!newTitle.trim() || saving}
              className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('trade.docs.save')}
            </button>
            <button
              onClick={() => { setShowNew(false); setNewTitle(''); }}
              className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && docs.length === 0 && (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-yellow-100 dark:bg-yellow-950 flex items-center justify-center">
            <FileText className="w-7 h-7 text-yellow-600 dark:text-yellow-400" />
          </div>
          <p className="text-sm text-muted-foreground">{t('trade.docs.noDocsYet')}</p>
        </div>
      )}

      {!loading && docs.length > 0 && (
        <div className="flex flex-col gap-2">
          {docs.map(doc => (
            <div
              key={doc.id}
              className="group p-3.5 rounded-xl border border-border bg-card flex items-center gap-3 hover:border-primary/40 transition-colors"
            >
              {/* Icon */}
              <div className={`p-2 rounded-xl ${docIconBg(doc.doc_type)} shrink-0`}>
                {docIcon(doc.doc_type)}
              </div>

              {/* Info — clickable area */}
              <button
                className="flex-1 min-w-0 text-left"
                onClick={() => router.push(`/booking/trade/${profileId}/docs/${doc.id}`)}
              >
                <p className="text-sm font-medium text-foreground truncate">
                  {doc.title || t('trade.docs.untitled')}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {t(`trade.docs.type.${doc.doc_type}` as any)}
                  </span>
                  {rowLabel(doc) && (
                    <>
                      <span className="text-xs text-border">·</span>
                      <span className="text-xs text-muted-foreground">{rowLabel(doc)}</span>
                    </>
                  )}
                </div>
              </button>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => deleteDoc(doc.id)}
                  disabled={deleting === doc.id}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                  {deleting === doc.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                </button>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      )}
    </TradeDashboardLayout>
  );
}
