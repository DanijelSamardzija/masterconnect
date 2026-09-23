'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { Plus, X, Pencil, Trash2, ChevronDown } from 'lucide-react';

type TradeService = {
  id: string;
  name: string;
  description: string | null;
  price_type: string;
  price_from: number | null;
  price_currency: string;
  is_active: boolean;
  sort_order: number;
};

const PRICE_TYPES = ['quote', 'hourly', 'fixed', 'project'] as const;

const CURRENCIES = [
  'EUR', 'USD', 'RSD', 'BAM',
  'GBP', 'CHF', 'MKD', 'ALL',
  'HUF', 'CZK', 'PLN', 'CAD',
  'AUD', 'NOK', 'SEK', 'DKK',
] as const;

function CurrencyPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary hover:border-primary/50 transition-colors"
      >
        <span className="font-medium text-foreground">{value}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-xl shadow-lg p-2">
          <div className="grid grid-cols-4 gap-1">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { onChange(c); setOpen(false); }}
                className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  value === c
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function labelInput(label: string, children: React.ReactNode) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export function TradeServicesTab({ businessId, hideTitle = false }: { businessId: string; hideTitle?: boolean }) {
  const { t } = useLanguage();
  const [services, setServices] = useState<TradeService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TradeService | null>(null);

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [priceType, setPriceType] = useState<string>('quote');
  const [priceFrom, setPriceFrom] = useState('');
  const [currency, setCurrency] = useState('BAM');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('tradesperson_services')
      .select('*')
      .eq('business_id', businessId)
      .order('sort_order');
    setServices(data ?? []);
    setLoading(false);
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setName(''); setDesc(''); setPriceType('quote'); setPriceFrom(''); setCurrency('BAM');
    setShowForm(true);
  }

  function openEdit(s: TradeService) {
    setEditing(s);
    setName(s.name);
    setDesc(s.description ?? '');
    setPriceType(s.price_type);
    setPriceFrom(s.price_from ? String(s.price_from) : '');
    setCurrency(s.price_currency);
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
      description: desc.trim() || null,
      price_type: priceType,
      price_from: priceFrom ? parseFloat(priceFrom) : null,
      price_currency: currency,
      sort_order: editing?.sort_order ?? services.length,
    };
    if (editing) {
      await (supabase as any).from('tradesperson_services').update(payload).eq('id', editing.id);
    } else {
      await (supabase as any).from('tradesperson_services').insert(payload);
    }
    setSaving(false);
    toast.success(t('trade.service.saved'));
    closeForm();
    load();
  }

  async function remove(id: string) {
    if (!confirm('Obrisati uslugu?')) return;
    setDeletingId(id);
    await (supabase as any).from('tradesperson_services').delete().eq('id', id);
    setDeletingId(null);
    load();
  }

  async function toggleActive(svc: TradeService) {
    await (supabase as any).from('tradesperson_services').update({ is_active: !svc.is_active }).eq('id', svc.id);
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
      {!hideTitle && (
        <div>
          <p className="text-sm font-medium">{t('trade.setup.title')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('trade.setup.desc')}</p>
        </div>
      )}

      {services.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground py-4 text-center">{t('trade.service.empty')}</p>
      )}

      {services.map((svc) => (
        <div
          key={svc.id}
          className={`border border-border rounded-xl p-3 flex items-start gap-3 bg-card ${!svc.is_active ? 'opacity-50' : ''}`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{svc.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground">
                {t(`trade.service.price_type.${svc.price_type}` as Parameters<typeof t>[0])}
              </span>
              {svc.price_from && (
                <span className="text-xs text-primary font-medium">od {svc.price_from} {svc.price_currency}</span>
              )}
            </div>
            {svc.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{svc.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => toggleActive(svc)}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                svc.is_active
                  ? 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
                  : 'border-border text-muted-foreground'
              }`}
            >
              {svc.is_active ? '✓' : '—'}
            </button>
            <button onClick={() => openEdit(svc)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => remove(svc.id)} disabled={deletingId === svc.id}
              className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {showForm && (
        <div className="border border-border rounded-xl p-4 flex flex-col gap-3 bg-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">{editing ? t('trade.service.save') : t('trade.service.add')}</span>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {labelInput(t('trade.service.name'),
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder={t('trade.service.namePh')}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
          )}

          {labelInput(t('trade.service.desc'),
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
          )}

          {labelInput(t('trade.service.price_type'),
            <div className="flex gap-1.5">
              {PRICE_TYPES.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => setPriceType(pt)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    priceType === pt
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground'
                  }`}
                >
                  {t(`trade.service.price_type.${pt}` as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {labelInput(t('trade.service.price_from'),
              <input type="number" min="0" step="0.01" value={priceFrom} onChange={(e) => setPriceFrom(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
            )}
            {labelInput(t('acc.unit.currency'),
              <CurrencyPicker value={currency} onChange={setCurrency} />
            )}
          </div>

          <button onClick={save} disabled={saving || !name.trim()}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 mt-1">
            {saving ? '...' : t('trade.service.save')}
          </button>
        </div>
      )}

      {!showForm && (
        <button
          onClick={openAdd}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('trade.service.add')}
        </button>
      )}
    </div>
  );
}
