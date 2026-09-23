'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import {
  Wrench, MapPin, Zap, Phone, MessageSquare, Loader2,
  ChevronLeft, ChevronRight, AlertCircle, Share2, Star, MessageSquareText,
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

type Profile = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  contact_channels: Record<string, string> | null;
  emergency_enabled: boolean;
  service_area_cities: string[];
  business_subtype: string | null;
  city: string | null;
  services: Service[];
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
  }, [user, businessId]);

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
            {profile.city && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />
                {profile.city}
              </p>
            )}
            {profile.emergency_enabled && (
              <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full">
                <Zap className="w-3 h-3" />
                {t('trade.majstori.emergencyAvailable')}
              </span>
            )}
          </div>
          <button
            onClick={() => setShareOpen(true)}
            className="shrink-0 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title={t('trade.public.shareProfile')}
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        <SharePostModal
          postId={businessId}
          urlPath={`/booking/majstori/${businessId}`}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />

        {/* Description */}
        {profile.description && (
          <section className="mb-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {t('trade.public.description')}
            </h2>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {profile.description}
            </p>
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

        {/* Contact */}
        {(cc.phone || cc.whatsapp || cc.viber) && (
          <section className="mb-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {t('trade.public.contact')}
            </h2>
            <div className="flex flex-col gap-2">
              {cc.phone && (
                <a href={`tel:${cc.phone}`} className="flex items-center gap-2.5 text-sm text-primary hover:underline">
                  <Phone className="w-4 h-4" />
                  {cc.phone}
                </a>
              )}
              {cc.whatsapp && (
                <a href={`https://wa.me/${cc.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2.5 text-sm text-green-600 hover:underline">
                  <MessageSquare className="w-4 h-4" />
                  WhatsApp
                </a>
              )}
              {cc.viber && (
                <a href={`viber://chat?number=${cc.viber.replace(/\D/g, '')}`}
                  className="flex items-center gap-2.5 text-sm text-purple-600 hover:underline">
                  <MessageSquare className="w-4 h-4" />
                  Viber
                </a>
              )}
            </div>
          </section>
        )}

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
