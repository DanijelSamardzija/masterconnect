'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, Loader2, CalendarDays, Timer, MessageSquare, Briefcase, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';

type Offer = {
  id: string;
  sender_id: string;
  receiver_id: string;
  offer_type?: string;
  price: number;
  currency: string;
  price_type?: string;
  estimated_start: string | null;
  duration_deadline: string | null;
  note: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at: string | null;
};

type OfferCardProps = {
  offer: Offer;
  currentUserId: string;
  onStatusChange?: (newStatus: 'accepted' | 'declined') => void;
};

export function OfferCard({ offer, currentUserId, onStatusChange }: OfferCardProps) {
  const { t } = useLanguage();
  const [responding, setResponding] = useState(false);
  const [localStatus, setLocalStatus] = useState(offer.status);

  const isReceiver = currentUserId === offer.receiver_id;
  const canRespond = isReceiver && localStatus === 'pending';
  const isService = offer.offer_type === 'service';

  const handleRespond = async (action: 'accept' | 'decline') => {
    setResponding(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.error('Not authenticated'); return; }

      const response = await fetch('/api/offers/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Supabase-Token': session.access_token,
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ offerId: offer.id, action }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed');

      const newStatus = action === 'accept' ? 'accepted' : 'declined';
      setLocalStatus(newStatus);
      toast.success(action === 'accept' ? t('offer.card.accepted') : t('offer.card.declined'));
      onStatusChange?.(newStatus);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to respond');
    } finally {
      setResponding(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const priceDisplay = offer.price_type === 'per_hour'
    ? `${offer.price.toLocaleString()} ${offer.currency}/h`
    : `${offer.price.toLocaleString()} ${offer.currency}`;

  return (
    <div className="w-64 sm:w-72 rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">

      {/* Header */}
      <div className="bg-slate-900 dark:bg-slate-800 px-4 pt-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full">
            {isService
              ? <><Wrench className="h-3 w-3" />{t('offer.card.serviceOffer')}</>
              : <><Briefcase className="h-3 w-3" />{t('offer.card.jobOffer')}</>
            }
          </span>
          <StatusBadge status={localStatus} t={t} />
        </div>
        <p className="text-2xl font-bold text-white">{priceDisplay}</p>
      </div>

      {/* Body */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {offer.estimated_start && (
          <div className="px-4 py-2.5 flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-20 flex-shrink-0">{t('offer.card.startDate')}</span>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{formatDate(offer.estimated_start)}</span>
          </div>
        )}
        {offer.duration_deadline && (
          <div className="px-4 py-2.5 flex items-center gap-2">
            <Timer className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-20 flex-shrink-0">{t('offer.card.duration')}</span>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{offer.duration_deadline}</span>
          </div>
        )}
        {offer.note && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare className="h-3 w-3 text-slate-400" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t('offer.card.message')}</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{offer.note}</p>
          </div>
        )}

        {/* Actions */}
        <div className="px-4 py-3">
          {canRespond && (
            <div className="flex gap-2">
              <button
                onClick={() => handleRespond('accept')}
                disabled={responding}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {responding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {t('offer.card.accept')}
              </button>
              <button
                onClick={() => handleRespond('decline')}
                disabled={responding}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {responding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                {t('offer.card.decline')}
              </button>
            </div>
          )}
          {!canRespond && localStatus === 'pending' && (
            <div className="flex items-center justify-center gap-2 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <Clock className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('offer.card.waitingResponse')}</span>
            </div>
          )}
          {localStatus === 'accepted' && (
            <div className="flex items-center justify-center gap-2 h-9 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs font-semibold text-green-700 dark:text-green-400">{t('offer.card.accepted')}</span>
            </div>
          )}
          {localStatus === 'declined' && (
            <div className="flex items-center justify-center gap-2 h-9 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-xs font-semibold text-red-700 dark:text-red-400">{t('offer.card.declined')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, t }: { status: 'pending' | 'accepted' | 'declined'; t: (k: string) => string }) {
  if (status === 'pending') return (
    <span className="inline-flex items-center gap-1 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
      <Clock className="h-2.5 w-2.5" />{t('offer.card.pending')}
    </span>
  );
  if (status === 'accepted') return (
    <span className="inline-flex items-center gap-1 bg-green-500/20 border border-green-500/30 text-green-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
      <CheckCircle2 className="h-2.5 w-2.5" />{t('offer.card.accepted')}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
      <XCircle className="h-2.5 w-2.5" />{t('offer.card.declined')}
    </span>
  );
}
