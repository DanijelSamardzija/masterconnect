'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { cn } from '@/lib/utils';

type LiveStatus = 'available_now' | 'available_today' | 'by_schedule' | 'unavailable';

interface LiveStatusToggleProps {
  businessId: string;
  initialStatus: LiveStatus;
}

const STATUS_ORDER: LiveStatus[] = [
  'available_now',
  'available_today',
  'by_schedule',
  'unavailable',
];

const STATUS_STYLES: Record<LiveStatus, string> = {
  available_now:   'bg-green-500 text-white hover:bg-green-600',
  available_today: 'bg-blue-500 text-white hover:bg-blue-600',
  by_schedule:     'bg-gray-400 text-white hover:bg-gray-500',
  unavailable:     'bg-red-500 text-white hover:bg-red-600',
};

export function LiveStatusToggle({ businessId, initialStatus }: LiveStatusToggleProps) {
  const { t } = useLanguage();
  const [current, setCurrent] = useState<LiveStatus>(initialStatus);
  const [saving, setSaving]   = useState(false);
  const [flash, setFlash]     = useState<'ok' | 'err' | null>(null);

  const statusLabel = (s: LiveStatus) => {
    const key = `live.status.${s}` as const;
    return t(key as Parameters<typeof t>[0]);
  };

  async function handleSelect(next: LiveStatus) {
    if (next === current || saving) return;
    setSaving(true);
    setFlash(null);
    const { data } = await (supabase as any).rpc('set_business_live_status', {
      p_business_id: businessId,
      p_status:      next,
    });
    setSaving(false);
    if (data?.ok) {
      setCurrent(next);
      setFlash('ok');
    } else {
      setFlash('err');
    }
    setTimeout(() => setFlash(null), 2500);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{t('live.toggle.label')}</p>
      <p className="text-xs text-muted-foreground">{t('live.toggle.hint')}</p>
      <div className="flex flex-wrap gap-2 mt-1">
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => handleSelect(s)}
            disabled={saving}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
              s === current
                ? STATUS_STYLES[s]
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
              saving && 'opacity-60 cursor-not-allowed',
            )}
          >
            {statusLabel(s)}
            {s === current && saving && ' …'}
          </button>
        ))}
      </div>
      {flash === 'ok' && (
        <p className="text-xs text-green-600 dark:text-green-400">{t('live.toggle.success')}</p>
      )}
      {flash === 'err' && (
        <p className="text-xs text-destructive">{t('live.toggle.error')}</p>
      )}
    </div>
  );
}
