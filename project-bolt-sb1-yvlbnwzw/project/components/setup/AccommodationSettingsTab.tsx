'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';

type AccSettings = {
  check_in_time: string;
  check_out_time: string;
  min_nights: number;
  max_nights: number | null;
  cancellation_hours: number;
  breakfast_included: boolean;
};

const DEFAULT: AccSettings = {
  check_in_time: '14:00',
  check_out_time: '11:00',
  min_nights: 1,
  max_nights: null,
  cancellation_hours: 48,
  breakfast_included: false,
};

function labelInput(label: string, children: React.ReactNode) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export function AccommodationSettingsTab({ businessId }: { businessId: string }) {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<AccSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('accommodation_settings')
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
      .from('accommodation_settings')
      .upsert({ ...settings, business_id: businessId, updated_at: new Date().toISOString() });
    setSaving(false);
    toast.success(t('acc.settings.save'));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        {labelInput(t('acc.settings.checkin'),
          <input
            type="time"
            value={settings.check_in_time}
            onChange={(e) => setSettings((s) => ({ ...s, check_in_time: e.target.value }))}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}
        {labelInput(t('acc.settings.checkout'),
          <input
            type="time"
            value={settings.check_out_time}
            onChange={(e) => setSettings((s) => ({ ...s, check_out_time: e.target.value }))}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}
        {labelInput(t('acc.settings.min_nights'),
          <input
            type="number"
            min="1"
            value={settings.min_nights}
            onChange={(e) => setSettings((s) => ({ ...s, min_nights: parseInt(e.target.value) || 1 }))}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}
        {labelInput(t('acc.settings.max_nights'),
          <input
            type="number"
            min="1"
            value={settings.max_nights ?? ''}
            placeholder="∞"
            onChange={(e) => setSettings((s) => ({ ...s, max_nights: e.target.value ? parseInt(e.target.value) : null }))}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}
        {labelInput(t('acc.settings.cancel_hours'),
          <input
            type="number"
            min="0"
            value={settings.cancellation_hours}
            onChange={(e) => setSettings((s) => ({ ...s, cancellation_hours: parseInt(e.target.value) || 0 }))}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}
      </div>

      {/* Breakfast toggle */}
      <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-card">
        <span className="text-sm">{t('acc.settings.breakfast')}</span>
        <button
          onClick={() => setSettings((s) => ({ ...s, breakfast_included: !s.breakfast_included }))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.breakfast_included ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            settings.breakfast_included ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {saving ? '...' : t('acc.settings.save')}
      </button>
    </div>
  );
}
