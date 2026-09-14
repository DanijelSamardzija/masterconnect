'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';

type DeliverySettings = {
  offers_delivery: boolean;
  offers_pickup: boolean;
  delivery_fee: number;
  min_order_amount: number;
  estimated_prep_minutes: number;
  currency: string;
  is_accepting_orders: boolean;
};

const DEFAULT: DeliverySettings = {
  offers_delivery: false,
  offers_pickup: true,
  delivery_fee: 0,
  min_order_amount: 0,
  estimated_prep_minutes: 30,
  currency: 'BAM',
  is_accepting_orders: true,
};

function labelInput(label: string, children: React.ReactNode) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export function DeliverySettingsTab({ businessId }: { businessId: string }) {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<DeliverySettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('food_order_settings')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();
    if (data) setSettings(data);
    setLoading(false);
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    await (supabase as any)
      .from('food_order_settings')
      .upsert({ ...settings, business_id: businessId, updated_at: new Date().toISOString() });
    setSaving(false);
    toast.success(t('delivery.saved'));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  function toggle(field: keyof DeliverySettings) {
    setSettings((s) => ({ ...s, [field]: !s[field] }));
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-medium">{t('delivery.setup.title')}</p>
      </div>

      {/* Accept orders toggle */}
      <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-card">
        <div>
          <p className="text-sm font-medium">
            {settings.is_accepting_orders ? t('delivery.accepting') : t('delivery.not_accepting')}
          </p>
        </div>
        <button
          onClick={() => toggle('is_accepting_orders')}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.is_accepting_orders ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            settings.is_accepting_orders ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {/* Delivery / pickup toggles */}
      <div className="flex flex-col gap-2">
        {[
          { field: 'offers_pickup' as const, label: t('delivery.offers_pickup') },
          { field: 'offers_delivery' as const, label: t('delivery.offers_delivery') },
        ].map(({ field, label }) => (
          <div key={field} className="flex items-center justify-between p-3 border border-border rounded-xl bg-card">
            <span className="text-sm">{label}</span>
            <button
              onClick={() => toggle(field)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings[field] ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                settings[field] ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {settings.offers_delivery && labelInput(t('delivery.fee'),
          <input
            type="number"
            min="0"
            step="0.01"
            value={settings.delivery_fee}
            onChange={(e) => setSettings((s) => ({ ...s, delivery_fee: parseFloat(e.target.value) || 0 }))}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}
        {labelInput(t('delivery.min_order'),
          <input
            type="number"
            min="0"
            step="0.01"
            value={settings.min_order_amount}
            onChange={(e) => setSettings((s) => ({ ...s, min_order_amount: parseFloat(e.target.value) || 0 }))}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}
        {labelInput(t('delivery.prep_time'),
          <input
            type="number"
            min="5"
            step="5"
            value={settings.estimated_prep_minutes}
            onChange={(e) => setSettings((s) => ({ ...s, estimated_prep_minutes: parseInt(e.target.value) || 30 }))}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}
        {labelInput(t('acc.unit.currency'),
          <select
            value={settings.currency}
            onChange={(e) => setSettings((s) => ({ ...s, currency: e.target.value }))}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {['BAM', 'EUR', 'HRK', 'RSD', 'USD', 'GBP'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {saving ? '...' : t('delivery.save')}
      </button>
    </div>
  );
}
