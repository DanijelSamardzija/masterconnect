'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { createReviewSubmittedMessage } from '@/lib/system-messages';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';

type ReviewModalProps = {
  open: boolean;
  onClose: () => void;
  jobId?: string;
  proId: string;
  proName: string;
  threadId?: string;
  onSuccess?: () => void;
};

export function ReviewModal({ open, onClose, jobId, proId, proName, threadId, onSuccess }: ReviewModalProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [existingReviewId, setExistingReviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExistingReview = async () => {
      if (!open || !user) {
        setLoading(false);
        return;
      }

      try {
        const { data: existingReview } = await supabase
          .from('reviews')
          .select('id, rating, comment')
          .eq('customer_id', user.id)
          .eq('pro_id', proId)
          .maybeSingle();

        if (existingReview) {
          setExistingReviewId(existingReview.id);
          setRating(existingReview.rating);
          setComment(existingReview.comment || '');
        } else {
          setExistingReviewId(null);
          setRating(0);
          setComment('');
        }
      } catch (err) {
        console.error('Error loading existing review:', err);
      } finally {
        setLoading(false);
      }
    };

    loadExistingReview();
  }, [open, user, proId]);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (!user) {
        setError('You must be logged in to submit a review');
        setSubmitting(false);
        return;
      }

      if (user.id === proId) {
        setError('You cannot review yourself');
        return;
      }

      const { data: threadCheck } = await supabase
        .from('thread_participants')
        .select('thread_id, deleted_at')
        .eq('user_id', user.id);

      const { data: proThreadCheck } = await supabase
        .from('thread_participants')
        .select('thread_id, deleted_at')
        .eq('user_id', proId);

      const commonThreads = threadCheck?.filter((t1: any) =>
        proThreadCheck?.some((t2: any) => t2.thread_id === t1.thread_id)
      );

      if (!commonThreads || commonThreads.length === 0) {
        setError('You must have a conversation with this professional before leaving a review');
        return;
      }

      let hasValidMessages = false;

      for (const commonThread of commonThreads) {
        const customerParticipant = threadCheck?.find((t: any) => t.thread_id === commonThread.thread_id);
        const proParticipant = proThreadCheck?.find((t: any) => t.thread_id === commonThread.thread_id);

        const customerHiddenAt = customerParticipant?.deleted_at;
        const proHiddenAt = proParticipant?.deleted_at;

        let customerQuery = supabase
          .from('messages')
          .select('id')
          .eq('thread_id', commonThread.thread_id)
          .eq('sender_id', user.id)
          .eq('is_system', false)
          .eq('is_deleted', false);

        if (customerHiddenAt) {
          customerQuery = customerQuery.gt('created_at', customerHiddenAt);
        }

        const { data: customerMessages } = await customerQuery.limit(1);

        let proQuery = supabase
          .from('messages')
          .select('id')
          .eq('thread_id', commonThread.thread_id)
          .eq('sender_id', proId)
          .eq('is_system', false)
          .eq('is_deleted', false);

        if (proHiddenAt) {
          proQuery = proQuery.gt('created_at', proHiddenAt);
        }

        const { data: proMessages } = await proQuery.limit(1);

        if (customerMessages && customerMessages.length > 0 && proMessages && proMessages.length > 0) {
          hasValidMessages = true;
          break;
        }
      }

      if (!hasValidMessages) {
        setError('You must exchange messages with this professional before leaving a review');
        return;
      }

      if (existingReviewId) {
        const { error: updateError } = await supabase
          .from('reviews')
          .update({
            rating,
            comment: comment.trim() || '',
          })
          .eq('id', existingReviewId);

        if (updateError) {
          setError('Failed to update review');
          console.error('Review update error:', updateError);
          return;
        }
      } else {
        const { error: insertError } = await supabase
          .from('reviews')
          .insert({
            customer_id: user.id,
            pro_id: proId,
            rating,
            comment: comment.trim() || '',
            job_id: null,
          });

        if (insertError) {
          if (insertError.code === '23505') {
            setError('You have already reviewed this professional');
          } else {
            setError('Failed to create review');
          }
          console.error('Review creation error:', insertError);
          return;
        }

        // Send notification to the professional
        const { data: reviewerProfile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .maybeSingle();
        const reviewerName = reviewerProfile?.name || 'Neko';
        const stars = '⭐'.repeat(rating);
        await supabase.from('notifications').insert({
          user_id: proId,
          type: 'new_review',
          action_type: 'new_review',
          title: language === 'sr'
            ? `${reviewerName} vam je ostavio/la recenziju ${stars}`
            : `${reviewerName} left you a review ${stars}`,
          body: comment.trim() || '',
          meta: { actor_name: reviewerName, rating, reviewer_id: user.id },
        });
      }

      if (threadId) {
        await createReviewSubmittedMessage(threadId, language);
      }

      if (onSuccess) {
        onSuccess();
      }

      setRating(0);
      setComment('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setRating(0);
      setComment('');
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existingReviewId ? 'Edit Your Review' : 'Review'} {proName}</DialogTitle>
          <DialogDescription>
            {existingReviewId
              ? 'Update your review and rating for this professional.'
              : 'How was your experience with this Pro? Your feedback helps others make informed decisions.'
            }
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Loading...
          </div>
        ) : (
          <div className="space-y-4 py-4">
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-medium">Rate your experience</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHoveredRating(value)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                  disabled={submitting}
                >
                  <Star
                    className={`h-8 w-8 ${
                      value <= (hoveredRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-slate-600">
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="comment" className="text-sm font-medium">
              Share your experience (optional)
            </label>
            <Textarea
              id="comment"
              placeholder="Tell others about your experience with this Pro..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              disabled={submitting}
              maxLength={1000}
            />
            <p className="text-xs text-slate-500">{comment.length}/1000 characters</p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
              {error}
            </div>
          )}
        </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={submitting || loading}
          >
            {existingReviewId ? 'Cancel' : 'Skip for now'}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || rating === 0 || loading}
          >
            {submitting ? (existingReviewId ? 'Updating...' : 'Submitting...') : (existingReviewId ? 'Update Review' : 'Submit Review')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
