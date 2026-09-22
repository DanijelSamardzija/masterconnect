'use client';

import { useState } from 'react';
import { X, Star, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/contexts/language-context';
import { supabase } from '@/lib/supabase/client';

type Props = {
  businessId: string;
  businessName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewed: () => void;
};

export function TradeReviewModal({ businessId, businessName, open, onOpenChange, onReviewed }: Props) {
  const { t } = useLanguage();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit() {
    if (rating === 0) return;
    setSubmitting(true);
    const { data } = await (supabase as any).rpc('create_trade_review', {
      p_business_id: businessId,
      p_rating:      rating,
      p_comment:     comment.trim() || null,
    });
    setSubmitting(false);
    if (data?.ok) {
      toast.success(t('trade.review.submitted'));
      onReviewed();
      onOpenChange(false);
    } else {
      const errKey = data?.error === 'already_reviewed'
        ? 'trade.review.alreadyReviewed'
        : data?.error === 'no_contact'
          ? 'trade.review.noContact'
          : 'common.error.generic';
      toast.error(t(errKey as Parameters<typeof t>[0]));
    }
  }

  const display = hovered || rating;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-200">
        <div className="bg-background border border-border rounded-t-3xl overflow-hidden shadow-2xl">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-foreground font-semibold text-base">{t('trade.review.title')}</span>
            <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 pb-8 flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{businessName}</p>

            {/* Star rating */}
            <div className="flex gap-1.5 justify-center">
              {[1,2,3,4,5].map(n => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      n <= display
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-border'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Comment */}
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={t('trade.review.commentPh')}
              rows={3}
              maxLength={1000}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
            />

            <button
              onClick={handleSubmit}
              disabled={rating === 0 || submitting}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('trade.review.submit')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
