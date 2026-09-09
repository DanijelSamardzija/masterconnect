'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Brain, Loader2, RefreshCw, MapPin, Clock, ExternalLink, Briefcase, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { timeAgo } from '@/lib/utils/date';

interface RankedPost {
  post_id:          string;
  job_title:        string | null;
  profession:       string | null;
  text_snippet:     string | null;
  post_type:        string;
  category:         string | null;
  city:             string | null;
  country:          string | null;
  min_price:        number | null;
  max_price:        number | null;
  currency:         string | null;
  experience_level: string | null;
  created_at:       string | null;
  owner_name:       string | null;
  total_score:      number;
  rank:             number;
  reason:           string;
}

interface MatchResult {
  ranked_posts:    RankedPost[];
  candidate_count: number;
  expires_at:      string;
  created_at:      string;
  cached?:         boolean;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; data: MatchResult }
  | { kind: 'rateLimit' }
  | { kind: 'error' };

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

interface AiReverseMatchPanelProps {
  open:    boolean;
  onClose: () => void;
}

export function AiReverseMatchPanel({ open, onClose }: AiReverseMatchPanelProps) {
  const { t, language } = useLanguage();
  const [state, setState] = useState<State>({ kind: 'idle' });

  const run = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const session = await getSession();
      if (!session) {
        setState({ kind: 'error' });
        return;
      }

      const res = await fetch('/api/ai-match/reverse', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ lang: language }),
      });

      if (res.status === 429) {
        setState({ kind: 'rateLimit' });
        return;
      }

      if (!res.ok) {
        setState({ kind: 'error' });
        return;
      }

      const data: MatchResult = await res.json();
      setState({ kind: 'success', data });
    } catch {
      setState({ kind: 'error' });
    }
  }, [language]);

  const refresh = useCallback(() => {
    run();
  }, [run]);

  function postTitle(p: RankedPost): string {
    return p.job_title ?? p.profession ?? p.post_type;
  }

  function priceText(p: RankedPost): string | null {
    if (p.min_price == null) return null;
    const max = p.max_price != null ? `–${p.max_price}` : '';
    return `${p.min_price}${max} ${p.currency ?? ''}`.trim();
  }

  function postTypeLabel(type: string): string {
    if (type === 'hiring_post') return t('aiMatch.reverse.hiring');
    if (type === 'service_request') return t('aiMatch.reverse.serviceRequest');
    return type;
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-background border border-border rounded-xl w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-sm font-semibold">{t('aiMatch.reverse.title')}</h2>
              <p className="text-xs text-muted-foreground">{t('aiMatch.reverse.subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {state.kind === 'idle' && (
            <div className="flex flex-col items-center justify-center gap-4 py-10">
              <Brain className="w-12 h-12 text-primary/40" />
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                {t('aiMatch.reverse.subtitle')}
              </p>
              <Button onClick={run} className="gap-2">
                <Brain className="w-4 h-4" />
                {t('aiMatch.reverse.find')}
              </Button>
            </div>
          )}

          {state.kind === 'loading' && (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t('aiMatch.reverse.finding')}</p>
            </div>
          )}

          {state.kind === 'error' && (
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="text-sm text-destructive">{t('aiMatch.reverse.error')}</p>
              <Button variant="outline" size="sm" onClick={run}>{t('aiMatch.reverse.find')}</Button>
            </div>
          )}

          {state.kind === 'rateLimit' && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Clock className="w-8 h-8 text-amber-400" />
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                {t('aiMatch.reverse.rateLimit')}
              </p>
            </div>
          )}

          {state.kind === 'success' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('aiMatch.reverse.candidateCount').replace('{count}', String(state.data.candidate_count))}</span>
                <button onClick={refresh} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  <RefreshCw className="w-3 h-3" />
                  {t('aiMatch.reverse.refresh')}
                </button>
              </div>

              {state.data.ranked_posts.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10">
                  <Briefcase className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground text-center">{t('aiMatch.reverse.noResults')}</p>
                </div>
              ) : (
                state.data.ranked_posts.map((post) => {
                  const price = priceText(post);
                  return (
                    <div key={post.post_id} className="border border-border rounded-lg p-4 space-y-2 bg-card hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              {post.post_type === 'hiring_post'
                                ? <Briefcase className="w-3 h-3 mr-1 inline" />
                                : <Wrench className="w-3 h-3 mr-1 inline" />}
                              {postTypeLabel(post.post_type)}
                            </Badge>
                            {post.category && (
                              <span className="text-[10px] text-muted-foreground">{post.category}</span>
                            )}
                          </div>
                          <p className="text-sm font-medium mt-1 truncate">{postTitle(post)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-semibold text-primary">
                            {t('aiMatch.reverse.score').replace('{score}', String(post.total_score))}
                          </div>
                          <div className="text-[10px] text-muted-foreground">#{post.rank}</div>
                        </div>
                      </div>

                      {post.text_snippet && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{post.text_snippet}</p>
                      )}

                      {post.reason && (
                        <p className="text-xs text-primary/80 italic">&ldquo;{post.reason}&rdquo;</p>
                      )}

                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        {(post.city || post.country) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {[post.city, post.country].filter(Boolean).join(', ')}
                          </span>
                        )}
                        {post.experience_level && (
                          <span>{t('aiMatch.reverse.experience').replace('{level}', post.experience_level)}</span>
                        )}
                        {price && (
                          <span>{t('aiMatch.reverse.budget').replace('{price}', price)}</span>
                        )}
                        {post.created_at && (
                          <span className="flex items-center gap-1 ml-auto">
                            <Clock className="w-3 h-3" />
                            {timeAgo(post.created_at)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        {post.owner_name && (
                          <span className="text-[10px] text-muted-foreground">{post.owner_name}</span>
                        )}
                        <Link
                          href={`/jobs/${post.post_id}`}
                          className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
                          onClick={onClose}
                        >
                          {t('aiMatch.reverse.seePost')}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer: cached indicator */}
        {state.kind === 'success' && (
          <div className="px-5 py-3 border-t border-border shrink-0">
            <p className="text-[10px] text-muted-foreground/70">
              {state.data.cached && state.data.created_at
                ? `${t('aiMatch.reverse.cachedResult')} · ${t('aiMatch.reverse.cachedAt').replace('{date}', fmtDate(state.data.created_at))}`
                : t('aiMatch.reverse.cachedResult')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
