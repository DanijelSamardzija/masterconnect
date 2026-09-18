'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Clock, Users, MapPin, Phone, UserPlus, UserCheck, Star } from 'lucide-react';

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
  const { t } = useLanguage();
  const { user } = useAuth();

  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [primaryLocation, setPrimaryLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  const [reviewsData, setReviewsData] = useState<ReviewsData | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    (async () => {
      setLoading(true);
      const [bizRes, svcRes, locRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, avatar_url, live_status, city, category')
          .eq('id', businessId)
          .eq('is_business', true)
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
          .order('is_primary', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setBusiness(bizRes.data ?? null);
      setServices((svcRes.data as Service[]) ?? []);
      setPrimaryLocation((locRes.data as Location) ?? null);
      setLoading(false);

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
  }, [businessId]);

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
          onClick={() => router.push('/booking')}
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
                  <span className="flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
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
              <div className="flex flex-col gap-0.5 mt-0.5">
                {primaryLocation && (primaryLocation.address || primaryLocation.city) && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {[primaryLocation.address, primaryLocation.city, primaryLocation.country].filter(Boolean).join(', ')}
                  </span>
                )}
                {!primaryLocation && business.city && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {business.city}
                  </span>
                )}
                {primaryLocation?.phone && (
                  <a href={`tel:${primaryLocation.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                    <Phone className="w-3 h-3 shrink-0" />
                    {primaryLocation.phone}
                  </a>
                )}
              </div>
            </div>
            {/* Follow button */}
            {user && (
              <button
                onClick={handleFollow}
                disabled={followLoading}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  isFollowing
                    ? 'bg-primary/10 text-primary border-primary/30 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400'
                    : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-primary'
                } disabled:opacity-50`}
              >
                {isFollowing
                  ? <><UserCheck className="w-3.5 h-3.5" />{t('booking.unfollow')}</>
                  : <><UserPlus className="w-3.5 h-3.5" />{t('booking.follow')}</>
                }
              </button>
            )}
          </div>
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
                    href={`/booking/${businessId}/${svc.id}`}
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
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {svc.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
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
                        <span className="text-xs font-medium text-foreground">{r.reviewer_name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(r.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {r.comment && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{r.comment}</p>
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
