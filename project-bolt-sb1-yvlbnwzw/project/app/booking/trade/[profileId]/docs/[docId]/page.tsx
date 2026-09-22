'use client';

import { use, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeDashboardLayout } from '@/components/trade/TradeDashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, Plus, Trash2, Settings2, Check, X, Printer, Download,
} from 'lucide-react';
import { toCsv, downloadCsv } from '@/lib/utils/export-utils';

// ── Types ──────────────────────────────────────────────────────────────────

type DocType = 'table' | 'note' | 'list';
type ColType = 'text' | 'number' | 'date' | 'boolean';

type SchemaCol = {
  id:       string;
  name:     string;
  type:     ColType;
  required: boolean;
};

type TableRow = Record<string, string | number | boolean | null>;
type NoteRow  = { content: string };
type ListRow  = { text: string; checked: boolean };

type Doc = {
  id:          string;
  business_id: string;
  doc_type:    DocType;
  title:       string;
  description: string | null;
  schema:      SchemaCol[];
  rows:        TableRow[] | NoteRow[] | ListRow[];
  sort_order:  number;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function emptyRow(schema: SchemaCol[]): TableRow {
  const row: TableRow = { _id: makeId() };
  for (const col of schema) {
    row[col.id] = col.type === 'boolean' ? false : null;
  }
  return row;
}

// ── Main component ─────────────────────────────────────────────────────────

export default function DocEditorPage({
  params,
}: {
  params: Promise<{ profileId: string; docId: string }>;
}) {
  const { profileId, docId } = use(params);
  const { t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const { setActiveProfileId } = useBookingProfile();

  const [doc, setDoc]               = useState<Doc | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [showColEditor, setShowColEditor] = useState(false);
  const [dirty, setDirty]           = useState(false);

  useEffect(() => {
    setActiveProfileId(profileId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any).rpc('get_trade_custom_doc', { p_doc_id: docId });
    if (data?.ok) {
      setDoc(data.doc as Doc);
    } else {
      toast.error(data?.error ?? 'error');
    }
    setLoading(false);
  }, [docId, user]);

  useEffect(() => { load(); }, [load]);

  // ── Save helpers ──────────────────────────────────────────────────────────

  async function saveMeta(updates: Partial<Pick<Doc, 'title' | 'description' | 'schema'>>) {
    if (!doc) return;
    const next = { ...doc, ...updates };
    setDoc(next);
    setSaving(true);
    const { data } = await (supabase as any).rpc('upsert_trade_custom_doc', {
      p_business_id: doc.business_id,
      p_doc_id:      doc.id,
      p_title:       next.title,
      p_doc_type:    next.doc_type,
      p_description: next.description ?? null,
      p_schema:      next.schema,
      p_sort_order:  next.sort_order,
    });
    if (!data?.ok) toast.error(data?.error ?? 'error');
    setSaving(false);
    setDirty(false);
  }

  async function saveRows(rows: Doc['rows']) {
    if (!doc) return;
    setDoc({ ...doc, rows });
    setSaving(true);
    const { data } = await (supabase as any).rpc('save_doc_rows', {
      p_doc_id: doc.id,
      p_rows:   rows,
    });
    if (!data?.ok) toast.error(data?.error ?? 'error');
    else toast.success(t('trade.docs.saved'));
    setSaving(false);
    setDirty(false);
  }

  if (loading) {
    return (
      <TradeDashboardLayout profileId={profileId} active="docs">
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </TradeDashboardLayout>
    );
  }

  if (!doc) {
    return (
      <TradeDashboardLayout profileId={profileId} active="docs">
        <div className="flex flex-col items-center gap-3 py-20 text-sm text-muted-foreground">
          <p>Document not found.</p>
        </div>
      </TradeDashboardLayout>
    );
  }

  function exportTableCsv() {
    if (!doc || doc.doc_type !== 'table') return;
    const rows = doc.rows as TableRow[];
    const date = new Date().toISOString().slice(0, 10);
    const csv = toCsv(
      doc.schema.map(c => c.name),
      rows.map(row => doc.schema.map(c => {
        const v = row[c.id];
        return v === null || v === undefined ? '' : String(v);
      })),
    );
    downloadCsv(`${doc.title}-${date}.csv`, csv);
  }

  return (
    <TradeDashboardLayout profileId={profileId} active="docs">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => router.push(`/booking/trade/${profileId}/docs`)}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <TitleInput
            value={doc.title}
            onChange={v => { setDoc({ ...doc, title: v }); setDirty(true); }}
            onBlur={() => { if (dirty) saveMeta({ title: doc.title }); }}
            placeholder={t('trade.docs.editTitle')}
          />
        </div>
        <button
          onClick={() => window.print()}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors shrink-0"
          title={t('trade.export.print')}
        >
          <Printer className="w-4 h-4" />
        </button>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
      </div>

      {/* Body by type */}
      {doc.doc_type === 'note' && (
        <NoteEditor
          rows={doc.rows as NoteRow[]}
          onSave={saveRows}
          saving={saving}
          t={t}
        />
      )}
      {doc.doc_type === 'list' && (
        <ListEditor
          rows={doc.rows as ListRow[]}
          onSave={saveRows}
          saving={saving}
          t={t}
        />
      )}
      {doc.doc_type === 'table' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowColEditor(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" />
              {t('trade.docs.table.editColumns')}
            </button>
            <div className="flex items-center gap-3">
              {(doc.rows as TableRow[]).length > 0 && (
                <button
                  onClick={exportTableCsv}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  title={t('trade.export.csvDoc')}
                >
                  <Download className="w-3.5 h-3.5" />
                  {t('trade.export.csv')}
                </button>
              )}
              <button
                onClick={() => {
                  const rows = [...(doc.rows as TableRow[]), emptyRow(doc.schema)];
                  saveRows(rows);
                }}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('trade.docs.table.addRow')}
              </button>
            </div>
          </div>

          {showColEditor && (
            <ColumnEditor
              schema={doc.schema}
              onSave={schema => { saveMeta({ schema }); setShowColEditor(false); }}
              onClose={() => setShowColEditor(false)}
              t={t}
            />
          )}

          <TableEditor
            schema={doc.schema}
            rows={doc.rows as TableRow[]}
            onSave={saveRows}
            saving={saving}
            t={t}
          />
        </>
      )}
    </TradeDashboardLayout>
  );
}

