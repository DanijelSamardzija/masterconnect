'use client';

import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

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

type PostReviewsProps = {
  proId: string;
  initialReviewCount?: number;
};

export function PostReviews({ proId, initialReviewCount = 0 }: PostReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (initialReviewCount > 0) {
      loadReviews();
    }
  }, [proId, initialReviewCount]);

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

  if (initialReviewCount === 0) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-3 border-t pt-4">
        <div className="text-sm text-slate-500 flex items-center gap-2">
          <div className="h-4 w-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
          Loading reviews...
        </div>
      </div>
    );
  }

  if (reviews.length === 0) {
    return null;
  }

  const displayedReviews = showAll ? reviews : reviews.slice(0, 2);

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          Reviews ({reviews.length})
        </h4>
        {reviews.length > 2 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-sm h-8 px-3 hover:bg-slate-100"
          >
            {showAll ? 'Show less' : `View all ${reviews.length}`}
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {displayedReviews.map((review) => (
          <div key={review.id} className="bg-slate-50 rounded-lg p-4 space-y-3 border border-slate-200">
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
                  <p className="text-sm font-semibold text-slate-900">
                    {review.customer.name}
                  </p>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < review.rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'fill-slate-200 text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            {review.comment && (
              <p className="text-sm text-slate-700 leading-relaxed">
                {review.comment}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
