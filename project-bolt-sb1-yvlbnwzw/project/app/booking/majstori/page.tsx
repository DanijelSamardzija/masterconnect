'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { supabase } from '@/lib/supabase/client';
import { Wrench, Search, Zap, MapPin, Loader2, ChevronRight, Star, ArrowLeft } from 'lucide-react';

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
  primary_address: string | null;
  avg_rating: number | null;
  review_count: number;
  service_count: number;
  services: string[];
  is_open_now: boolean | null;
  closure_reason: string | null;
  closure_date_from: string | null;
  closure_date_to: string | null;
  closure_is_active: boolean | null;
};

function fmtDate(d: string | null): string {
  if (!d) return '';
  const parts = d.split('-');
  return `${parseInt(parts[2])}.${parseInt(parts[1])}.`;
}

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
          <button
            onClick={() => router.push('/booking')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('booking.hub.title')}
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{t('trade.majstori.title')}</h1>
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
                placeholder={t('trade.majstori.searchPh')}
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
            {businesses.map(biz => {
              const locationLabel = [biz.primary_address, biz.primary_city].filter(Boolean).join(', ');
              const mapsUrl = locationLabel
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationLabel)}`
                : null;

              return (
                <button
                  key={biz.id}
                  onClick={() => router.push(`/booking/majstori/${biz.id}`)}
                  className="w-full text-left border border-border rounded-xl p-4 bg-card hover:border-primary/50 hover:bg-accent/30 transition-colors flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0 overflow-hidden">
                    {biz.logo_url ? (
                      <img src={biz.logo_url} alt={biz.name} className="w-full h-full object-cover" />
                    ) : (
                      <Wrench className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-foreground truncate">{biz.name}</p>
                      {biz.avg_rating != null && biz.review_count > 0 && (
                        <span className="flex items-center gap-0.5 text-sm text-amber-600 dark:text-amber-400 font-medium shrink-0">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {biz.avg_rating.toFixed(1)} ({biz.review_count})
                        </span>
                      )}
                    </div>
                    {biz.business_subtype && (
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                        {t(`trade.subtype.${biz.business_subtype}` as Parameters<typeof t>[0])}
                      </p>
                    )}
                    {biz.emergency_enabled && (
                      <span className="flex items-center gap-0.5 text-xs font-medium text-red-600 dark:text-red-400 mt-0.5">
                        <Zap className="w-3 h-3" />
                        {t('trade.majstori.emergencyAvailable')}
                      </span>
                    )}

                    {locationLabel && (
                      <span
                        onClick={mapsUrl ? (e) => { e.stopPropagation(); window.open(mapsUrl, '_blank'); } : undefined}
                        className={`flex items-center gap-1 text-sm text-muted-foreground mt-0.5 w-fit truncate max-w-full ${mapsUrl ? 'hover:text-primary cursor-pointer' : ''}`}
                      >
                        <MapPin className="w-3 h-3 shrink-0" />
                        {locationLabel}
                      </span>
                    )}

                    {biz.services.length > 0 && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        {biz.services.slice(0, 3).join(' · ')}
                        {biz.services.length > 3 && ` +${biz.services.length - 3}`}
                      </p>
                    )}
                    {!biz.closure_is_active && biz.is_open_now !== null && biz.is_open_now !== undefined && (
                      <span className={`flex items-center gap-1 text-xs font-medium mt-0.5 ${biz.is_open_now ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${biz.is_open_now ? 'bg-green-500' : 'bg-red-500'}`} />
                        {biz.is_open_now ? t('setup.hours.open') : t('setup.hours.closed')}
                      </span>
                    )}
                    {biz.closure_reason && (
                      <span className={`flex items-center gap-1 text-xs font-medium mt-0.5 ${biz.closure_is_active ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${biz.closure_is_active ? 'bg-red-500' : 'bg-amber-500'}`} />
                        {biz.closure_is_active
                          ? t(`setup.closures.reason.${biz.closure_reason}` as Parameters<typeof t>[0])
                          : `${t('booking.closure.upcomingClosure')} · ${t(`setup.closures.reason.${biz.closure_reason}` as Parameters<typeof t>[0])} od ${fmtDate(biz.closure_date_from)}`
                        }
                      </span>
                    )}
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}

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
