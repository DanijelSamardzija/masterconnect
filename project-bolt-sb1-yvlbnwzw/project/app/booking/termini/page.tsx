'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Search, MapPin, ChevronRight, Scissors, Star } from 'lucide-react';

type LocCard = {
  key: string;
  bizId: string;
  locId: string | null;
  bizName: string;
  avatarUrl: string | null;
  address: string | null;
  city: string | null;
  avgRating: number | null;
  reviewCount: number;
  serviceNames: string[];
};

export default function TerminiPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [cards, setCards] = useState<LocCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: svcs } = await (supabase as any)
        .from('service_catalog')
        .select('id, business_id, name')
        .eq('is_active', true);

      if (!svcs?.length) { setLoading(false); return; }

      const svcList = svcs as { id: string; business_id: string; name: string }[];
      const svcIds = svcList.map(s => s.id);
      const bizIds = [...new Set(svcList.map(s => s.business_id))] as string[];

      const [{ data: profiles }, { data: locs }, { data: svcLocs }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, avatar_url, average_rating, review_count')
          .in('id', bizIds)
          .eq('is_business', true),
        supabase
          .from('business_locations')
          .select('id, business_id, address, city, is_primary')
          .in('business_id', bizIds)
          .eq('is_active', true)
          .order('is_primary', { ascending: false }),
        (supabase as any)
          .from('service_locations')
          .select('service_id, location_id')
          .in('service_id', svcIds),
      ]);

      // Build service_locations map: service_id → Set<location_id>
      const svcLocMap = new Map<string, Set<string>>();
      (svcLocs ?? []).forEach((sl: { service_id: string; location_id: string }) => {
        if (!svcLocMap.has(sl.service_id)) svcLocMap.set(sl.service_id, new Set());
        svcLocMap.get(sl.service_id)!.add(sl.location_id);
      });

      // Group services by business
      const svcsByBiz = new Map<string, { id: string; name: string }[]>();
      svcList.forEach(s => {
        if (!svcsByBiz.has(s.business_id)) svcsByBiz.set(s.business_id, []);
        svcsByBiz.get(s.business_id)!.push({ id: s.id, name: s.name });
      });

      // Group locations by business
      type LocRow = { id: string; business_id: string; address: string | null; city: string | null; is_primary: boolean };
      const locsByBiz = new Map<string, LocRow[]>();
      (locs ?? []).forEach((l: any) => {
        if (!locsByBiz.has(l.business_id)) locsByBiz.set(l.business_id, []);
        locsByBiz.get(l.business_id)!.push(l);
      });

      function servicesAtLocation(bizId: string, locId: string): string[] {
        return (svcsByBiz.get(bizId) ?? [])
          .filter(svc => {
            const assignments = svcLocMap.get(svc.id);
            return !assignments || assignments.size === 0 || assignments.has(locId);
          })
          .map(s => s.name);
      }

      const result: LocCard[] = [];
      (profiles ?? []).forEach((p: any) => {
        const bizLocs = locsByBiz.get(p.id) ?? [];
        const bizSvcs = svcsByBiz.get(p.id) ?? [];
        const rating = p.average_rating != null ? Number(p.average_rating) : null;
        const reviewCount = p.review_count ?? 0;

        if (bizLocs.length === 0) {
          result.push({
            key: `${p.id}-noloc`,
            bizId: p.id,
            locId: null,
            bizName: p.name,
            avatarUrl: p.avatar_url,
            address: null,
            city: null,
            avgRating: rating,
            reviewCount,
            serviceNames: bizSvcs.map(s => s.name),
          });
        } else if (bizLocs.length === 1) {
          const loc = bizLocs[0];
          result.push({
            key: `${p.id}-${loc.id}`,
            bizId: p.id,
            locId: null,
            bizName: p.name,
            avatarUrl: p.avatar_url,
            address: loc.address,
            city: loc.city,
            avgRating: rating,
            reviewCount,
            serviceNames: servicesAtLocation(p.id, loc.id),
          });
        } else {
          bizLocs.forEach(loc => {
            result.push({
              key: `${p.id}-${loc.id}`,
              bizId: p.id,
              locId: loc.id,
              bizName: p.name,
              avatarUrl: p.avatar_url,
              address: loc.address,
              city: loc.city,
              avgRating: rating,
              reviewCount,
              serviceNames: servicesAtLocation(p.id, loc.id),
            });
          });
        }
      });

      setCards(result);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(c =>
      c.bizName.toLowerCase().includes(q) ||
      (c.city ?? '').toLowerCase().includes(q) ||
      (c.address ?? '').toLowerCase().includes(q) ||
      c.serviceNames.some(n => n.toLowerCase().includes(q))
    );
  }, [cards, search]);

  function navTo(card: LocCard) {
    const url = card.locId
      ? `/booking/${card.bizId}?locationId=${card.locId}`
      : `/booking/${card.bizId}`;
    router.push(url);
  }

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
            {filtered.map(card => (
              <button
                key={card.key}
                onClick={() => navTo(card)}
                className="w-full text-left border border-border rounded-xl p-4 bg-card hover:border-primary/50 hover:bg-accent/30 transition-colors flex items-center gap-3"
              >
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarImage src={card.avatarUrl ?? undefined} alt={card.bizName} />
                  <AvatarFallback className="text-base font-semibold bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
                    {card.bizName[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-foreground truncate">{card.bizName}</p>
                    {card.avgRating != null && card.reviewCount > 0 && (
                      <span className="flex items-center gap-0.5 text-sm text-amber-600 dark:text-amber-400 font-medium shrink-0">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {card.avgRating.toFixed(1)} ({card.reviewCount})
                      </span>
                    )}
                  </div>
                  {(card.address || card.city) && (
                    <p className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {[card.address, card.city].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {card.serviceNames.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {card.serviceNames.slice(0, 3).join(' · ')}
                      {card.serviceNames.length > 3 && ` +${card.serviceNames.length - 3}`}
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
