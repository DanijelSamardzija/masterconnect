'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import {
  Clock, CheckCircle, XCircle, Loader2, AlertCircle,
  ChevronLeft, RefreshCw, Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { TradeReviewModal } from '@/components/trade/TradeReviewModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestStatus = 'open' | 'quoted' | 'accepted' | 'completed' | 'cancelled' | 'declined';

type TrackingRequest = {
  id: string;
  title: string;
  description: string | null;
  status: RequestStatus;
  client_name: string | null;
  client_phone: string | null;
  address: string | null;
  city: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  created_at: string;
  status_updated_at: string | null;
  business_name: string;
  business_id: string;
};

type TrackingQuote = {
  id: string;
  price_amount: number | null;
  price_type: string | null;
  price_max: number | null;
  price_currency: string | null;
  duration_estimate: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  message: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
};

const STATUS_COLORS: Record<RequestStatus, string> = {
  open:      'bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-400',
  quoted:    'bg-blue-100   text-blue-800   dark:bg-blue-900/30   dark:text-blue-400',
  accepted:  'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400',
  completed: 'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400',
  cancelled: 'bg-muted      text-muted-foreground',
  declined:  'bg-muted      text-muted-foreground',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrackingPage() {
  const { token } = useParams() as { token: string };
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useAuth();

  const [request, setRequest] = useState<TrackingRequest | null>(null);
  const [quote, setQuote] = useState<TrackingQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [acting, setActing] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any).rpc('get_request_by_token', {
      p_token: token,
    });
    if (data?.ok) {
      setRequest(data.request);
      setQuote(data.quote ?? null);
    } else {
      setNotFound(true);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!user || !request?.business_id || request.status !== 'completed') return;
    (supabase as any).rpc('can_review_business', { p_business_id: request.business_id })
      .then(({ data }: { data: any }) => { if (data?.can_review) setCanReview(true); });
  }, [user, request?.business_id, request?.status]);

  async function respondToQuote(quoteId: string, action: 'accepted' | 'rejected') {
    setActing(true);
    const { data } = await (supabase as any).rpc('respond_to_quote_by_token', {
      p_token:    token,
      p_quote_id: quoteId,
      p_action:   action,
    });
    if (data?.ok) {
      toast.success(
        action === 'accepted'
          ? t('trade.request.tracking.acceptedSuccess')
          : t('trade.request.tracking.rejectedSuccess'),
      );
      load();
    } else {
      toast.error(data?.error ?? 'error');
    }
    setActing(false);
  }

  function formatPrice(q: TrackingQuote) {
    if (q.price_amount == null) return null;
    const cur = q.price_currency ?? '';
    if (q.price_type === 'range' && q.price_max != null) {
      return `${q.price_amount}–${q.price_max} ${cur}`;
    }
    if (q.price_type === 'hourly') {
      return `${q.price_amount} ${cur}/h`;
    }
    return `${q.price_amount} ${cur}`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('trade.request.tracking.loading')}</p>
      </div>
    );
  }

  if (notFound || !request) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-4 text-center">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{t('trade.request.tracking.notFound')}</p>
        <button
          onClick={() => router.push('/booking/majstori')}
          className="text-sm text-primary hover:underline"
        >
          {t('trade.majstori.title')}
        </button>
      </div>
    );
  }

  const statusKey = `trade.request.tracking.${request.status}` as Parameters<typeof t>[0];

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Back */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => router.push(`/booking/majstori/${request.business_id}`)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {request.business_name}
        </button>
        <button
          onClick={load}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-foreground">{t('trade.request.tracking.title')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{request.business_name}</p>
          </div>
          <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[request.status]}`}>
            {t(statusKey)}
          </span>
        </div>

        {/* Request details */}
        <div className="border border-border rounded-2xl bg-card p-4 mb-4">
          <p className="text-sm font-semibold text-foreground mb-1">{request.title}</p>
          {request.description && (
            <p className="text-sm text-muted-foreground mb-2 leading-relaxed">{request.description}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
            {request.address && <span>{request.address}</span>}
            {request.city && <span>{request.city}</span>}
            {request.preferred_date && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {request.preferred_date}
                {request.preferred_time ? ` · ${request.preferred_time}` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Quote */}
        {quote && (
          <div className={`border rounded-2xl p-4 mb-4 ${
            quote.status === 'pending'
              ? 'border-primary/40 bg-primary/5'
              : 'border-border bg-card'
          }`}>
            <h2 className="text-sm font-semibold text-foreground mb-3">{t('trade.request.tracking.quote')}</h2>

            <div className="flex flex-col gap-2 text-sm">
              {formatPrice(quote) && (
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground">{t('trade.request.tracking.quotePrice')}</span>
                  <span className="font-bold text-foreground text-base">{formatPrice(quote)}</span>
                </div>
              )}
              {quote.duration_estimate && (
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground">{t('trade.request.tracking.quoteDuration')}</span>
                  <span className="text-foreground">{quote.duration_estimate}</span>
                </div>
              )}
              {quote.scheduled_date && (
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground">{t('trade.request.tracking.quoteDate')}</span>
                  <span className="text-foreground">
                    {quote.scheduled_date}
                    {quote.scheduled_time ? ` · ${quote.scheduled_time}` : ''}
                  </span>
                </div>
              )}
              {quote.message && (
                <div className="mt-1 pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-0.5">{t('trade.request.tracking.quoteMessage')}</p>
                  <p className="text-sm text-foreground">{quote.message}</p>
                </div>
              )}
            </div>

            {/* Accept / reject — only if quote is pending */}
            {quote.status === 'pending' && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => respondToQuote(quote.id, 'accepted')}
                  disabled={acting}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  {t('trade.request.tracking.acceptQuote')}
                </button>
                <button
                  onClick={() => respondToQuote(quote.id, 'rejected')}
                  disabled={acting}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  {t('trade.request.tracking.rejectQuote')}
                </button>
              </div>
            )}

            {quote.status === 'accepted' && (
              <div className="mt-3 flex items-center gap-2 text-green-600 dark:text-green-400 text-xs font-medium">
                <CheckCircle className="w-4 h-4" />
                {t('trade.request.tracking.accepted')}
              </div>
            )}
            {quote.status === 'rejected' && (
              <div className="mt-3 flex items-center gap-2 text-muted-foreground text-xs">
                <XCircle className="w-4 h-4" />
                {t('trade.request.tracking.declined')}
              </div>
            )}
          </div>
        )}

        {/* No quote yet */}
        {!quote && request.status === 'open' && (
          <div className="border border-dashed border-border rounded-2xl p-6 text-center">
            <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t('trade.request.tracking.open')}</p>
          </div>
        )}

        {/* Review prompt — shown when job completed and user can review */}
        {canReview && request.status === 'completed' && (
          <div className="border border-amber-200 dark:border-amber-800 rounded-2xl p-4 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-semibold text-foreground">{t('trade.review.prompt')}</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{request.business_name}</p>
            <button
              onClick={() => setReviewOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors"
            >
              {t('trade.review.writeReview')}
            </button>
          </div>
        )}
      </div>

      {request && (
        <TradeReviewModal
          businessId={request.business_id}
          businessName={request.business_name}
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          onReviewed={() => setCanReview(false)}
        />
      )}
    </div>
  );
}
