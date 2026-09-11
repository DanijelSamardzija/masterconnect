'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, Star } from 'lucide-react';

type AvailabilityFilter = 'any' | 'available_now' | 'available_today';

type Profile = {
  id: string;
  name: string;
  avatar_url: string | null;
  category: string | null;
  city: string | null;
  country: string | null;
  average_rating: number | null;
  review_count: number | null;
  live_status: string | null;
  is_open_now: boolean;
  is_open_today: boolean;
  business_type: string | null;
  is_premium: boolean;
};

export default function BookingDiscoveryPage() {
  const { t } = useLanguage();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AvailabilityFilter>('any');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any).rpc('find_bookable_profiles', {
        p_availability_filter: filter,
        p_limit: 50,
      });
      setProfiles((data as Profile[]) ?? []);
      setLoading(false);
    })();
  }, [filter]);

  const filters: { value: AvailabilityFilter; label: string }[] = [
    { value: 'any', label: t('booking.discovery.all') },
    { value: 'available_now', label: t('booking.discovery.availableNow') },
    { value: 'available_today', label: t('booking.discovery.availableToday') },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{t('booking.discovery.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('booking.discovery.subtitle')}</p>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filter === f.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : profiles.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">{t('booking.discovery.noResults')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {profiles.map((p) => (
              <Link
                key={p.id}
                href={`/booking/${p.id}`}
                className="block border border-border rounded-xl p-4 hover:border-primary hover:bg-accent/20 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11 shrink-0">
                    <AvatarImage src={p.avatar_url ?? undefined} alt={p.name} />
                    <AvatarFallback className="text-sm font-semibold">{p.name[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground truncate">{p.name}</span>
                      {p.is_open_now && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shrink-0">
                          {t('booking.discovery.openNow')}
                        </span>
                      )}
                      {!p.is_open_now && p.is_open_today && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shrink-0">
                          {t('booking.discovery.openToday')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      {p.city && <span>{p.city}</span>}
                      {p.category && <span>{p.category}</span>}
                      {p.average_rating && p.review_count ? (
                        <span className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          {p.average_rating.toFixed(1)} ({p.review_count})
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-primary shrink-0">
                    {t('booking.discovery.book')} →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
