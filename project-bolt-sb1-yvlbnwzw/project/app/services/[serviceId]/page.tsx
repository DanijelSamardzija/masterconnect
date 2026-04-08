'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ProfessionalBadge } from '@/components/professional-badge';
import { ProfessionalCard } from '@/components/professional-card';
import { SendOfferModal } from '@/components/send-offer-modal-v2';
import { ReviewsModal } from '@/components/reviews-modal';
import { toast } from 'sonner';
import { Loader2, MapPin, MessageCircle, Star, ChevronLeft, ChevronRight, DollarSign } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type ServiceDetail = {
  id: string;
  user_id: string;
  text: string;
  job_title: string;
  category: string;
  city: string;
  price_type?: string;
  price_value?: number;
  currency?: string;
  created_at: string;
  profiles: {
    name: string;
    avatar_url?: string;
    account_type?: string;
    average_rating?: number;
    review_count?: number;
  };
  post_media: Array<{
    id: string;
    type: string;
    url: string;
    order: number;
  }>;
};

export default function ServiceDetailPage({ params }: { params: { serviceId: string } }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [similarServices, setSimilarServices] = useState<ServiceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [creatingThread, setCreatingThread] = useState(false);

  useEffect(() => {
    loadService();
  }, [params.serviceId]);

  const loadService = async () => {
    setLoading(true);
    setNotFound(false);

    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          text,
          job_title,
          category,
          city,
          price_type,
          price_value,
          currency,
          created_at,
          profiles (
            name,
            avatar_url,
            account_type,
            average_rating,
            review_count
          ),
          post_media (
            id,
            type,
            url,
            order
          )
        `)
        .eq('id', params.serviceId)
        .eq('post_type', 'service_listing')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setNotFound(true);
        return;
      }

      setService(data as any);

      if (data.category) {
        loadSimilarServices(data.category, data.id);
      }
    } catch (error) {
      console.error('Error loading service:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const loadSimilarServices = async (category: string, currentServiceId: string) => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          text,
          job_title,
          category,
          city,
          price_type,
          price_value,
          currency,
          created_at,
          profiles (
            name,
            avatar_url,
            account_type,
            average_rating,
            review_count
          ),
          post_media (
            id,
            type,
            url,
            order
          )
        `)
        .eq('post_type', 'service_listing')
        .eq('is_active', true)
        .eq('category', category)
        .neq('id', currentServiceId)
        .order('created_at', { ascending: false })
        .limit(4);

      if (error) throw error;

      setSimilarServices((data as any) || []);
    } catch (error) {
      console.error('Error loading similar services:', error);
    }
  };

  const getPriceDisplay = () => {
    if (!service?.price_type) return null;

    if (service.price_type === 'negotiable') {
      return t('serviceDetail.negotiable');
    }

    const currency = service.currency || 'RSD';

    if (service.price_type === 'hourly' && service.price_value) {
      return `${service.price_value.toFixed(0)} ${currency}/h`;
    }

    if (service.price_type === 'fixed' && service.price_value) {
      return `${service.price_value.toFixed(0)} ${currency}`;
    }

    return null;
  };

  const handleSendMessage = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (!service) return;

    setCreatingThread(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/messages/create-direct-thread', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'x-access-token': session.access_token,
        },
        body: JSON.stringify({
          targetUserId: service.user_id,
        }),
      });

      const data = await response.json();

      if (response.ok && data.threadId) {
        router.push(`/messages/${data.threadId}`);
      } else {
        toast.error(data.error || 'Greška pri otvaranju poruka');
      }
    } catch (error) {
      toast.error('Greška pri otvaranju poruka');
    } finally {
      setCreatingThread(false);
    }
  };

  const handleSendOffer = () => {
    if (!user) {
      router.push('/login');
      return;
    }
    setShowOfferModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-8 w-1/2 mb-8" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (notFound || !service) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8">{t('serviceDetail.notFound')}</p>
          <Button onClick={() => router.push('/services')}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t('serviceDetail.backToDiscover')}
          </Button>
        </div>
      </div>
    );
  }

  const images = service.post_media?.filter(m => m.type === 'image') ?? [];
  const hasRating = service.profiles?.average_rating && service.profiles.average_rating > 0;
  const reviewCount = service.profiles?.review_count || 0;
  const isOwner = user?.id === service.user_id;

  const goToPrev = () => setSelectedImageIndex(i => (i - 1 + images.length) % images.length);
  const goToNext = () => setSelectedImageIndex(i => (i + 1) % images.length);

  return (
    <>
      <div className="bg-gray-50 dark:bg-gray-950 pb-24">
        {/* Back Button - Fixed Position */}
        <div className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 sticky top-0 z-10">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => router.back()}
            >
              <ChevronLeft className="h-4 w-4" />
              {t('serviceDetail.back')}
            </Button>
          </div>
        </div>

        {/* Main Content Container - Fixed Max Width 1200px */}
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Desktop: 45/55 Grid | Mobile: Stack Vertically */}
          <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-8">
            {/* LEFT COLUMN - Image gallery */}
            <div className="w-full max-w-[480px] mx-auto lg:mx-0">
              {/* Main image with arrows */}
              <div className="relative bg-gray-200 dark:bg-gray-800 rounded-xl overflow-hidden aspect-square w-full">
                {images.length > 0 ? (
                  <img
                    src={images[selectedImageIndex].url}
                    alt={`${service.job_title} - ${selectedImageIndex + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-800">
                    <span className="text-6xl">🔧</span>
                  </div>
                )}

                {images.length > 1 && (
                  <>
                    <button
                      onClick={goToPrev}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={goToNext}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedImageIndex(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${i === selectedImageIndex ? 'bg-white' : 'bg-white/50'}`}
                          aria-label={`Go to image ${i + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {images.map((media, i) => (
                    <button
                      key={media.id}
                      onClick={() => setSelectedImageIndex(i)}
                      className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                        i === selectedImageIndex
                          ? 'border-orange-500'
                          : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <img
                        src={media.url}
                        alt={`Thumbnail ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN - Title → Location → Provider → Rating → Description → Price → CTA */}
            <div className="space-y-4">
              {/* Title */}
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-3 leading-tight">
                  {service.job_title}
                </h1>
              </div>

              {/* Location & Category */}
              <div className="flex flex-wrap items-center gap-2">
                {service.city && (
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-200">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm font-medium">{service.city}</span>
                  </div>
                )}

                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
                  {service.category}
                </span>
              </div>

              {/* Provider Info */}
              <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                <Avatar className="h-12 w-12 ring-2 ring-gray-200 dark:ring-gray-700 flex-shrink-0">
                  <AvatarImage src={service.profiles.avatar_url} alt={service.profiles.name} />
                  <AvatarFallback className="bg-orange-500 text-white text-base">
                    {service.profiles.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <button
                      onClick={() => router.push(`/profile/${service.user_id}`)}
                      className="font-semibold text-gray-900 dark:text-white text-base hover:text-orange-600 dark:hover:text-orange-400 transition-colors truncate"
                    >
                      {service.profiles.name}
                    </button>
                    {service.profiles.account_type === 'professional' && (
                      <ProfessionalBadge size="sm" />
                    )}
                  </div>

                  {hasRating ? (
                    <button
                      onClick={() => setShowReviewsModal(true)}
                      className="flex items-center gap-1.5 hover:underline text-left"
                    >
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                      <span className="font-semibold text-gray-900 dark:text-gray-200 text-sm">
                        {service.profiles.average_rating?.toFixed(1)}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-sm">
                        ({reviewCount} {reviewCount === 1 ? t('serviceDetail.review') : t('serviceDetail.reviews')})
                      </span>
                    </button>
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400">{t('serviceDetail.newProfile')}</div>
                  )}
                </div>
              </div>

              {/* Short Description */}
              {service.text && (
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{t('serviceDetail.description')}</h2>
                  <div className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {service.text}
                  </div>
                </div>
              )}

              {/* Price Card - Compact, Inline in Right Column */}
              <Card className="border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    {/* Price Display - Reduced Size */}
                    {getPriceDisplay() && (
                      <div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none mb-1">
                          {getPriceDisplay()}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                          {service.price_type === 'hourly' ? t('serviceDetail.priceType.hourly') : service.price_type === 'fixed' ? t('serviceDetail.priceType.fixed') : t('serviceDetail.priceType.negotiable')}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CTA Buttons - Compact */}
                  {!isOwner && (
                    <div className="space-y-2">
                      <Button
                        size="lg"
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-11 text-base"
                        onClick={handleSendOffer}
                      >
                        {t('serviceDetail.sendOffer')}
                      </Button>

                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full gap-2 h-11 border-2 font-semibold"
                        onClick={handleSendMessage}
                        disabled={creatingThread}
                      >
                        {creatingThread ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MessageCircle className="h-4 w-4" />
                        )}
                        {t('serviceDetail.sendMessage')}
                      </Button>
                    </div>
                  )}

                  {/* Trust Indicators - Compact */}
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex flex-col items-center text-center">
                      <svg className="h-4 w-4 text-green-600 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-[10px] leading-tight">{t('serviceDetail.trustIndicator1')}</span>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <svg className="h-4 w-4 text-green-600 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-[10px] leading-tight">{t('serviceDetail.trustIndicator2')}</span>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <svg className="h-4 w-4 text-green-600 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-[10px] leading-tight">{t('serviceDetail.trustIndicator3')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Offer Modal */}
      {service && (
        <>
          <SendOfferModal
            open={showOfferModal}
            onOpenChange={setShowOfferModal}
            postId={service.id}
            receiverId={service.user_id}
            receiverName={service.profiles.name}
          />

          <ReviewsModal
            open={showReviewsModal}
            onOpenChange={setShowReviewsModal}
            proId={service.user_id}
            proName={service.profiles.name}
            averageRating={service.profiles.average_rating}
            reviewCount={service.profiles.review_count}
          />
        </>
      )}
    </>
  );
}
