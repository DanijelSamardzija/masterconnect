'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import {
  Wrench, MapPin, Zap, Phone, Mail, Loader2,
  ChevronLeft, ChevronRight, ChevronDown, AlertCircle, Share2, Star, MessageSquareText,
  UserPlus, UserCheck,
} from 'lucide-react';
import { SharePostModal } from '@/components/share-post-modal';
import { TradeReviewModal } from '@/components/trade/TradeReviewModal';

// ─── Types ────────────────────────────────────────────────────────────────────

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

type Service = {
  id: string;
  name: string;
  description: string | null;
  price_type: string | null;
  price: number | null;
  currency: string | null;
};

type WeeklyHour = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
};

type Profile = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  contact_channels: Record<string, string> | null;
  emergency_enabled: boolean;
  service_area_cities: string[];
  business_subtype: string | null;
  address: string | null;
  city: string | null;
  services: Service[];
  weekly_hours: WeeklyHour[] | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(svc: Service, t: (k: string) => string): string {
  if (svc.price_type === 'quote' || svc.price == null) {
    return t('trade.public.price.quote');
  }
  const sym = svc.currency ?? '';
  const val = Number(svc.price) % 1 === 0
    ? Number(svc.price).toLocaleString('bs-BA')
    : Number(svc.price).toLocaleString('bs-BA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (svc.price_type === 'hourly') {
    return `${t('trade.public.price.from')} ${val} ${sym}/h`;
  }
  return `${t('trade.public.price.from')} ${val} ${sym}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PublicTradeProfilePage() {
  const { businessId } = useParams() as { businessId: string };
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [reviewsData, setReviewsData] = useState<ReviewsData | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await (supabase as any).rpc('get_public_trade_profile', {
        p_business_id: businessId,
      });
      if (data?.ok) {
        setProfile(data.profile);
      } else {
        setError(data?.error ?? 'not_found');
      }
      setLoading(false);

      // Load reviews (non-blocking)
      const { data: rev } = await (supabase as any).rpc('get_business_reviews', {
        p_business_id: businessId,
        p_limit: 10,
      });
      if (rev) setReviewsData(rev as ReviewsData);
    }
    load();
  }, [businessId]);

  useEffect(() => {
    if (!user || !businessId) return;
    (supabase as any).rpc('can_review_business', { p_business_id: businessId })
      .then(({ data }: { data: any }) => {
        if (data?.can_review) setCanReview(true);
      });
    (supabase as any).rpc('get_business_follow_info', { p_business_id: businessId })
      .then(({ data }: { data: any }) => {
        if (data) setIsFollowing(data.is_following ?? false);
      });
  }, [user, businessId]);

  async function handleFollow() {
    if (!user) return;
    setFollowLoading(true);
    const { data } = await (supabase as any).rpc('toggle_business_follow', { p_business_id: businessId });
    setFollowLoading(false);
    if (data?.ok) setIsFollowing(data.is_following);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{t('trade.majstori.empty')}</p>
        <button
          onClick={() => router.push('/booking/majstori')}
          className="text-sm text-primary hover:underline"
        >
          ← {t('trade.majstori.title')}
        </button>
      </div>
    );
  }

  const cc = profile.contact_channels ?? {};

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Back */}
      <div className="border-b border-border bg-card px-4 py-3">
        <button
          onClick={() => router.push('/booking/majstori')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('trade.majstori.title')}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="py-5 flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0 overflow-hidden">
            {profile.logo_url ? (
              <img src={profile.logo_url} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <Wrench className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{profile.name}</h1>
              {reviewsData && reviewsData.total_count > 0 && (
                <span className="flex items-center gap-0.5 text-sm text-amber-600 dark:text-amber-400 font-medium">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {reviewsData.avg_rating} ({reviewsData.total_count})
                </span>
              )}
            </div>
            {profile.business_subtype && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {t(`trade.subtype.${profile.business_subtype}` as Parameters<typeof t>[0])}
              </p>
            )}
            {profile.emergency_enabled && (
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full">
                <Zap className="w-3 h-3" />
                {t('trade.majstori.emergencyAvailable')}
              </span>
            )}
            {(profile.address || profile.city) && (() => {
              const locationLabel = [profile.address, profile.city].filter(Boolean).join(', ');
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationLabel)}`;
              return (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="flex items-start gap-1 text-sm text-muted-foreground mt-1 hover:text-primary transition-colors w-fit"
                >
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {locationLabel}
                </a>
              );
            })()}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {user && (
              <button
                onClick={handleFollow}
                disabled={followLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
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
            <button
              onClick={() => setShareOpen(true)}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border border-border"
              title={t('trade.public.shareProfile')}
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <SharePostModal
          postId={businessId}
          urlPath={`/booking/majstori/${businessId}`}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />

        {/* Weekly hours — collapsible */}
        {profile.weekly_hours && profile.weekly_hours.length > 0 && (
          <section className="mb-5">
            <button
              onClick={() => setHoursExpanded(v => !v)}
              className="flex items-center justify-between w-full text-left group"
            >
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide group-hover:text-foreground transition-colors">
                {t('setup.hours.heading')}
              </h2>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${hoursExpanded ? 'rotate-180' : ''}`} />
            </button>
            {hoursExpanded && (
              <div className="border border-border rounded-xl overflow-hidden bg-card mt-2">
                {[1,2,3,4,5,6,0].map(dow => {
                  const hour = profile.weekly_hours!.find(h => h.day_of_week === dow);
                  return (
                    <div key={dow} className="flex items-center justify-between px-3 py-2 border-b border-border/60 last:border-0">
                      <span className="text-sm text-foreground w-28 shrink-0">
                        {t(`setup.hours.day.${dow}` as Parameters<typeof t>[0])}
                      </span>
                      {!hour || hour.is_closed ? (
                        <span className="text-sm text-muted-foreground">{t('setup.hours.closed')}</span>
                      ) : (
                        <span className="text-sm text-foreground font-medium">
                          {hour.start_time.slice(0, 5)} – {hour.end_time.slice(0, 5)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Contact */}
        {(cc.phone || cc.phone2 || cc.email) && (
          <section className="mb-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {t('trade.public.contact')}
            </h2>
            <div className="flex flex-col gap-2">
              {[cc.phone, cc.phone2].filter(Boolean).map((phone, i) => (
                <span key={i} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Phone className="w-3 h-3 shrink-0" />
                  <a href={`tel:${phone}`} className="hover:text-primary transition-colors">
                    {phone}
                  </a>
                  <a
                    href={`https://wa.me/${phone!.replace(/\D/g, '')}`}
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
                    href={`viber://chat?number=${phone!.replace(/\D/g, '')}`}
                    title="Viber"
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#7B519D]/15 hover:bg-[#7B519D]/30 text-[#7B519D] transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                      <path d="M11.398.008C8.232.022 4.483 1.652 2.38 5.137 1.027 7.418.769 10.162.997 12.63c.218 2.27 1.144 4.5 2.804 6.083 1.62 1.547 4.082 2.61 6.376 2.47l3.906 2.825-.194-3.054c4.32-.427 7.917-3.77 8.101-8.217.14-3.428-1.41-7.108-3.78-9.213C16.437.72 13.95-.008 11.398.008zm.03 1.846c2.218-.012 4.324.625 6.042 2.164 1.987 1.8 3.234 4.993 3.117 7.84-.158 3.747-3.234 6.504-6.924 6.782l.116 1.815-2.323-1.67-.5.035c-2.015.14-4.148-.79-5.575-2.155C3.993 15.53 3.215 13.617 3.03 11.647c-.197-2.1.004-4.354 1.066-6.202C6.044 3.117 8.952 1.866 11.428 1.854zM8.42 5.597c-.24 0-.482.06-.676.212-.193.152-.426.375-.586.619-.217.334-.21.75-.049 1.21.162.462.47.95.813 1.393.537.699 1.08 1.32 1.773 1.893.693.573 1.426 1.015 2.184 1.288.448.16.916.224 1.285.073.37-.151.59-.48.735-.83.178-.426.153-.806-.046-1.047-.198-.241-.571-.434-.867-.578-.296-.146-.591-.278-.858-.226-.266.053-.433.27-.574.484-.141.215-.269.378-.44.417-.17.038-.48-.073-.74-.265-.36-.263-.757-.653-1.098-1.035-.34-.38-.636-.773-.78-1.04-.144-.267-.122-.495-.086-.598.037-.104.155-.24.316-.393.16-.153.349-.32.437-.534.087-.213.05-.51-.11-.814-.161-.305-.42-.621-.714-.816-.294-.195-.578-.213-.72-.213z" />
                    </svg>
                  </a>
                </span>
              ))}
              {cc.email && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="w-3 h-3 shrink-0" />
                  <a href={`mailto:${cc.email}`} className="hover:text-primary transition-colors">
                    {cc.email}
                  </a>
                </span>
              )}
            </div>
          </section>
        )}

        {/* Description */}
        {profile.description && (
          <section className="mb-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {t('trade.public.description')}
            </h2>
            <p className={`text-sm text-foreground leading-relaxed whitespace-pre-wrap ${!descExpanded ? 'line-clamp-2' : ''}`}>
              {profile.description}
            </p>
            {profile.description.length > 120 && (
              <button
                onClick={() => setDescExpanded(v => !v)}
                className="text-xs text-primary font-semibold mt-1"
              >
                {descExpanded ? t('posts.showLess') : t('posts.readMore')}
              </button>
            )}
          </section>
        )}

        {/* Service areas */}
        {profile.service_area_cities.length > 0 && (
          <section className="mb-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {t('trade.public.serviceAreas')}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {profile.service_area_cities.map((c, i) => (
                <span key={i} className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                  {c}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Services */}
        <section className="mb-5">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {t('trade.public.services')}
          </h2>
          {profile.services.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('trade.public.noServices')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {profile.services.map(svc => (
                <div key={svc.id} className="border border-border rounded-xl p-3 bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{svc.name}</p>
                    <span className="text-sm font-semibold text-primary shrink-0 text-right">
                      {formatPrice(svc, t)}
                    </span>
                  </div>
                  {svc.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{svc.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Reviews */}
        <section className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t('booking.reviews.title')}
            </h2>
            {canReview && (
              <button
                onClick={() => setReviewOpen(true)}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                <MessageSquareText className="w-3.5 h-3.5" />
                {t('trade.review.writeReview')}
              </button>
            )}
          </div>

          {!reviewsData || reviewsData.total_count === 0 ? (
            <p className="text-xs text-muted-foreground">{t('booking.reviews.noReviews')}</p>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {(showAllReviews ? reviewsData.reviews : reviewsData.reviews.slice(0, 2)).map(r => (
                  <div key={r.id} className="border border-border rounded-xl p-3 bg-card">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(n => (
                          <Star key={n} className={`w-3 h-3 ${n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-border'}`} />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-foreground">{r.reviewer_name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(r.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
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
        </section>
      </div>

      <TradeReviewModal
        businessId={businessId}
        businessName={profile.name}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onReviewed={() => {
          setCanReview(false);
          // Refresh reviews after submitting
          (supabase as any).rpc('get_business_reviews', { p_business_id: businessId, p_limit: 10 })
            .then(({ data }: { data: any }) => { if (data) setReviewsData(data); });
        }}
      />

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          {profile.emergency_enabled && (
            <button
              onClick={() => router.push(`/booking/majstori/${businessId}/emergency`)}
              className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              {t('trade.public.emergencyBtn')}
            </button>
          )}
          <button
            onClick={() => router.push(`/booking/majstori/${businessId}/request`)}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            {t('trade.public.requestBtn')}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
