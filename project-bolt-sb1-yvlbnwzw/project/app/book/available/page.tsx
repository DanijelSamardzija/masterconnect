'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { useBookingAccess } from '@/lib/hooks/use-booking-access';
import { BookingBetaBanner } from '@/components/booking-beta-banner';
import { ArrowLeft, Search, Star } from 'lucide-react';

type AvailabilityFilter = 'any' | 'available_today' | 'available_now';

type BookableProfile = {
  id: string;
  name: string;
  avatar_url: string | null;
  category: string | null;
  city: string | null;
  country: string | null;
  average_rating: number | null;
  review_count: number | null;
  live_status: string;
  is_open_now: boolean;
  is_open_today: boolean;
  business_type: string | null;
  is_premium: boolean | null;
};

const LIVE_BADGE: Record<string, { label: string; cls: string }> = {
  available_now:   { label: 'live.status.available_now',   cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  available_today: { label: 'live.status.available_today', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  by_schedule:     { label: 'live.status.by_schedule',     cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

const FILTERS: AvailabilityFilter[] = ['any', 'available_today', 'available_now'];

export default function AvailableNowPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { hasAccess, loading: authLoading } = useBookingAccess();

  const [profiles, setProfiles] = useState<BookableProfile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<AvailabilityFilter>('any');
  const [citySearch, setCitySearch] = useState('');

  useEffect(() => {
    if (!hasAccess) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await (supabase as any).rpc('find_bookable_profiles', {
        p_availability_filter: filter,
        p_city: citySearch.trim() ? `%${citySearch.trim()}%` : null,
        p_limit: 50,
      });
      if (!cancelled) {
        setProfiles((data as BookableProfile[]) ?? []);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [filter, citySearch, hasAccess]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasAccess) return <BookingBetaBanner />;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('booking.backToServices')}
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold">{t('live.discover.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('live.discover.subtitle')}</p>
        </div>

        {/* Availability filter chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent text-accent-foreground hover:bg-accent/80'
              }`}
            >
              {f === 'any'
                ? t('live.discover.filterAll')
                : t(`live.status.${f}` as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>

        {/* City search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={citySearch}
            onChange={(e) => setCitySearch(e.target.value)}
            placeholder={t('discover.filterCity')}
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            {t('live.discover.empty')}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {profiles.map((p) => {
              const badge = LIVE_BADGE[p.live_status];
              return (
                <Link
                  key={p.id}
                  href={`/book/${p.id}`}
                  className="block border border-border rounded-xl p-4 hover:border-primary hover:bg-accent/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {p.avatar_url ? (
                      <img
                        src={p.avatar_url}
                        alt={p.name}
                        className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-muted flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{p.name}</span>
                        {badge && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>
                            {t(badge.label as Parameters<typeof t>[0])}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        {p.category && <span>{p.category}</span>}
                        {p.city && <span>· {p.city}</span>}
                        {p.average_rating != null && (
                          <span className="flex items-center gap-0.5">
                            · <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 inline" />
                            {p.average_rating.toFixed(1)}
                            {p.review_count ? ` (${p.review_count})` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
