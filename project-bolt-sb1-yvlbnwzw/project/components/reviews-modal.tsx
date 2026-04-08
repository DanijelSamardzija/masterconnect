'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/lib/contexts/language-context';

type Review = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  customer: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
};

type ReviewsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proId: string;
  proName: string;
  averageRating?: number;
  reviewCount?: number;
};

export function ReviewsModal({
  open,
  onOpenChange,
  proId,
  proName,
  averageRating = 0,
  reviewCount = 0
}: ReviewsModalProps) {
  const { t } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && proId) {
      loadReviews();
    }
  }, [open, proId]);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/reviews?pro_id=${proId}`);
      const data = await response.json();

      if (response.ok) {
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {t('reviewsModal.title')} {proName}
          </DialogTitle>
          {averageRating > 0 && (
            <div className="flex items-center gap-2 pt-2">
              <div className="flex items-center gap-1">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {averageRating.toFixed(1)}
                </span>
              </div>
              <span className="text-gray-600 dark:text-gray-400">
                ({reviewCount} {reviewCount === 1 ? t('reviewsModal.review') : t('reviewsModal.reviews')})
              </span>
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {t('reviewsModal.noReviews')}
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      {review.customer.avatar_url ? (
                        <AvatarImage src={review.customer.avatar_url} alt={review.customer.name} />
                      ) : (
                        <AvatarFallback className="bg-orange-600 text-white text-sm font-medium">
                          {review.customer.name?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {review.customer.name}
                        </p>
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3.5 w-3.5 ${
                                i < review.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'fill-gray-200 text-gray-200 dark:fill-gray-600 dark:text-gray-600'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
