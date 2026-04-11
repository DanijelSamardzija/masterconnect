'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { Search, User, Briefcase, Wrench, Loader2 } from 'lucide-react';

type SearchResult = {
  id: string;
  type: 'professional' | 'service' | 'job';
  title: string;
  subtitle: string;
  avatar?: string;
  path: string;
};

type SearchModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SearchModal({ open, onClose }: SearchModalProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(query.trim()), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const doSearch = async (q: string) => {
    setLoading(true);
    try {
      const [prosRes, servicesRes, jobsRes] = await Promise.all([
        supabase.from('profiles').select('id, name, category, avatar_url, account_type')
          .ilike('name', `%${q}%`)
          .limit(4),
        supabase.from('posts').select('id, title, city, profiles(name)')
          .eq('post_type', 'service_listing')
          .ilike('title', `%${q}%`)
          .limit(4),
        supabase.from('jobs').select('id, title, city, category')
          .ilike('title', `%${q}%`)
          .eq('status', 'open')
          .limit(3),
      ]);

      const all: SearchResult[] = [];

      (prosRes.data || []).forEach((p: any) => {
        all.push({
          id: p.id,
          type: 'professional',
          title: p.name,
          subtitle: p.category || (p.account_type === 'customer' ? t('search.customer') : t('search.professional')),
          avatar: p.avatar_url,
          path: `/profile/${p.id}`,
        });
      });

      (servicesRes.data || []).forEach((s: any) => {
        all.push({
          id: s.id,
          type: 'service',
          title: s.title,
          subtitle: `${(s.profiles as any)?.name || ''} · ${s.city || ''}`.replace(/^ · | · $/, ''),
          path: `/services/${s.id}`,
        });
      });

      (jobsRes.data || []).forEach((j: any) => {
        all.push({
          id: j.id,
          type: 'job',
          title: j.title,
          subtitle: `${j.category || ''} · ${j.city || ''}`.replace(/^ · | · $/, ''),
          path: `/jobs/${j.id}`,
        });
      });

      setResults(all);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    onClose();
    router.push(result.path);
  };

  const iconFor = (type: SearchResult['type']) => {
    if (type === 'professional') return <User className="h-4 w-4 text-orange-500" />;
    if (type === 'service') return <Wrench className="h-4 w-4 text-blue-500" />;
    return <Briefcase className="h-4 w-4 text-green-500" />;
  };

  const labelFor = (type: SearchResult['type']) => {
    if (type === 'professional') return t('search.professional');
    if (type === 'service') return t('search.service');
    return t('search.job');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground text-sm"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto">
          {query.length >= 2 && results.length === 0 && !loading && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t('search.noResults')}
            </div>
          )}

          {query.length < 2 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t('search.hint')}
            </div>
          )}

          {results.length > 0 && (
            <div className="py-2">
              {(['professional', 'service', 'job'] as const).map(type => {
                const group = results.filter(r => r.type === type);
                if (!group.length) return null;
                return (
                  <div key={type}>
                    <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {labelFor(type)}
                    </p>
                    {group.map(result => (
                      <button
                        key={result.id}
                        onClick={() => handleSelect(result)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors text-left"
                      >
                        {result.type === 'professional' ? (
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={result.avatar} />
                            <AvatarFallback className="bg-orange-100 text-orange-700 text-xs font-bold">
                              {result.title.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            {iconFor(result.type)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 bg-muted px-2 py-0.5 rounded-full">
                          {labelFor(result.type)}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
