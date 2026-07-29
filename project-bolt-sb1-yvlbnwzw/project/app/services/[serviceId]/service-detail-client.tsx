'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { useGuestGate } from '@/lib/contexts/guest-gate-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ProfessionalBadge } from '@/components/professional-badge';
import { ProfessionalCard } from '@/components/professional-card';
import { SendOfferModal } from '@/components/send-offer-modal-v2';
import { ReviewsModal } from '@/components/reviews-modal';
import { SharePostModal } from '@/components/share-post-modal';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, MapPin, MessageCircle, Star, ChevronLeft, ChevronRight, Phone, User, Share2, Edit, Trash2, ImageOff, Calendar } from 'lucide-react';
import { timeAgo } from '@/lib/utils/date';

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
    phone?: string;
    show_phone?: boolean;
  };
  post_media: Array<{
    id: string;
    type: string;
    url: string;
    order: number;
  }>;
};

type Props = {
  serviceId: string;
  initialData: ServiceDetail | null;
};

export function ServiceDetailClient({ serviceId, initialData }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { openGuestGate } = useGuestGate();
  const [service] = useState<ServiceDetail | null>(initialData);
  const [similarServices, setSimilarServices] = useState<ServiceDetail[]>([]);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [creatingThread, setCreatingThread] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recentReviews, setRecentReviews] = useState<Array<{
    id: string;
    rating: number;
    comment: string;
    created_at: string;
    customer: { name: string; avatar_url: string | null };
  }>>([]);

  useEffect(() => {
    if (!initialData) return;
    if (initialData.category) loadSimilarServices(initialData.category, initialData.id);
    if ((initialData.profiles as any)?.account_type === 'professional') {
      loadRecentReviews(initialData.user_id);
    }
  }, []);

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

  const handleDelete = async () => {
    if (!confirm(t('serviceDetail.deleteConfirm'))) return;
    setDeleting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const response = await fetch(`/api/posts?postId=${service?.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success(t('posts.deleteSuccess'));
        router.push('/services');
      } else {
        toast.error(t('posts.deleteError'));
      }
    } catch {
      toast.error(t('posts.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  const loadRecentReviews = async (proId: string) => {
    try {
      const { data } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, customer:profiles!reviews_customer_id_fkey(name, avatar_url)')
        .eq('pro_id', proId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (data) setRecentReviews(data as any);
    } catch (err) {
      console.error('Error loading reviews:', err);
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
      openGuestGate('message');
      return;
    }

    if (!service) return;

    setCreatingThread(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

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
      openGuestGate('contact');
      return;
    }
    setShowOfferModal(true);
  };

  if (!service) {
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
        {/* Sticky header with Back + Share */}
        <div className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 sticky top-0 z-10">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => router.back()}>
              <ChevronLeft className="h-4 w-4" />
              {t('serviceDetail.back')}
            </Button>
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => setShowShareModal(true)}>
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-0">
          <ol className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            <li>
              <Link href="/" className="hover:text-orange-500 transition-colors">
                {t('login.homeLink')}
              </Link>
            </li>
            <li aria-hidden="true" className="text-gray-300 dark:text-gray-600">›</li>
            <li>
              <Link href="/services" className="hover:text-orange-500 transition-colors">
                {t('nav.discover')}
              </Link>
            </li>
            {service.category && (
              <>
                <li aria-hidden="true" className="text-gray-300 dark:text-gray-600">›</li>
                <li>
                  <Link href={`/services?category=${encodeURIComponent(service.category)}`} className="hover:text-orange-500 transition-colors">
                    {service.category}
                  </Link>
                </li>
              </>
            )}
            <li aria-hidden="true" className="text-gray-300 dark:text-gray-600">›</li>
            <li className="text-gray-700 dark:text-gray-200 font-medium truncate max-w-[180px]" aria-current="page">
              {service.profiles.name}
            </li>
          </ol>
        </nav>

        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-8">
            {/* LEFT COLUMN - Image gallery */}
            <div className="w-full max-w-[480px] mx-auto lg:mx-0">
              <div className="relative bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden aspect-square w-full">
                {images.length > 0 ? (
                  <Image
                    fill
                    src={images[selectedImageIndex].url}
                    alt={`${service.job_title} - ${selectedImageIndex + 1}`}
                    className="object-contain"
                    sizes="(max-width: 1024px) 100vw, 480px"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-800 dark:to-gray-700 gap-3">
                    <ImageOff className="h-16 w-16 text-orange-300 dark:text-gray-500" />
                    <span className="text-sm text-orange-400 dark:text-gray-500 font-medium">{t('serviceDetail.noImage')}</span>
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

              {images.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {images.map((media, i) => (
                    <button
                      key={media.id}
                      onClick={() => setSelectedImageIndex(i)}
                      className={`relative flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                        i === selectedImageIndex
                          ? 'border-orange-500'
                          : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <Image
                        fill
                        src={media.url}
                        alt={`Slika ${i + 1}`}
                        className="object-cover"
                        sizes="64px"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2 leading-tight break-words">
                  {service.job_title}
                </h1>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{t('serviceDetail.postedOn')} {format(new Date(service.created_at), 'dd.MM.yyyy.')}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {service.city && (
                  <Link
                    href={`/services?city=${encodeURIComponent(service.city)}`}
                    prefetch={false}
                    className="flex items-center gap-1.5 text-gray-600 dark:text-gray-200 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
                  >
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm font-medium">{service.city}</span>
                  </Link>
                )}
                <Link
                  href={`/services?category=${encodeURIComponent(service.category)}`}
                  prefetch={false}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                >
                  {service.category}
                </Link>
              </div>

              <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                <Link href={`/profile/${service.user_id}`} prefetch={false}>
                  <Avatar className="h-12 w-12 ring-2 ring-gray-200 dark:ring-gray-700 flex-shrink-0 hover:opacity-80 transition-opacity">
                    <AvatarImage src={service.profiles.avatar_url} alt={service.profiles.name} />
                    <AvatarFallback className="bg-orange-500 text-white text-base">
                      {service.profiles.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Link
                      href={`/profile/${service.user_id}`}
                      prefetch={false}
                      className="font-semibold text-gray-900 dark:text-white text-base hover:text-orange-600 dark:hover:text-orange-400 transition-colors truncate"
                    >
                      {service.profiles.name}
                    </Link>
                    {(service.profiles as any).is_premium && (
                      <ProfessionalBadge size="sm" variant="premium" />
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

              {service.text && (
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{t('serviceDetail.description')}</h2>
                  <div className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {service.text}
                  </div>
                </div>
              )}

              <Card className="border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
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

                  {!isOwner && (
                    <div className="space-y-2">
                      <Button
                        size="lg"
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-11 text-base"
                        onClick={handleSendOffer}
                      >
                        {t('serviceDetail.sendOffer')}
                      </Button>

                      <div className="grid grid-cols-2 gap-2">
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

                        {service.profiles?.show_phone && service.profiles?.phone ? (
                          <a
                            href={`tel:${service.profiles.phone}`}
                            className="inline-flex items-center justify-center gap-2 h-11 w-full rounded-md border-2 border-green-500 bg-green-500 hover:bg-green-600 text-white font-semibold text-sm transition-colors"
                          >
                            <Phone className="h-4 w-4" />
                            {t('profile.callUser')}
                          </a>
                        ) : (
                          <Button
                            size="lg"
                            variant="outline"
                            className="w-full gap-2 h-11 border-2 font-semibold"
                            onClick={() => router.push(`/profile/${service.user_id}`)}
                          >
                            <User className="h-4 w-4" />
                            {t('serviceDetail.viewProfile')}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

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

              {service.profiles?.account_type === 'professional' && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      {t('serviceDetail.reviewsSection')}
                      {reviewCount > 0 && (
                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({reviewCount})</span>
                      )}
                    </h2>
                    {reviewCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-orange-600 dark:text-orange-400 hover:text-orange-700 h-auto p-0 text-sm font-medium"
                        onClick={() => setShowReviewsModal(true)}
                      >
                        {t('serviceDetail.seeAllReviews')}
                        <ChevronRight className="h-4 w-4 ml-0.5" />
                      </Button>
                    )}
                  </div>

                  {recentReviews.length === 0 ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400 py-3 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                      {t('serviceDetail.noReviews')}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentReviews.map((review) => (
                        <div key={review.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Avatar className="h-7 w-7 flex-shrink-0">
                              <AvatarImage src={review.customer?.avatar_url || undefined} alt={review.customer?.name || ''} />
                              <AvatarFallback className="bg-orange-100 text-orange-700 text-xs">
                                {review.customer?.name?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm text-gray-900 dark:text-white">{review.customer?.name}</span>
                            <div className="flex ml-auto">
                              {[1,2,3,4,5].map(s => (
                                <Star key={s} className={`h-3.5 w-3.5 ${s <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                              ))}
                            </div>
                          </div>
                          {review.comment && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{review.comment}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {timeAgo(review.created_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isOwner && (
                <div className="rounded-xl border-2 border-dashed border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                      <User className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">{t('serviceDetail.ownerBanner')}</p>
                      <p className="text-xs text-orange-500 dark:text-orange-500">{t('serviceDetail.ownerBannerDesc')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-2 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-400" onClick={() => router.push('/profile')}>
                      <Edit className="h-3.5 w-3.5" />
                      {t('serviceDetail.editListing')}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-2 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400" onClick={handleDelete} disabled={deleting}>
                      {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      {t('serviceDetail.deleteListing')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {similarServices.length > 0 && (
            <div className="mt-10">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t('serviceDetail.similarServices')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {similarServices.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => router.push(`/services/${s.id}`)}
                    className="text-left bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="relative aspect-video bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      {s.post_media?.[0] ? (
                        <Image
                          fill
                          src={s.post_media[0].url}
                          alt={s.job_title}
                          className="object-cover"
                          sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1024px) calc(50vw - 32px), calc(25vw - 32px)"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageOff className="h-8 w-8 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 mb-1">{s.job_title}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <MapPin className="h-3 w-3" />
                        <span>{s.city}</span>
                      </div>
                      {s.profiles?.average_rating > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{s.profiles.average_rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

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

          <SharePostModal
            postId={service.id}
            urlPath={`/services/${service.id}`}
            open={showShareModal}
            onOpenChange={setShowShareModal}
          />
        </>
      )}
    </>
  );
}
