'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { supabase } from '@/lib/supabase/client';
import { Wrench, Search, Zap, MapPin, Loader2, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Business = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  emergency_enabled: boolean;
  service_area_cities: string[];
  business_subtype: string | null;
  primary_city: string | null;
  service_count: number;
  services: string[];
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MajstoriPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const LIMIT = 20;

  const load = useCallback(async (city: string, off: number, append = false) => {
    setLoading(true);
    const { data } = await (supabase as any).rpc('list_trade_businesses', {
      p_city:   city || null,
      p_limit:  LIMIT,
      p_offset: off,
    });
    if (data?.ok) {
      const rows: Business[] = data.data ?? [];
      setBusinesses(prev => append ? [...prev, ...rows] : rows);
      setHasMore(rows.length === LIMIT);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setOffset(0);
    load(cityFilter, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityFilter]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setCityFilter(search.trim());
  }

  function loadMore() {
    const next = offset + LIMIT;
    setOffset(next);
    load(cityFilter, next, true);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{t('trade.majstori.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('trade.majstori.desc')}</p>
            </div>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('trade.majstori.search')}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {t('trade.majstori.filter.city')}
            </button>
          </form>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {loading && businesses.length === 0 && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && businesses.length === 0 && (
          <div className="text-center py-16 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <Wrench className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t('trade.majstori.empty')}</p>
          </div>
        )}

        {businesses.length > 0 && (
          <div className="flex flex-col gap-3">
            {businesses.map(biz => (
              <button
                key={biz.id}
                onClick={() => router.push(`/booking/majstori/${biz.id}`)}
                className="w-full text-left border border-border rounded-2xl bg-card hover:border-primary/50 hover:shadow-sm transition-all p-4"
              >
                <div className="flex items-start gap-3">
                  {/* Logo */}
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0 overflow-hidden">
                    {biz.logo_url ? (
                      <img src={biz.logo_url} alt={biz.name} className="w-full h-full object-cover" />
                    ) : (
                      <Wrench className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground leading-snug">{biz.name}</p>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    </div>

                    {biz.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{biz.description}</p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                      {biz.primary_city && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          {biz.primary_city}
                        </span>
                      )}
                      {biz.emergency_enabled && (
                        <span className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded-full">
                          <Zap className="w-3 h-3" />
                          {t('trade.majstori.emergencyAvailable')}
                        </span>
                      )}
                      {biz.service_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {biz.service_count} {t('trade.majstori.services').toLowerCase()}
                        </span>
                      )}
                    </div>

                    {biz.services.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {biz.services.slice(0, 4).map((s, i) => (
                          <span key={i} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md">
                            {s}
                          </span>
                        ))}
                        {biz.services.length > 4 && (
                          <span className="text-[10px] text-muted-foreground px-1 py-0.5">
                            +{biz.services.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="mt-2 py-3 rounded-xl border border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {t('trade.majstori.loadMore')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
