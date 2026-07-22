'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Coins, X, Star, Sparkles, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';

interface SupportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId?: string;
  targetUserName?: string;
  targetIsCreatorPremium?: boolean;
}

const AMOUNTS = [5, 10, 20] as const;
const PLATFORM_FEE = 0.15;

export function SupportModal({
  open,
  onOpenChange,
  targetUserId,
  targetUserName,
  targetIsCreatorPremium,
}: SupportModalProps) {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [selected, setSelected] = useState<number>(10);
  const [customInput, setCustomInput] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<'idle' | 'success' | 'error' | 'no_balance'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  const effectiveAmount = isCustom ? (parseInt(customInput) || 0) : selected;

  useEffect(() => {
    if (!open || !user) return;
    setState('idle');
    setSelected(10);
    setCustomInput('');
    setIsCustom(false);
    setAnonymous(false);
    fetchBalance();
  }, [open, user]);

  const fetchBalance = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('credits_balance')
      .select('balance')
      .eq('user_id', user.id)
      .single();
    setBalance(data?.balance ?? 0);
  };

  const fee = effectiveAmount > 0 ? Math.max(1, Math.round(effectiveAmount * PLATFORM_FEE)) : 0;
  const net = effectiveAmount - fee;

  const handleSend = async () => {
    if (!user || !targetUserId || loading || effectiveAmount < 1) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('send_credits', {
        p_sender_id: user.id,
        p_receiver_id: targetUserId,
        p_amount: effectiveAmount,
        p_anonymous: anonymous,
      });

      if (error) throw error;

      const result = data as { ok?: boolean; error?: string } | null;
      if (result?.ok) {
        setBalance(prev => (prev !== null ? prev - selected : prev));
        setState('success');
      } else {
        if (result?.error === 'insufficient_balance') {
          setState('no_balance');
        } else {
          setErrorMsg(result?.error || 'Greška');
          setState('error');
        }
      }
    } catch {
      setState('error');
      setErrorMsg('Greška pri slanju kredita.');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    // Not logged in
    if (!user) {
      return (
        <div className="p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">{t('credits.support.loginRequired')}</p>
          <button onClick={() => onOpenChange(false)} className="w-full rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 text-sm transition-all">
            {t('credits.support.close')}
          </button>
        </div>
      );
    }

    // Receiver not Creator Premium
    if (targetUserId && targetIsCreatorPremium === false) {
      return (
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
            <Star className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t('credits.support.notCreatorPremium')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('credits.support.notCreatorPremiumDesc')}</p>
            </div>
          </div>
          <button onClick={() => onOpenChange(false)} className="w-full rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold py-2.5 text-sm transition-all">
            {t('credits.support.close')}
          </button>
        </div>
      );
    }

    // Success
    if (state === 'success') {
      return (
        <div className="p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </div>
          <div>
            <p className="font-bold text-lg text-foreground">{t('credits.support.successTitle')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('credits.support.successDesc')
                .replace('{name}', targetUserName || '')
                .replace('{net}', String(net))}
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between"><span>{t('credits.support.sent')}</span><span className="font-semibold text-foreground">{selected} {t('credits.unit')}</span></div>
            <div className="flex justify-between"><span>{t('credits.support.platformFee')}</span><span>-{fee} {t('credits.unit')}</span></div>
            <div className="flex justify-between border-t border-border pt-1 mt-1"><span>{t('credits.support.received')}</span><span className="font-semibold text-green-500">{net} {t('credits.unit')}</span></div>
          </div>
          <button onClick={() => onOpenChange(false)} className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-2.5 text-sm transition-all shadow-md">
            {t('credits.support.close')}
          </button>
        </div>
      );
    }

    // No balance
    if (state === 'no_balance') {
      return (
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t('credits.support.noBalanceTitle')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('credits.support.noBalanceDesc')}</p>
            </div>
          </div>
          <p className="text-xs text-center text-muted-foreground">{t('credits.support.demoNote')}</p>
          <button onClick={() => onOpenChange(false)} className="w-full rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold py-2.5 text-sm transition-all">
            {t('credits.support.close')}
          </button>
        </div>
      );
    }

    // Error
    if (state === 'error') {
      return (
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">{errorMsg || t('credits.support.error')}</p>
          </div>
          <button onClick={() => setState('idle')} className="w-full rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold py-2.5 text-sm transition-all">
            {t('credits.support.tryAgain')}
          </button>
        </div>
      );
    }

    // Idle — main send UI
    return (
      <div className="p-6 space-y-5">
        {/* Balance */}
        <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-muted-foreground">{t('credits.support.yourBalance')}</span>
          </div>
          <span className="font-bold text-foreground">
            {balance !== null ? `${balance} ${t('credits.unit')}` : '—'}
          </span>
        </div>

        {/* Amount selector */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t('credits.support.chooseAmount')}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {AMOUNTS.map(amount => (
              <button
                key={amount}
                onClick={() => { setSelected(amount); setIsCustom(false); setCustomInput(''); }}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 py-3 px-2 transition-all ${
                  !isCustom && selected === amount
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'border-border bg-muted/30 hover:border-orange-300'
                }`}
              >
                {amount === 10 && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {t('credits.support.popular')}
                  </span>
                )}
                <Coins className={`h-4 w-4 mb-1 ${!isCustom && selected === amount ? 'text-orange-500' : 'text-muted-foreground'}`} />
                <span className={`text-base font-bold ${!isCustom && selected === amount ? 'text-orange-500' : 'text-foreground'}`}>{amount}</span>
                <span className="text-[10px] text-muted-foreground">{t('credits.unit')}</span>
              </button>
            ))}
            {/* Custom amount */}
            <div
              onClick={() => setIsCustom(true)}
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 py-3 px-2 transition-all cursor-text ${
                isCustom
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-border bg-muted/30 hover:border-orange-300'
              }`}
            >
              <Coins className={`h-4 w-4 mb-1 ${isCustom ? 'text-orange-500' : 'text-muted-foreground'}`} />
              <input
                type="number"
                min={1}
                max={balance ?? 9999}
                value={customInput}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => { setIsCustom(true); setCustomInput(e.target.value.replace(/\D/g, '')); }}
                placeholder="?"
                className={`w-full text-center text-base font-bold bg-transparent outline-none leading-none ${isCustom && customInput ? 'text-orange-500' : 'text-foreground'} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
              />
              <span className="text-[10px] text-muted-foreground">{t('credits.unit')}</span>
            </div>
          </div>
        </div>

        {/* Fee breakdown */}
        <div className="rounded-xl bg-muted/30 px-4 py-3 space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>{t('credits.support.platformFee')} (15%)</span>
            <span>-{fee} {t('credits.unit')}</span>
          </div>
          <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1 mt-1">
            <span>{targetUserName || t('credits.support.receiver')} {t('credits.support.gets')}</span>
            <span className="text-green-500">+{net} {t('credits.unit')}</span>
          </div>
        </div>

        {/* Demo badge */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 text-amber-400" />
          <span>{t('credits.support.demoNote')}</span>
        </div>

        {/* Anonymous toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <button
            type="button"
            role="switch"
            aria-checked={anonymous}
            onClick={() => setAnonymous(v => !v)}
            className={`relative w-9 h-5 rounded-full transition-colors ${anonymous ? 'bg-orange-500' : 'bg-muted-foreground/30'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${anonymous ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
          <span className="text-xs text-muted-foreground">Doniraj anonimno</span>
        </label>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={loading || balance === null || balance < effectiveAmount || effectiveAmount < 1}
          className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>🧡 {t('credits.support.sendButton').replace('{amount}', String(effectiveAmount))}</>
          )}
        </button>

        {balance !== null && effectiveAmount > 0 && balance < effectiveAmount && (
          <p className="text-center text-xs text-red-500">{t('credits.support.insufficientBalance')}</p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden border-0 shadow-2xl">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 p-5 text-white">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Zatvori"
            className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors z-10"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg">
              <Coins className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-orange-100 uppercase tracking-widest">
                {t('credits.support.demo')}
              </p>
              <DialogTitle className="text-lg font-bold leading-tight text-white">
                🧡 {t('credits.support.title')}
              </DialogTitle>
              {targetUserName && (
                <p className="text-xs text-orange-100 mt-0.5 truncate max-w-[200px]">{targetUserName}</p>
              )}
            </div>
          </div>
        </div>

        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
