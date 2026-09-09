'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Brain, Loader2, RefreshCw, Star, MapPin, Lock, ExternalLink, ThumbsDown, Coins } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';

const FREE_VISIBLE    = 2;
const UNLOCK_COST     = 50;
const REFRESH_COST    = 10;

interface RankedProfile {
  profile_id:     string;
  name:           string | null;
  city:           string | null;
  country:        string | null;
  average_rating: number | null;
  review_count:   number | null;
  skills:         Record<string, unknown> | null;
  is_premium:     boolean;
  total_score:    number;
  rank:           number;
  reason:         string;
}

interface MatchResult {
  ranked_profiles: RankedProfile[];
  candidate_count: number;
  expires_at:      string;
  created_at?:     string;
}

interface AiMatchModalProps {
  open:    boolean;
  onClose: () => void;
  postId:  string;
  isPro:   boolean;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; data: MatchResult; cached: boolean; isUnlocked: boolean }
  | { kind: 'rateLimit' }
  | { kind: 'error' };

type UnlockState = 'idle' | 'loading' | 'done' | 'noCredits' | 'error';

function skillsPreview(skills: Record<string, unknown> | null): string {
  if (!skills) return '';
  const vals = Object.values(skills);
  const labels = vals.filter((v) => typeof v === 'string' && (v as string).length > 0).slice(0, 3) as string[];
  return labels.join(', ');
}

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function AiMatchModal({ open, onClose, postId, isPro }: AiMatchModalProps) {
  const { t } = useLanguage();
  const [state, setState]               = useState<State>({ kind: 'idle' });
  const [unlockState, setUnlockState]   = useState<UnlockState>('idle');
  const [feedbackSent, setFeedbackSent] = useState<Set<string>>(new Set());
  const [balance, setBalance]           = useState<number | null>(null);
  const [runsLeft, setRunsLeft]         = useState<number | null>(null);
  const [refreshError, setRefreshError] = useState<'insufficient' | 'error' | null>(null);

  const fetchBalance = useCallback(async () => {
    const session = await getSession();
    if (!session) return;
    const { data } = await supabase
      .from('credits_balance')
      .select('balance')
      .eq('user_id', session.user.id)
      .maybeSingle();
    setBalance(data?.balance ?? null);
  }, []);

  const run = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      setState({ kind: 'loading' });
    }
    setRefreshError(null);
    try {
      const session = await getSession();
      if (!session) { setState({ kind: 'error' }); return; }

      const res = await fetch('/api/ai-match', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ post_id: postId, force_refresh: forceRefresh }),
      });

      if (res.status === 429) { setState({ kind: 'rateLimit' }); return; }
      if (res.status === 402) {
        if (forceRefresh) {
          // Keep existing results visible, show inline error near refresh button
          setRefreshError('insufficient');
          return;
        }
        setState({ kind: 'error' }); return;
      }
      if (!res.ok) {
        if (forceRefresh) { setRefreshError('error'); return; }
        setState({ kind: 'error' }); return;
      }

      const json = await res.json();
      if (!json.ok) { setState({ kind: 'error' }); return; }

      if (typeof json.runs_left === 'number') setRunsLeft(json.runs_left);

      setState({
        kind:       'success',
        data:       json.data as MatchResult,
        cached:     json.cached === true,
        isUnlocked: json.is_unlocked === true,
      });
    } catch {
      if (forceRefresh) { setRefreshError('error'); return; }
      setState({ kind: 'error' });
    }
  }, [postId]);

  useEffect(() => {
    if (open) {
      if (state.kind === 'idle') run(false);
      fetchBalance();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleUnlock = useCallback(async () => {
    setUnlockState('loading');
    try {
      const session = await getSession();
      if (!session) { setUnlockState('error'); return; }

      const res = await fetch('/api/ai-match/unlock', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ post_id: postId }),
      });

      if (res.status === 402) { setUnlockState('noCredits'); return; }
      if (!res.ok) { setUnlockState('error'); return; }

      setUnlockState('done');
      if (state.kind === 'success') {
        setState({ ...state, isUnlocked: true });
      }
      // Refresh balance after spending credits
      fetchBalance();
    } catch {
      setUnlockState('error');
    }
  }, [postId, state, fetchBalance]);

  const handleFeedback = useCallback(async (candidateProfileId: string) => {
    try {
      const session = await getSession();
      if (!session) return;

      await fetch('/api/ai-match/feedback', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          post_id:              postId,
          candidate_profile_id: candidateProfileId,
          feedback:             'negative',
        }),
      });

      setFeedbackSent((prev) => new Set(prev).add(candidateProfileId));
    } catch {
      // silent — feedback is best-effort
    }
  }, [postId]);

  const handleRefresh = useCallback(async () => {
    await run(true);
    // Refresh balance after potential credit spend
    fetchBalance();
  }, [run, fetchBalance]);

  const handleOpen = (isOpen: boolean) => {
    if (!isOpen) onClose();
  };

  const profiles    = state.kind === 'success' ? state.data.ranked_profiles : [];
  const cached      = state.kind === 'success' ? state.cached : false;
  const isUnlocked  = state.kind === 'success' ? state.isUnlocked : false;
  const cachedAt    = state.kind === 'success' ? (state.data.created_at ?? state.data.expires_at) : null;
  const canSeeAll   = isPro || isUnlocked || unlockState === 'done';

  const refreshLabel = isPro
    ? t('aiMatch.refreshCostFree')
    : t('aiMatch.refreshCost').replace('{n}', String(REFRESH_COST));

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Brain className="h-5 w-5 text-orange-500" />
            {t('aiMatch.modal.title')}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">{t('aiMatch.modal.subtitle')}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-2 mt-2 pr-0.5">

          {/* Loading */}
          {state.kind === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
              <span className="text-sm">{t('aiMatch.modal.loading')}</span>
            </div>
          )}

          {/* Rate limit */}
          {state.kind === 'rateLimit' && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-400/30 px-4 py-5 text-sm text-amber-700 dark:text-amber-300 text-center">
              {t('aiMatch.modal.rateLimit')}
            </div>
          )}

          {/* Error */}
          {state.kind === 'error' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-muted-foreground">{t('aiMatch.modal.error')}</p>
              <button
                onClick={() => run(false)}
                className="text-sm text-orange-500 hover:text-orange-600 font-medium"
              >
                {t('aiMatch.modal.refresh')}
              </button>
            </div>
          )}

          {/* No results */}
          {state.kind === 'success' && profiles.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t('aiMatch.modal.noResults')}
            </div>
          )}

          {/* Candidate cards */}
          {state.kind === 'success' && profiles.length > 0 && profiles.map((p, idx) => {
            const isLocked = !canSeeAll && idx >= FREE_VISIBLE;
            const preview  = skillsPreview(p.skills);
            const didDislike = feedbackSent.has(p.profile_id);

            return (
              <div
                key={p.profile_id}
                className={`relative rounded-xl border border-border bg-card transition-all ${isLocked ? 'overflow-hidden' : ''}`}
              >
                {/* Locked overlay — with unlock + PRO options */}
                {isLocked && (
                  <div className="absolute inset-0 z-10 backdrop-blur-sm bg-background/60 flex flex-col items-center justify-center gap-2 rounded-xl px-4">
                    <Lock className="h-5 w-5 text-orange-500" />
                    <p className="text-xs font-semibold text-foreground text-center">{t('aiMatch.modal.proTitle')}</p>
                    <p className="text-[11px] text-muted-foreground text-center leading-snug max-w-[220px]">
                      {t('aiMatch.modal.proDesc')}
                    </p>

                    {/* Unlock for credits button (only shown once, on first blurred card) */}
                    {idx === FREE_VISIBLE && (
                      <div className="flex flex-col items-center gap-1 w-full">
                        <button
                          onClick={handleUnlock}
                          disabled={unlockState === 'loading' || unlockState === 'noCredits'}
                          className="mt-1 rounded-lg border border-orange-400 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-xs font-semibold px-4 py-1.5 transition-all disabled:opacity-60 flex items-center gap-1.5"
                        >
                          {unlockState === 'loading' && <Loader2 className="h-3 w-3 animate-spin" />}
                          {unlockState === 'noCredits'
                            ? t('aiMatch.unlock.noCredits')
                            : t('aiMatch.unlock.button').replace('{n}', String(UNLOCK_COST))}
                        </button>
                        {balance !== null && (
                          <span className="text-[10px] text-muted-foreground">
                            {t('aiMatch.modal.balance').replace('{n}', String(balance))}
                          </span>
                        )}
                      </div>
                    )}

                    <Link
                      href="/pro"
                      onClick={onClose}
                      className="rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-semibold px-4 py-1.5 transition-all"
                    >
                      {t('aiMatch.modal.upgradeBtn')}
                    </Link>
                  </div>
                )}

                <div className={`px-3 py-3 ${isLocked ? 'select-none pointer-events-none' : ''}`}>
                  <div className="flex items-start gap-2">
                    {/* Rank badge */}
                    <div className="shrink-0 w-6 h-6 rounded-full bg-orange-500/10 border border-orange-400/30 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-orange-500">#{p.rank}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {(p.name && !p.name.includes('@')) ? p.name : t('aiMatch.modal.anonymousUser')}
                        </span>
                        {p.is_premium && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-orange-500 text-white rounded">
                            PRO
                          </span>
                        )}
                        <span className="ml-auto shrink-0 text-[11px] font-semibold text-orange-500">
                          {t('aiMatch.modal.score').replace('{score}', String(p.total_score))}
                        </span>
                      </div>

                      {(p.city || p.country) && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-[11px] text-muted-foreground truncate">
                            {[p.city, p.country].filter(Boolean).join(', ')}
                          </span>
                          {p.average_rating != null && (
                            <>
                              <span className="text-muted-foreground/40 mx-1">·</span>
                              <Star className="h-3 w-3 text-amber-400 shrink-0" />
                              <span className="text-[11px] text-muted-foreground">
                                {p.average_rating.toFixed(1)}
                                {p.review_count ? ` (${p.review_count})` : ''}
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      {preview && (
                        <p className="text-[11px] text-muted-foreground mt-1 truncate">{preview}</p>
                      )}

                      {p.reason && (
                        <p className="text-[11px] text-foreground/80 mt-1.5 leading-snug line-clamp-2">
                          {p.reason}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between">
                    {/* Thumbs down feedback */}
                    <button
                      onClick={() => handleFeedback(p.profile_id)}
                      disabled={didDislike}
                      title={t('aiMatch.feedback.dislike')}
                      className={`flex items-center gap-1 text-[11px] transition-colors ${
                        didDislike
                          ? 'text-orange-400 cursor-default'
                          : 'text-muted-foreground hover:text-orange-500'
                      }`}
                    >
                      <ThumbsDown className="h-3 w-3" />
                      {didDislike && <span>{t('aiMatch.feedback.sent')}</span>}
                    </button>

                    <Link
                      href={`/profile/${p.profile_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={onClose}
                      className="flex items-center gap-1 text-xs font-medium text-orange-500 hover:text-orange-600 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t('aiMatch.modal.viewProfile')}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer: cache info + balance + runs left + refresh */}
        {state.kind === 'success' && (
          <div className="pt-2 border-t border-border mt-1 shrink-0 space-y-1.5">
            {/* Cache / fresh info row */}
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-muted-foreground">
                {cached && cachedAt
                  ? `${t('aiMatch.modal.cachedResult')} · ${t('aiMatch.modal.cachedAt').replace('{date}', fmtDate(cachedAt))}`
                  : t('aiMatch.modal.freshResult')}
              </div>
              <div className="flex flex-col items-end gap-0.5">
                {refreshError === 'insufficient' && (
                  <span className="text-[10px] text-destructive">
                    {t('aiMatch.modal.refreshNoCredits')}
                  </span>
                )}
                {refreshError === 'error' && (
                  <span className="text-[10px] text-destructive">
                    {t('aiMatch.modal.error')}
                  </span>
                )}
                <button
                  onClick={handleRefresh}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  {refreshLabel}
                </button>
              </div>
            </div>

            {/* Balance + runs left row */}
            {(balance !== null || runsLeft !== null) && (
              <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                {balance !== null ? (
                  <span className="flex items-center gap-1">
                    <Coins className="h-3 w-3" />
                    {t('aiMatch.modal.balance').replace('{n}', String(balance))}
                  </span>
                ) : <span />}
                {runsLeft !== null && (
                  <span>{t('aiMatch.modal.runsLeft').replace('{n}', String(runsLeft))}</span>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
