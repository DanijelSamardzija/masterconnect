'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Clock, Users, MapPin, Phone, UserPlus, UserCheck, Star, ChevronRight, Share2, AlertTriangle } from 'lucide-react';
import { SharePostModal } from '@/components/share-post-modal';

type OpeningHourRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
};

type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string;
};

type ReviewsData = {
  avg_rating: number | null;
  total_count: number;
  reviews: ReviewItem[];
};

type Business = {
  id: string;
  name: string;
  avatar_url: string | null;
  live_status: string | null;
  city: string | null;
  category: string | null;
};

type Location = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  is_primary: boolean;
};

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  capacity: number;
  price: number | null;
  price_type: string;
  currency: string | null;
  booking_type: string;
};

const BOOKING_TYPE_LABELS: Record<string, string> = {
  appointment_service: 'booking.activate.typeAppointment',
  tradespeople: 'booking.activate.typeTradespeople',
};

export default function BusinessBookingProfilePage() {
  const { businessId } = useParams<{ businessId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationId = searchParams.get('locationId');
  const { t, language } = useLanguage();
  const locale = { sr: 'sr-RS', en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' }[language] ?? 'en-US';
  const { user } = useAuth();

  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  const [reviewsData, setReviewsData] = useState<ReviewsData | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [openingHours, setOpeningHours] = useState<OpeningHourRow[]>([]);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [closures, setClosures] = useState<Array<{ reason: string; note: string | null; date_from: string; date_to: string }>>([]);

  useEffect(() => {
    if (!businessId) return;
    (async () => {
      setLoading(true);
      const [bizRes, svcRes, locRes, hoursRes] = await Promise.all([
        // Look up booking_profiles (works for both primary and secondary profiles).
        // Primary: booking_profiles.id === profiles.id.
        // Secondary: fresh UUID; owner data comes via owner_id → profiles join.
        (supabase as any)
          .from('booking_profiles')
          .select('id, name, avatar_url, profiles!booking_profiles_owner_id_fkey(live_status, city, category)')
          .eq('id', businessId)
          .eq('is_active', true)
          .maybeSingle(),
        (supabase as any)
          .from('service_catalog')
          .select('id, name, description, duration_minutes, capacity, price, price_type, currency, booking_type')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('business_locations')
          .select('id, name, address, city, country, phone, is_primary')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .order('is_primary', { ascending: false }),
        locationId
          ? (supabase as any).rpc('get_opening_hours', { p_location_id: locationId })
          : Promise.resolve({ data: [] }),
      ]);
      const bpRow = bizRes.data as {
        id: string;
        name: string;
        avatar_url: string | null;
        profiles: { live_status: string | null; city: string | null; category: string | null } | null;
      } | null;
      setBusiness(bpRow ? {
        id:          bpRow.id,
        name:        bpRow.name,
        avatar_url:  bpRow.avatar_url ?? null,
        live_status: bpRow.profiles?.live_status ?? null,
        city:        bpRow.profiles?.city ?? null,
        category:    bpRow.profiles?.category ?? null,
      } : null);
      setOpeningHours((hoursRes.data as OpeningHourRow[]) ?? []);

      let displayedServices = (svcRes.data as Service[]) ?? [];
      const allLocs = (locRes.data as Location[]) ?? [];

      if (locationId && displayedServices.length > 0) {
        const svcIds = displayedServices.map(s => s.id);
        const { data: svcLocs } = await (supabase as any)
          .from('service_locations')
          .select('service_id, location_id')
          .in('service_id', svcIds);
        const assignMap = new Map<string, Set<string>>();
        (svcLocs ?? []).forEach((sl: { service_id: string; location_id: string }) => {
          if (!assignMap.has(sl.service_id)) assignMap.set(sl.service_id, new Set());
          assignMap.get(sl.service_id)!.add(sl.location_id);
        });
        displayedServices = displayedServices.filter(svc => {
          const a = assignMap.get(svc.id);
          return !a || a.size === 0 || a.has(locationId);
        });
      }

      setServices(displayedServices);
      const displayedLocs = locationId ? allLocs.filter(l => l.id === locationId) : allLocs;
      setLocations(displayedLocs);
      setLoading(false);

      // Load closures for primary location (non-blocking, accessible to anon)
      const primaryLocId = (locationId ?? allLocs.find(l => l.is_primary)?.id ?? allLocs[0]?.id) as string | undefined;
      if (primaryLocId) {
        (supabase as any).rpc('public_get_business_closures', { p_location_id: primaryLocId })
          .then(({ data }: { data: Array<{ reason: string; note: string | null; date_from: string; date_to: string }> | null }) => {
            setClosures(data ?? []);
          });
      }

      // Load follow info + reviews in parallel (non-blocking)
      const [followRes, reviewsRes] = await Promise.all([
        (supabase as any).rpc('get_business_follow_info', { p_business_id: businessId }),
        (supabase as any).rpc('get_business_reviews', { p_business_id: businessId, p_limit: 10 }),
      ]);
      if (followRes.data) {
        setIsFollowing(followRes.data.is_following ?? false);
        setFollowerCount(followRes.data.follower_count ?? 0);
      }
      if (reviewsRes.data) {
        setReviewsData(reviewsRes.data as ReviewsData);
      }
    })();
  }, [businessId, locationId]);

  async function handleFollow() {
    if (!user) return;
    setFollowLoading(true);
    const { data } = await (supabase as any).rpc('toggle_business_follow', { p_business_id: businessId });
    setFollowLoading(false);
    if (data?.ok) {
      setIsFollowing(data.is_following);
      setFollowerCount(data.follower_count);
    }
  }

  function formatPrice(svc: Service): string {
    if (svc.price_type === 'negotiable') return t('booking.priceNegotiable');
    if (!svc.price || svc.price === 0) return t('booking.priceFree');
    return `${svc.price.toLocaleString()} ${svc.currency ?? ''}`.trim();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">{t('booking.notFound')}</p>
        <button onClick={() => router.back()} className="text-primary underline text-sm">
          {t('booking.backToServices')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button
          onClick={() => router.push('/booking/termini')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors py-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('booking.discovery.title')}
        </button>

        <div className="border border-border rounded-xl overflow-hidden">
          {/* Avatar + name + location + phone */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={business.avatar_url ?? undefined} alt={business.name} />
              <AvatarFallback className="text-base font-semibold">
                {business.name[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-semibold">{business.name}</h1>
                {/* Rating chip */}
                {reviewsData && reviewsData.total_count > 0 && (
                  <span className="flex items-center gap-0.5 text-sm text-amber-600 dark:text-amber-400 font-medium">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    {reviewsData.avg_rating} ({reviewsData.total_count})
                  </span>
                )}
                {business.live_status && business.live_status !== 'unavailable' && business.live_status !== 'by_schedule' && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    business.live_status === 'available_now'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {t(`live.status.${business.live_status}` as Parameters<typeof t>[0])}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1 mt-0.5">
                {locations.length > 0 ? (
                  locations.map((loc) => (
                    <div key={loc.id} className="flex flex-col gap-0.5">
                      {[loc.address, loc.city, loc.country].filter(Boolean).length > 0 && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([loc.address, loc.city, loc.country].filter(Boolean).join(', '))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline hover:text-primary transition-colors"
                          >
                            {[loc.address, loc.city, loc.country].filter(Boolean).join(', ')}
                          </a>
                        </span>
                      )}
                      {loc.phone && (
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Phone className="w-3 h-3 shrink-0" />
                          <a href={`tel:${loc.phone}`} className="hover:text-primary transition-colors">
                            {loc.phone}
                          </a>
                          <a
                            href={`https://wa.me/${loc.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="WhatsApp"
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#25D366]/15 hover:bg-[#25D366]/30 text-[#25D366] transition-colors"
                          >
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                          </a>
                          <a
                            href={`viber://chat?number=${loc.phone.replace(/\D/g, '')}`}
                            title="Viber"
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#7B519D]/15 hover:bg-[#7B519D]/30 text-[#7B519D] transition-colors"
                          >
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                              <path d="M11.398.008C8.232.022 4.483 1.652 2.38 5.137 1.027 7.418.769 10.162.997 12.63c.218 2.27 1.144 4.5 2.804 6.083 1.62 1.547 4.082 2.61 6.376 2.47l3.906 2.825-.194-3.054c4.32-.427 7.917-3.77 8.101-8.217.14-3.428-1.41-7.108-3.78-9.213C16.437.72 13.95-.008 11.398.008zm.03 1.846c2.218-.012 4.324.625 6.042 2.164 1.987 1.8 3.234 4.993 3.117 7.84-.158 3.747-3.234 6.504-6.924 6.782l.116 1.815-2.323-1.67-.5.035c-2.015.14-4.148-.79-5.575-2.155C3.993 15.53 3.215 13.617 3.03 11.647c-.197-2.1.004-4.354 1.066-6.202C6.044 3.117 8.952 1.866 11.428 1.854zM8.42 5.597c-.24 0-.482.06-.676.212-.193.152-.426.375-.586.619-.217.334-.21.75-.049 1.21.162.462.47.95.813 1.393.537.699 1.08 1.32 1.773 1.893.693.573 1.426 1.015 2.184 1.288.448.16.916.224 1.285.073.37-.151.59-.48.735-.83.178-.426.153-.806-.046-1.047-.198-.241-.571-.434-.867-.578-.296-.146-.591-.278-.858-.226-.266.053-.433.27-.574.484-.141.215-.269.378-.44.417-.17.038-.48-.073-.74-.265-.36-.263-.757-.653-1.098-1.035-.34-.38-.636-.773-.78-1.04-.144-.267-.122-.495-.086-.598.037-.104.155-.24.316-.393.16-.153.349-.32.437-.534.087-.213.05-.51-.11-.814-.161-.305-.42-.621-.714-.816-.294-.195-.578-.213-.72-.213z" />
                            </svg>
                          </a>
                        </span>
                      )}
                    </div>
                  ))
                ) : business.city ? (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {business.city}
                  </span>
                ) : null}
              </div>
            </div>
            {/* Share button — visible to all */}
            <button
              onClick={() => setShareOpen(true)}
              className="shrink-0 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border border-border"
              title={t('booking.shareProfile')}
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            {/* Follow button */}
            {user && (
              <button
                onClick={handleFollow}
                disabled={followLoading}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  isFollowing
                    ? 'bg-primary/10 text-primary border-primary/30 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400'
                    : 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                } disabled:opacity-50`}
              >
                {isFollowing
                  ? <><UserCheck className="w-3.5 h-3.5" />{t('booking.unfollow')}</>
                  : <><UserPlus className="w-3.5 h-3.5" />{t('booking.follow')}</>
                }
              </button>
            )}
            <SharePostModal
              postId={businessId}
              urlPath={`/booking/${businessId}`}
              open={shareOpen}
              onOpenChange={setShareOpen}
            />
          </div>
          {/* Closure banner */}
          {closures.length > 0 && (() => {
            const today = new Date().toISOString().split('T')[0];
            const active  = closures.filter(c => c.date_from <= today && c.date_to >= today);
            const upcoming = closures.filter(c => c.date_from > today);
            const show = active.length > 0 ? active : upcoming;
            if (show.length === 0) return null;
            const isActive = active.length > 0;
            return (
              <div className={`mx-4 mb-3 flex flex-col gap-1.5 px-3 py-2.5 rounded-xl border text-xs ${
                isActive
                  ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-700 text-orange-800 dark:text-orange-300'
                  : 'border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 text-amber-800 dark:text-amber-300'
              }`}>
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {isActive ? t('booking.closure.currentlyClosed') : t('booking.closure.upcomingClosure')}
                </div>
                {show.map((c, i) => {
                  const reasonKey = `setup.closures.reason.${c.reason}` as Parameters<typeof t>[0];
                  const label = ['vacation','sick_leave','holiday','renovation','other'].includes(c.reason) ? t(reasonKey) : c.reason;
                  const fmt = (d: string) => { const [y,m,dd] = d.split('-'); return `${dd}.${m}.${y}.`; };
                  return (
                    <span key={i}>
                      {label} · {fmt(c.date_from)} – {fmt(c.date_to)}
                      {c.note ? ` · ${c.note}` : ''}
                    </span>
                  );
                })}
              </div>
            );
          })()}

          {/* Working hours — shown when a specific location is selected */}
          {openingHours.length > 0 && (
            <div className="px-4 pb-3 border-t border-border pt-3">
              <button
                onClick={() => setHoursOpen(o => !o)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{t('setup.hours.heading')}</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${hoursOpen ? 'rotate-90' : ''}`} />
              </button>
              {hoursOpen && (
                <div className="mt-2 border border-border rounded-xl overflow-hidden bg-card">
                  {[1,2,3,4,5,6,0].map(dow => {
                    const periods = openingHours.filter(h => h.day_of_week === dow && !h.is_closed);
                    const isClosed = periods.length === 0;
                    return (
                      <div key={dow} className="flex items-center px-3 py-2 border-b border-border last:border-0">
                        <span className="w-28 text-sm font-medium text-foreground shrink-0">
                          {t(`setup.hours.day.${dow}` as Parameters<typeof t>[0])}
                        </span>
                        {isClosed ? (
                          <span className="text-sm text-muted-foreground">{t('setup.hours.closed')}</span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {periods.map((p, i) => (
                              <span key={i} className="flex items-center gap-1.5 text-sm text-foreground">
                                {i > 0 && <span className="text-muted-foreground">·</span>}
                                {p.start_time.slice(0, 5)} – {p.end_time.slice(0, 5)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Follower count */}
          {followerCount > 0 && (
            <p className="px-4 pb-2 text-xs text-muted-foreground">
              {t('booking.followers').replace('{n}', String(followerCount))}
            </p>
          )}

          {/* Services list */}
          {services.length === 0 ? (
            <div className="border-t border-border px-4 py-6 text-center">
              <p className="text-muted-foreground text-sm">{t('booking.noServices')}</p>
            </div>
          ) : (
            <div className="border-t border-border divide-y divide-border">
              {services.map((svc) => {
                const typeKey = BOOKING_TYPE_LABELS[svc.booking_type];
                return (
                  <Link
                    key={svc.id}
                    href={`/booking/${businessId}/${svc.id}${locationId ? `?locationId=${locationId}` : ''}`}
                    className="flex items-start justify-between gap-3 px-4 py-4 hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="font-medium text-sm truncate">{svc.name}</h2>
                        {typeKey && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                            {t(typeKey as Parameters<typeof t>[0])}
                          </span>
                        )}
                      </div>
                      {svc.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {svc.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {t('booking.duration').replace('{min}', String(svc.duration_minutes))}
                        </span>
                        {svc.capacity > 1 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {t('booking.guests')}: {svc.capacity}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-medium shrink-0 text-foreground">
                      {formatPrice(svc)}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Reviews section */}
          <div className="border-t border-border px-4 py-4">
            <h2 className="text-sm font-semibold mb-3">{t('booking.reviews.title')}</h2>
            {!reviewsData || reviewsData.total_count === 0 ? (
              <p className="text-xs text-muted-foreground">{t('booking.reviews.noReviews')}</p>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  {(showAllReviews ? reviewsData.reviews : reviewsData.reviews.slice(0, 2)).map((r) => (
                    <div key={r.id} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(n => (
                            <Star key={n} className={`w-3 h-3 ${n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-border'}`} />
                          ))}
                        </div>
                        <span className="text-sm font-medium text-foreground">{r.reviewer_name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(r.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {r.comment && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{r.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
                {reviewsData.reviews.length > 2 && (
                  <button
                    onClick={() => setShowAllReviews(v => !v)}
                    className="mt-3 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    {showAllReviews
                      ? t('booking.reviews.showLess')
                      : t('booking.reviews.showMore').replace('{n}', String(reviewsData.reviews.length - 2))}
                  </button>
                )}
              </>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
