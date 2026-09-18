'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Search, MapPin, ChevronRight, Scissors } from 'lucide-react';

type BizCard = {
  id: string;
  name: string;
  avatar_url: string | null;
  cities: string[];
  services: { name: string }[];
};

export default function TerminiPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [businesses, setBusinesses] = useState<BizCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: svcs } = await (supabase as any)
        .from('service_catalog')
        .select('business_id, name')
        .eq('is_active', true)
        .order('name');

      if (!svcs?.length) { setLoading(false); return; }

      const bizIds = [...new Set((svcs as any[]).map((s: any) => s.business_id))] as string[];

      const [{ data: profiles }, { data: locs }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, avatar_url, city')
          .in('id', bizIds)
          .eq('is_business', true),
        supabase
          .from('business_locations')
          .select('business_id, city, is_primary')
          .in('business_id', bizIds)
          .eq('is_active', true),
      ]);

      // Collect all cities per business, primary first
      const locCities: Record<string, string[]> = {};
      [...(locs ?? [])].sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
        .forEach((l: any) => {
          if (!l.city) return;
          if (!locCities[l.business_id]) locCities[l.business_id] = [];
          if (!locCities[l.business_id].includes(l.city)) locCities[l.business_id].push(l.city);
        });

      const svcsByBiz: Record<string, { name: string }[]> = {};
      (svcs as any[]).forEach((s: any) => {
        if (!svcsByBiz[s.business_id]) svcsByBiz[s.business_id] = [];
        svcsByBiz[s.business_id].push({ name: s.name });
      });

      setBusinesses(
        (profiles ?? []).map((p: any) => {
          const cities = locCities[p.id] ?? (p.city ? [p.city] : []);
          return { id: p.id, name: p.name, avatar_url: p.avatar_url, cities, services: svcsByBiz[p.id] ?? [] };
        })
      );
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter(b =>
      b.name.toLowerCase().includes(q) ||
      b.cities.some(c => c.toLowerCase().includes(q)) ||
      b.services.some(s => s.name.toLowerCase().includes(q))
    );
  }, [businesses, search]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        <button
          onClick={() => router.push('/booking')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('booking.hub.title')}
        </button>

        <h1 className="text-xl font-bold text-foreground">{t('booking.hub.cat.termini')}</h1>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('booking.termini.searchPh')}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Scissors className="w-10 h-10 mx-auto mb-3 opacity-30" />
            {search ? t('booking.termini.noResults') : t('booking.termini.empty')}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(biz => (
              <button
                key={biz.id}
                onClick={() => router.push(`/booking/${biz.id}`)}
                className="w-full text-left border border-border rounded-xl p-4 bg-card hover:border-primary/50 hover:bg-accent/30 transition-colors flex items-center gap-3"
              >
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarImage src={biz.avatar_url ?? undefined} alt={biz.name} />
                  <AvatarFallback className="text-base font-semibold bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
                    {biz.name[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{biz.name}</p>
                  {biz.cities.length > 0 && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {biz.cities.slice(0, 3).join(' · ')}
                      {biz.cities.length > 3 && ` +${biz.cities.length - 3}`}
                    </p>
                  )}
                  {biz.services.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {biz.services.slice(0, 3).map(s => s.name).join(' · ')}
                      {biz.services.length > 3 && ` +${biz.services.length - 3}`}
                    </p>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
