'use client';

import { Star, MapPin, ArrowRight } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ProfessionalBadge } from '@/components/professional-badge';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { isOnline } from '@/lib/online-status';

type ProfessionalCardProps = {
  listing: {
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
      last_seen?: string;
      is_premium?: boolean;
    };
    post_media: Array<{
      id: string;
      type: string;
      url: string;
      order: number;
    }>;
  };
};

export function ProfessionalCard({ listing }: ProfessionalCardProps) {
  const router = useRouter();
  const { t } = useLanguage();

  const mainImage = listing.post_media?.[0]?.url;
  const hasRating = listing.profiles?.average_rating && listing.profiles.average_rating > 0;
  const reviewCount = listing.profiles?.review_count || 0;

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  };

  const truncateText = (text: string, maxLines: number = 2) => {
    const lines = text.split('\n');
    if (lines.length > maxLines) {
      return lines.slice(0, maxLines).join('\n') + '...';
    }
    return text;
  };

  const getPriceDisplay = () => {
    if (!listing.price_type) return null;

    if (listing.price_type === 'negotiable') {
      return 'Po dogovoru';
    }

    const currency = listing.currency || 'RSD';

    if (listing.price_type === 'hourly' && listing.price_value) {
      return `${listing.price_value.toFixed(0)} ${currency}/h`;
    }

    if (listing.price_type === 'fixed' && listing.price_value) {
      return `${listing.price_value.toFixed(0)} ${currency}`;
    }

    return null;
  };

  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group flex flex-col h-full"
      onClick={() => router.push(`/services/${listing.id}`)}
    >
      <div className="relative w-full aspect-square max-h-[280px] bg-gray-200 overflow-hidden">
        {mainImage ? (
          <img
            src={mainImage}
            alt={listing.job_title}
            className="w-full h-full object-cover rounded-t-xl group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <span className="text-4xl text-gray-400">🔧</span>
          </div>
        )}
      </div>

      <CardContent className="p-2.5 md:p-4 flex flex-col flex-1">
        <div className="mb-1.5 md:mb-2">
          {/* User Info at Top */}
          <div className="flex items-center gap-2 mb-2">
            <div className="relative shrink-0">
              <Avatar
                className="h-9 w-9 cursor-pointer ring-2 ring-gray-100"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/profile/${listing.user_id}`);
                }}
              >
                <AvatarImage src={listing.profiles.avatar_url} alt={listing.profiles.name} />
                <AvatarFallback className="bg-orange-500 text-white text-sm">
                  {listing.profiles.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isOnline(listing.profiles.last_seen) && (
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-card" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  className="text-sm font-semibold text-gray-900 dark:text-white hover:text-orange-600 dark:hover:text-orange-400 transition-colors truncate"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/profile/${listing.user_id}`);
                  }}
                >
                  {listing.profiles.name}
                </button>
                {listing.profiles.is_premium && <ProfessionalBadge size="sm" variant="premium" />}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatTimeAgo(listing.created_at)}
              </p>
            </div>
          </div>

          {/* Job Title */}
          <h3 className="font-bold text-base md:text-lg text-gray-900 dark:text-gray-100 mb-1 md:mb-1.5 line-clamp-1">
            {listing.job_title || 'Usluga'}
          </h3>

          {/* Category • City in one line */}
          <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-gray-600 dark:text-gray-300 mb-1 md:mb-1.5">
            {listing.category && (
              <span className="inline-flex items-center px-2 md:px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                {listing.category}
              </span>
            )}
            {listing.city && (
              <>
                {listing.category && <span className="text-gray-400">•</span>}
                <span className="truncate">{listing.city}</span>
              </>
            )}
          </div>
        </div>

        {/* Rating */}
        {hasRating ? (
          <div className="flex items-center gap-1 md:gap-1.5 text-xs md:text-sm mb-1 md:mb-1.5">
            <Star className="h-3.5 w-3.5 md:h-4 md:w-4 fill-yellow-400 text-yellow-400 flex-shrink-0" />
            <span className="font-semibold text-gray-900 dark:text-gray-200">
              {listing.profiles.average_rating?.toFixed(1)}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              ({reviewCount})
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 md:gap-1.5 text-xs md:text-sm text-gray-600 dark:text-gray-300 mb-1 md:mb-1.5">
            <span>⭐</span>
            <span>{t('professional.newProfile')}</span>
          </div>
        )}

        {listing.text && (
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 mb-1.5 md:mb-2 line-clamp-1 md:line-clamp-2">
            {listing.text}
          </p>
        )}

        {getPriceDisplay() && (
          <div className="mb-1.5 md:mb-2 pb-1.5 md:pb-2 border-t pt-1.5 md:pt-2">
            <div className="flex items-center justify-center gap-1.5 md:gap-2">
              <span className="text-base md:text-xl">💰</span>
              <span className="text-base md:text-lg font-bold text-[#222] dark:text-gray-200">
                {getPriceDisplay()}
              </span>
            </div>
          </div>
        )}

        <div className="mt-auto">
        <Button
          size="sm"
          className="w-full bg-orange-600 hover:bg-orange-700 text-white group/btn h-8 md:h-9 text-xs md:text-sm"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/services/${listing.id}`);
          }}
        >
          {t('services.viewService')}
          <ArrowRight className="ml-1.5 md:ml-2 h-3.5 w-3.5 md:h-4 md:w-4 group-hover/btn:translate-x-1 transition-transform" />
        </Button>
        </div>
      </CardContent>
    </Card>
  );
}
