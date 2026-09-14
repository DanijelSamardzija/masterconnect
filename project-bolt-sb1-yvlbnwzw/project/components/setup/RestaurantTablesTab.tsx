'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';

type TableRow = {
  id: string;
  name: string;
  capacity: number;
  location_tag: string | null;
  is_active: boolean;
  sort_order: number;
};

const LOCATION_TAGS = ['indoor', 'outdoor', 'terrace', 'bar'] as const;

function labelInput(label: string, children: React.ReactNode) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export function RestaurantTablesTab({ businessId }: { businessId: string }) {
  const { t } = useLanguage();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TableRow | null>(null);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [locationTag, setLocationTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('restaurant_tables')
      .select('id, name, capacity, location_tag, is_active, sort_order')
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true });
    setTables(data ?? []);
    setLoading(false);
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setName('');
    setCapacity('4');
    setLocationTag('');
    setShowForm(true);
  }

  function openEdit(row: TableRow) {
    setEditing(row);
    setName(row.name);
    setCapacity(String(row.capacity));
    setLocationTag(row.location_tag ?? '');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const payload = {
      business_id: businessId,
      name: name.trim(),
      capacity: parseInt(capacity) || 4,
      location_tag: locationTag || null,
      sort_order: editing?.sort_order ?? tables.length,
    };
    if (editing) {
      await (supabase as any).from('restaurant_tables').update(payload).eq('id', editing.id);
    } else {
      await (supabase as any).from('restaurant_tables').insert(payload);
    }
    setSaving(false);
    toast.success(t('restaurant.table.saved'));
    closeForm();
    load();
  }

  async function remove(id: string) {
    if (!confirm(t('restaurant.table.confirmDelete'))) return;
    setDeletingId(id);
    await (supabase as any).from('restaurant_tables').delete().eq('id', id);
    setDeletingId(null);
    toast.success(t('restaurant.table.deleted'));
    load();
  }

  async function toggleActive(row: TableRow) {
    await (supabase as any)
      .from('restaurant_tables')
      .update({ is_active: !row.is_active })
      .eq('id', row.id);
    load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium">{t('restaurant.setup.title')}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{t('restaurant.setup.desc')}</p>
      </div>

      {/* Table list */}
      {tables.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground py-4 text-center">{t('restaurant.setup.empty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tables.map((row) => (
            <div
              key={row.id}
              className={`border border-border rounded-xl p-3 flex items-center gap-3 bg-card ${!row.is_active ? 'opacity-50' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{row.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {row.capacity} {t('restaurant.reserve.persons')}
                  </span>
                  {row.location_tag && (
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground">
                      {t(`restaurant.table.location.${row.location_tag}` as Parameters<typeof t>[0])}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => toggleActive(row)}
                className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                  row.is_active
                    ? 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {row.is_active ? '✓' : '—'}
              </button>
              <button
                onClick={() => openEdit(row)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => remove(row.id)}
                disabled={deletingId === row.id}
                className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="border border-border rounded-xl p-4 flex flex-col gap-3 bg-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">
              {editing ? t('restaurant.table.save') : t('restaurant.setup.add')}
            </span>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {labelInput(t('restaurant.table.name'),
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('restaurant.table.namePh')}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            {labelInput(t('restaurant.table.capacity'),
              <input
                type="number"
                min="1"
                max="50"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
            {labelInput(t('restaurant.table.location'),
              <select
                value={locationTag}
                onChange={(e) => setLocationTag(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">—</option>
                {LOCATION_TAGS.map((lt) => (
                  <option key={lt} value={lt}>
                    {t(`restaurant.table.location.${lt}` as Parameters<typeof t>[0])}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 mt-1"
          >
            {saving ? '...' : t('restaurant.table.save')}
          </button>
        </div>
      )}

      {!showForm && (
        <button
          onClick={openAdd}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('restaurant.setup.add')}
        </button>
      )}
    </div>
  );
}