// ── TitleInput ─────────────────────────────────────────────────────────────

function TitleInput({
  value, onChange, onBlur, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  placeholder: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className="w-full text-base font-semibold text-foreground bg-transparent border-none outline-none focus:ring-0 p-0"
    />
  );
}

// ── NoteEditor ─────────────────────────────────────────────────────────────

function NoteEditor({
  rows, onSave, saving, t,
}: {
  rows: NoteRow[];
  onSave: (r: NoteRow[]) => void;
  saving: boolean;
  t: (k: string) => string;
}) {
  const content = rows[0]?.content ?? '';
  const [val, setVal] = useState(content);

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder={t('trade.docs.note.placeholder')}
        rows={14}
        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
      />
      <button
        onClick={() => onSave([{ content: val }])}
        disabled={saving}
        className="py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {t('trade.docs.save')}
      </button>
    </div>
  );
}

// ── ListEditor ─────────────────────────────────────────────────────────────

function ListEditor({
  rows, onSave, saving, t,
}: {
  rows: ListRow[];
  onSave: (r: ListRow[]) => void;
  saving: boolean;
  t: (k: string) => string;
}) {
  const [items, setItems] = useState<ListRow[]>(rows);
  const [newText, setNewText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function toggle(i: number) {
    const next = items.map((it, idx) => idx === i ? { ...it, checked: !it.checked } : it);
    setItems(next);
    onSave(next);
  }

  function addItem() {
    if (!newText.trim()) return;
    const next = [...items, { text: newText.trim(), checked: false }];
    setItems(next);
    setNewText('');
    onSave(next);
    inputRef.current?.focus();
  }

  function removeItem(i: number) {
    const next = items.filter((_, idx) => idx !== i);
    setItems(next);
    onSave(next);
  }

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">{t('trade.docs.list.noItems')}</p>
      )}
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 group">
          <button
            onClick={() => toggle(i)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
              item.checked
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-border hover:border-primary'
            }`}
          >
            {item.checked && <Check className="w-3 h-3" />}
          </button>
          <span className={`flex-1 text-sm ${item.checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {item.text}
          </span>
          <button
            onClick={() => removeItem(i)}
            className="p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <div className="flex gap-2 mt-2">
        <input
          ref={inputRef}
          type="text"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
          placeholder={t('trade.docs.list.placeholder')}
          className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <button
          onClick={addItem}
          disabled={!newText.trim()}
          className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── ColumnEditor ───────────────────────────────────────────────────────────

function ColumnEditor({
  schema, onSave, onClose, t,
}: {
  schema: SchemaCol[];
  onSave: (s: SchemaCol[]) => void;
  onClose: () => void;
  t: (k: string) => string;
}) {
  const [cols, setCols] = useState<SchemaCol[]>(schema.map(c => ({ ...c })));

  const colTypes: { v: ColType; label: string }[] = [
    { v: 'text',    label: t('trade.docs.table.type.text') },
    { v: 'number',  label: t('trade.docs.table.type.number') },
    { v: 'date',    label: t('trade.docs.table.type.date') },
    { v: 'boolean', label: t('trade.docs.table.type.boolean') },
  ];

  function addCol() {
    setCols(c => [...c, { id: makeId(), name: '', type: 'text', required: false }]);
  }

  function updateCol(i: number, field: keyof SchemaCol, value: string | boolean) {
    setCols(c => c.map((col, idx) => idx === i ? { ...col, [field]: value } : col));
  }

  function removeCol(i: number) {
    setCols(c => c.filter((_, idx) => idx !== i));
  }

  return (
    <div className="mb-4 p-4 rounded-xl border border-border bg-card">
      <p className="text-sm font-semibold text-foreground mb-3">{t('trade.docs.table.columns')}</p>
      <div className="flex flex-col gap-2 mb-3">
        {cols.map((col, i) => (
          <div key={col.id} className="flex items-center gap-2">
            <input
              type="text"
              value={col.name}
              onChange={e => updateCol(i, 'name', e.target.value)}
              placeholder={t('trade.docs.table.col.name')}
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <select
              value={col.type}
              onChange={e => updateCol(i, 'type', e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {colTypes.map(ct => (
                <option key={ct.v} value={ct.v}>{ct.label}</option>
              ))}
            </select>
            <button
              onClick={() => removeCol(i)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={addCol}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('trade.docs.table.col.add')}
        </button>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors"
        >
          {t('block.cancel')}
        </button>
        <button
          onClick={() => onSave(cols.filter(c => c.name.trim()))}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          {t('trade.docs.save')}
        </button>
      </div>
    </div>
  );
}

// ── TableEditor ────────────────────────────────────────────────────────────

function TableEditor({
  schema, rows, onSave, saving, t,
}: {
  schema: SchemaCol[];
  rows: TableRow[];
  onSave: (r: TableRow[]) => void;
  saving: boolean;
  t: (k: string) => string;
}) {
  const [localRows, setLocalRows] = useState<TableRow[]>(rows);
  const dirty = useRef(false);

  useEffect(() => { setLocalRows(rows); }, [rows]);

  function updateCell(rowIdx: number, colId: string, value: string | number | boolean | null) {
    const next = localRows.map((r, i) => i === rowIdx ? { ...r, [colId]: value } : r);
    setLocalRows(next);
    dirty.current = true;
  }

  function removeRow(i: number) {
    const next = localRows.filter((_, idx) => idx !== i);
    setLocalRows(next);
    onSave(next);
    dirty.current = false;
  }

  if (schema.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        {t('trade.docs.table.noColumns')}
      </p>
    );
  }

  if (localRows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        {t('trade.docs.table.noRows')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Column headers */}
      <div
        className="grid gap-1.5 px-2 pb-1"
        style={{ gridTemplateColumns: `repeat(${schema.length}, 1fr) 32px` }}
      >
        {schema.map(col => (
          <span key={col.id} className="text-xs font-medium text-muted-foreground truncate">
            {col.name}
          </span>
        ))}
        <span />
      </div>

      {/* Rows */}
      {localRows.map((row, rowIdx) => (
        <div
          key={row._id as string ?? rowIdx}
          className="grid gap-1.5 p-2 rounded-xl border border-border bg-card group items-center"
          style={{ gridTemplateColumns: `repeat(${schema.length}, 1fr) 32px` }}
        >
          {schema.map(col => (
            <CellInput
              key={col.id}
              col={col}
              value={row[col.id] ?? null}
              onChange={v => updateCell(rowIdx, col.id, v)}
            />
          ))}
          <button
            onClick={() => removeRow(rowIdx)}
            className="p-1 rounded-lg text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all justify-self-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {/* Save button */}
      <button
        onClick={() => { onSave(localRows); dirty.current = false; }}
        disabled={saving}
        className="mt-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {t('trade.docs.save')}
      </button>
    </div>
  );
}

// ── CellInput ──────────────────────────────────────────────────────────────

function CellInput({
  col, value, onChange,
}: {
  col: SchemaCol;
  value: string | number | boolean | null;
  onChange: (v: string | number | boolean | null) => void;
}) {
  const base = 'w-full px-2 py-1 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary';

  if (col.type === 'boolean') {
    return (
      <button
        onClick={() => onChange(!value)}
        className={`w-8 h-5 rounded-full border-2 flex items-center ${value ? 'bg-primary border-primary' : 'bg-muted border-border'} transition-colors`}
      >
        <span className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-3' : 'translate-x-0.5'}`} />
      </button>
    );
  }

  if (col.type === 'date') {
    return (
      <input
        type="date"
        value={(value as string) ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className={base}
      />
    );
  }

  if (col.type === 'number') {
    return (
      <input
        type="number"
        value={(value as number) ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
        className={base}
      />
    );
  }

  return (
    <input
      type="text"
      value={(value as string) ?? ''}
      onChange={e => onChange(e.target.value || null)}
      className={base}
    />
  );
}
