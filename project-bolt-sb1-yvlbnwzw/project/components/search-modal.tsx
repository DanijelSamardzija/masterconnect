'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { Search, X, MapPin, Star, CheckCircle, Loader2 } from 'lucide-react';

type Profile = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  country: string | null;
  account_type: string;
  is_premium: boolean;
  average_rating: number | null;
  review_count: number | null;
  avatar_url: string | null;
};

type SearchModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SearchModal({ open, onClose }: SearchModalProps) {
  const router = useRouter();
  const { t } = useLanguage();

  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Auto-focus / reset on open toggle
  useEffect(() => {
    if (open) {
      // Delay one tick so the element is visible before focus
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    } else {
      setInput('');
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Debounce raw input → query (350 ms)
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), 350);
    return () => clearTimeout(timer);
  }, [input]);

  // Run search on debounced query
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }
    doSearch(query.trim());
  }, [query]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Click outside closes
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const doSearch = async (term: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('search_profiles', {
        p_search: term,
        p_limit: 8,
      });
      if (error) throw error;
      setResults((data ?? []) as Profile[]);
    } catch (err) {
      console.error('[ProfileSearch]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (id: string) => {
    onCloseRef.current();
    router.push(`/profile/${id}`);
  };

  const clearInput = () => {
    setInput('');
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  if (!open) return null;

  return (
    /* Fixed overlay — appears directly below the sticky nav (top-16 = 64px) */
    <div className="fixed inset-x-0 top-16 z-50 px-4 pt-2">
      <div ref={containerRef} className="container mx-auto max-w-2xl">
        <div className="bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">

          {/* Search input row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={t('search.placeholder')}
              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground text-sm"
            />
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
            )}
            {input && !loading && (
              <button
                onClick={clearInput}
                className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                aria-label="Obriši pretragu"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[420px] overflow-y-auto">

            {/* Hint — before user types enough */}
            {query.length < 2 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {t('search.hint')}
              </div>
            )}

            {/* No results */}
            {query.length >= 2 && !loading && results.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {t('search.profileNoResults')}
              </div>
            )}

            {/* Results list */}
            {results.length > 0 && (
              <ul className="py-2">
                {results.map(profile => (
                  <li key={profile.id}>
                    <button
                      onClick={() => handleSelect(profile.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left"
                    >
                      {/* Avatar */}
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.name} />
                        <AvatarFallback className="bg-orange-100 text-orange-700 text-sm font-bold">
                          {profile.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {/* Name + PRO badge */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-foreground truncate">
                            {profile.name}
                          </span>
                          {profile.is_premium && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[10px] font-bold shrink-0">
                              <CheckCircle className="h-2.5 w-2.5" />
                              PRO
                            </span>
                          )}
                        </div>

                        {/* Profession + Location + Rating */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          {profile.category && (
                            <span>{profile.category}</span>
                          )}
                          {(profile.city || profile.country) && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {[profile.city, profile.country].filter(Boolean).join(', ')}
                            </span>
                          )}
                          {profile.average_rating != null && profile.average_rating > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0" />
                              {profile.average_rating.toFixed(1)}
                              {profile.review_count != null && profile.review_count > 0 && (
                                <span className="opacity-60">({profile.review_count})</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Account type chip */}
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                        {profile.account_type === 'professional'
                          ? t('search.professional')
                          : t('search.customer')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
