'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';

interface BoostStatus {
  active_boost: { id: string; valid_until: string } | null;
  balance:      number;
  boost_cost:   number;
}

type State = 'loading' | 'idle' | 'active' | 'buying' | 'noCredits' | 'error';

export function AiBoostButton() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<BoostStatus | null>(null);
  const [state, setState]   = useState<State>('loading');

  const fetchStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setState('idle'); return; }

      const res = await fetch('/api/ai-match/boost', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) { setState('idle'); return; }

      const json: BoostStatus = await res.json();
      setStatus(json);
      setState(json.active_boost ? 'active' : 'idle');
    } catch {
      setState('idle');
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleBuy = useCallback(async () => {
    if (!status || status.balance < status.boost_cost) {
      setState('noCredits');
      return;
    }
    setState('buying');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setState('error'); return; }

      const res = await fetch('/api/ai-match/boost', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.status === 402) { setState('noCredits'); return; }
      if (res.status === 409) {
        // Already active — refresh
        await fetchStatus();
        return;
      }
      if (!res.ok) { setState('error'); return; }

      await fetchStatus();
    } catch {
      setState('error');
    }
  }, [status, fetchStatus]);

  if (state === 'loading') return null;

  const boostCost = status?.boost_cost ?? 30;

  if (state === 'active' && status?.active_boost) {
    const until = new Date(status.active_boost.valid_until).toLocaleDateString(undefined, {
      day: '2-digit', month: '2-digit',
    });
    return (
      <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-orange-300 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 text-xs font-medium">
        <Zap className="h-3.5 w-3.5 fill-orange-400 text-orange-400" />
        <span className="hidden sm:inline">
          {t('aiMatch.boost.active').replace('{date}', until)}
        </span>
        <span className="sm:hidden">{t('aiMatch.boost.title')}</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleBuy}
      disabled={state === 'buying'}
      title={t('aiMatch.boost.desc')}
      className="h-8 px-2.5 flex items-center gap-1.5 rounded-xl border border-border text-xs font-medium transition-colors text-muted-foreground hover:text-orange-500 hover:border-orange-300 disabled:opacity-60"
    >
      {state === 'buying' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Zap className="h-3.5 w-3.5" />
      )}
      <span className="hidden md:inline">
        {state === 'noCredits'
          ? t('aiMatch.boost.noCredits')
          : state === 'buying'
          ? t('aiMatch.boost.buying')
          : t('aiMatch.boost.buy').replace('{n}', String(boostCost))}
      </span>
    </button>
  );
}
