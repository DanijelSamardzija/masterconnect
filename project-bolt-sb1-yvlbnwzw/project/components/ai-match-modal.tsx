'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Brain, Loader2, RefreshCw, Star, MapPin, Lock, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';

interface RankedProfile {
  profile_id: string;
  name: string | null;
  city: string | null;
  country: string | null;
  average_rating: number | null;
  review_count: number | null;
  skills: Record<string, unknown> | null;
  is_premium: boolean;
  total_score: number;
  rank: number;
  reason: string;
}

interface MatchResult {
  ranked_profiles: RankedProfile[];
  candidate_count: number;
  expires_at: string;
  created_at?: string;
}

interface AiMatchModalProps {
  open: boolean;
  onClose: () => void;
  postId: string;
  isPro: boolean;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; data: MatchResult; cached: boolean }
  | { kind: 'rateLimit' }
  | { kind: 'error' };

const FREE_VISIBLE = 2;

function skillsPreview(skills: Record<string, unknown> | null): string {
  if (!skills) return '';
  const vals = Object.values(skills);
  const labels = vals.filter((v) => typeof v === 'string' && v.length > 0).slice(0, 3) as string[];
  return labels.join(', ');
}

export function AiMatchModal({ open, onClose, postId, isPro }: AiMatchModalProps) {
  const { t } = useLanguage();
  const [state, setState] = useState<State>({ kind: 'idle' });

  const run = useCallback(async (forceRefresh = false) => {
    setState({ kind: 'loading' });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setState({ kind: 'error' }); return; }

      const res = await fetch('/api/ai-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ post_id: postId, force_refresh: forceRefresh }),
      });

      if (res.status === 429) { setState({ kind: 'rateLimit' }); return; }
      if (!res.ok) { setState({ kind: 'error' }); return; }

      const json = await res.json();
      if (!json.ok) { setState({ kind: 'error' }); return; }

      setState({ kind: 'success', data: json.data as MatchResult, cached: json.cached === true });
    } catch {
      setState({ kind: 'error' });
    }
  }, [postId]);

  useEffect(() => {
    if (open && state.kind === 'idle') run(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleOpen = (isOpen: boolean) => {
    if (!isOpen) onClose();
  };

  const profiles = state.kind === 'success' ? state.data.ranked_profiles : [];
  const cached = state.kind === 'success' ? state.cached : false;
  const cachedAt = state.kind === 'success' ? (state.data.created_at ?? state.data.expires_at) : null;

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
            const isLocked = !isPro && idx >= FREE_VISIBLE;
            const preview = skillsPreview(p.skills);

            return (
              <div
                key={p.profile_id}
                className={`relative rounded-xl border border-border bg-card transition-all ${isLocked ? 'overflow-hidden' : ''}`}
              >
                {isLocked && (
                  <div className="absolute inset-0 z-10 backdrop-blur-sm bg-background/60 flex flex-col items-center justify-center gap-2 rounded-xl px-4">
                    <Lock className="h-5 w-5 text-orange-500" />
                    <p className="text-xs font-semibold text-foreground text-center">{t('aiMatch.modal.proTitle')}</p>
                    <p className="text-[11px] text-muted-foreground text-center leading-snug max-w-[220px]">
                      {t('aiMatch.modal.proDesc')}
                    </p>
                    <Link
                      href="/pro"
                      onClick={onClose}
                      className="mt-1 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-semibold px-4 py-1.5 transition-all"
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

                  <div className="mt-2.5 flex justify-end">
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

        {/* Footer: cache info + refresh */}
        {state.kind === 'success' && (
          <div className="flex items-center justify-between pt-2 border-t border-border mt-1 shrink-0">
            <div className="text-[11px] text-muted-foreground">
              {cached && cachedAt
                ? `${t('aiMatch.modal.cachedResult')} · ${t('aiMatch.modal.cachedAt').replace('{date}', new Date(cachedAt).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }))}`
                : t('aiMatch.modal.cachedResult')}
            </div>
            <button
              onClick={() => run(true)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              {t('aiMatch.modal.refresh')}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
