'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Zap, Loader2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/contexts/language-context';

const FEED_PACKAGES = [
  { days: 3, cost: 75 },
  { days: 7, cost: 150 },
  { days: 30, cost: 450 },
] as const;

const LISTING_PACKAGES = [
  { days: 7, cost: 140 },
  { days: 14, cost: 260 },
  { days: 30, cost: 600 },
] as const;

interface BoostModalProps {
  open: boolean;
  onClose: () => void;
  postId: string;
  isListing: boolean;
  currentPromotedUntil?: string | null;
  userId: string;
  balance: number;
  onSuccess: (newPromotedUntil: string) => void;
}

export function BoostModal({
  open, onClose, postId, isListing, currentPromotedUntil, userId, balance, onSuccess,
}: BoostModalProps) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);

  const packages = (isListing ? [...LISTING_PACKAGES] : [...FEED_PACKAGES]) as { days: number; cost: number }[];

  const getNewExpiry = (days: number) => {
    const now = new Date();
    const cur = currentPromotedUntil ? new Date(currentPromotedUntil) : null;
    const base = cur && cur > now ? cur : now;
    return new Date(base.getTime() + days * 86400000);
  };

  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });

  const pkg = packages[selected] ?? packages[0];
  const canAfford = balance >= pkg.cost;
  const boostActive = !!(currentPromotedUntil && new Date(currentPromotedUntil) > new Date());

  const handleConfirm = async () => {
    if (!canAfford || loading) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('boost_post', {
        p_user_id: userId,
        p_post_id: postId,
        p_days: pkg.days,
      });
      if (error || !data?.ok) {
        const err = data?.error || error?.message;
        if (err === 'insufficient_balance') {
          toast.error(
            t('credits.boost.insufficient')
              .replace('{cost}', String(data?.cost ?? pkg.cost))
              .replace('{balance}', String(data?.balance ?? balance))
          );
        } else {
          toast.error(t('credits.boost.error'));
        }
      } else {
        const dateStr = data.promoted_until ? fmt(new Date(data.promoted_until)) : '';
        toast.success(t('credits.boost.successDate').replace('{date}', dateStr));
        onSuccess(data.promoted_until);
        onClose();
      }
    } catch {
      toast.error(t('credits.boost.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Zap className="h-5 w-5 text-orange-500" />
            {t('credits.boost.modal.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          {boostActive && (
            <div className="rounded-xl bg-orange-500/10 border border-orange-400/30 px-3 py-2 text-xs text-orange-700 dark:text-orange-300">
              <span className="font-semibold">🚀 {t('credits.boost.modal.currentlyActive')}</span>{' '}
              {t('credits.boost.activeUntil').replace('{date}', fmt(new Date(currentPromotedUntil!)))}
            </div>
          )}

          <div className="space-y-2">
            {packages.map((p, i) => {
              const newExpiry = getNewExpiry(p.days);
              const affordable = balance >= p.cost;
              return (
                <button
                  key={p.days}
                  onClick={() => setSelected(i)}
                  disabled={!affordable}
                  aria-pressed={selected === i}
                  className={`w-full rounded-xl border-2 px-4 py-3 text-left transition-all disabled:opacity-40 ${
                    selected === i
                      ? 'border-orange-400 bg-orange-500/8'
                      : 'border-border hover:border-orange-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {t('credits.boost.modal.days').replace('{n}', String(p.days))}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {boostActive
                          ? t('credits.boost.modal.expiresAfterExtend').replace('{date}', fmt(newExpiry))
                          : t('credits.boost.modal.expiresOn').replace('{date}', fmt(newExpiry))
                        }
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-orange-500">{p.cost} {t('credits.unit')}</span>
                      {selected === i && <Check className="h-4 w-4 text-orange-500" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-muted-foreground">{t('credits.boost.modal.balance')}</span>
            <span className={`font-semibold ${canAfford ? 'text-foreground' : 'text-red-500'}`}>
              {balance} {t('credits.unit')}
            </span>
          </div>

          {!canAfford && (
            <p className="text-xs text-red-500 text-center">
              {t('credits.boost.modal.insufficient')} ({pkg.cost - balance} {t('credits.unit')} {t('credits.boost.modal.needed')})
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {t('credits.boost.modal.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || !canAfford}
              className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-40 text-white py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {t('credits.boost.modal.confirm')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
