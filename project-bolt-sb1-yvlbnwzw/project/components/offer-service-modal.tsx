'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { devLog } from '@/lib/dev-log';

type OfferServiceModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiverId: string;
  receiverName: string;
  postId: string;
};

export function OfferServiceModal({ open, onOpenChange, receiverId, receiverName, postId }: OfferServiceModalProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { session } = useAuth();
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('RSD');
  const [priceType, setPriceType] = useState<'fixed' | 'per_hour'>('fixed');
  const [earliestStart, setEarliestStart] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    devLog('[OfferService] ========== HANDLE SUBMIT CALLED ==========');
    e.preventDefault();
    devLog('[OfferService] Form data:', { price, currency, priceType, receiverId, postId });

    if (!price || price.trim() === '') {
      toast.error(t('offer.validPriceError'));
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error(t('offer.validPriceError'));
      return;
    }

    setSending(true);

    try {
      const requestBody = {
        receiverId,
        relatedPostId: postId,
        offerType: 'service',
        price: priceNum,
        currency,
        priceType,
        estimatedStart: earliestStart || null,
        durationDeadline: estimatedDuration || null,
        note: note || null,
      };

      devLog('[OfferService] Sending offer:', requestBody);

      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (!currentSession?.access_token) {
        console.error('[OfferService] NO SESSION TOKEN!');
        toast.error('Not authenticated');
        setSending(false);
        return;
      }

      devLog('[OfferService] Token length:', currentSession.access_token.length);
      devLog('[OfferService] Token first 30 chars:', currentSession.access_token.substring(0, 30));

      const headers = {
        'Content-Type': 'application/json',
        'X-Supabase-Token': currentSession.access_token,
        'Authorization': `Bearer ${currentSession.access_token}`,
      };

      devLog('[OfferService] Headers being sent:', Object.keys(headers));
      devLog('[OfferService] Custom header X-Supabase-Token set');

      const response = await fetch('/api/offers/create', {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify(requestBody),
      });

      devLog('[OfferService] Response status:', response.status);
      devLog('[OfferService] Response headers:', Object.fromEntries(response.headers.entries()));

      const data = await response.json();

      devLog('[OfferService] Response data:', data);

      if (!response.ok) {
        console.error('[OfferService] Error response:', data);
        const errorMsg = data.error || data.details || 'Failed to send offer';
        throw new Error(errorMsg);
      }

      toast.success(t('offer.successMessage'));
      onOpenChange(false);

      setPrice('');
      setCurrency('RSD');
      setPriceType('fixed');
      setEarliestStart('');
      setEstimatedDuration('');
      setNote('');

      if (data.threadId) {
        router.push(`/messages/${data.threadId}`);
      }
    } catch (error) {
      console.error('Error sending offer:', error);
      const errorMessage = error instanceof Error ? error.message : t('offer.errorMessage');
      toast.error(errorMessage);
    } finally {
      setSending(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-gray-700 shadow-lg p-0 rounded-xl">
        <DialogHeader className="px-5 pt-6 pb-4 space-y-3">
          <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('offer.serviceTitle')}
          </DialogTitle>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-slate-100 dark:border-gray-700">
              <AvatarFallback className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 text-sm font-medium">
                {getInitials(receiverName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogDescription className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                {t('offer.to')}
              </DialogDescription>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{receiverName}</p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-5 pb-4 space-y-6">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                {t('offer.pricing')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="price" className="text-sm font-medium text-slate-700 dark:text-gray-200">
                    {t('offer.price')} *
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder={t('offer.enterAmount')}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    min="0"
                    step="0.01"
                    required
                    disabled={sending}
                    className="h-10 border-slate-200 dark:border-gray-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="currency" className="text-sm font-medium text-slate-700 dark:text-gray-200">
                    {t('offer.currency')} *
                  </Label>
                  <Select value={currency} onValueChange={setCurrency} disabled={sending}>
                    <SelectTrigger id="currency" className="h-10 border-slate-200 dark:border-gray-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RSD">RSD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-gray-200">
                  {t('offer.priceType')}
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPriceType('fixed')}
                    disabled={sending}
                    className={`flex items-center justify-center gap-2 border-2 rounded-lg py-2.5 px-4 cursor-pointer transition-all ${
                      priceType === 'fixed'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                        : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      priceType === 'fixed' ? 'border-orange-500' : 'border-slate-300 dark:border-gray-600'
                    }`}>
                      {priceType === 'fixed' && <Check className="w-3 h-3 text-orange-500" />}
                    </div>
                    <span className="text-sm font-medium">{t('offer.fixedPrice')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceType('per_hour')}
                    disabled={sending}
                    className={`flex items-center justify-center gap-2 border-2 rounded-lg py-2.5 px-4 cursor-pointer transition-all ${
                      priceType === 'per_hour'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                        : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      priceType === 'per_hour' ? 'border-orange-500' : 'border-slate-300 dark:border-gray-600'
                    }`}>
                      {priceType === 'per_hour' && <Check className="w-3 h-3 text-orange-500" />}
                    </div>
                    <span className="text-sm font-medium">{t('offer.perHour')}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                {t('offer.timing')}
              </h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="earliestStart" className="text-sm font-medium text-slate-700 dark:text-gray-200">
                    {t('offer.earliestStart')}
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-gray-400">{t('common.optional')}</p>
                  <Input
                    id="earliestStart"
                    type="date"
                    value={earliestStart}
                    onChange={(e) => setEarliestStart(e.target.value)}
                    disabled={sending}
                    className="h-10 border-slate-200 dark:border-gray-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="estimatedDuration" className="text-sm font-medium text-slate-700 dark:text-gray-200">
                    {t('offer.estimatedDuration')}
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-gray-400">{t('common.optional')}</p>
                  <Select value={estimatedDuration} onValueChange={setEstimatedDuration} disabled={sending}>
                    <SelectTrigger id="estimatedDuration" className="h-10 border-slate-200 dark:border-gray-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20">
                      <SelectValue placeholder={t('offer.estimatedDuration')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1_day">{t('offer.duration1Day')}</SelectItem>
                      <SelectItem value="3_days">{t('offer.duration3Days')}</SelectItem>
                      <SelectItem value="1_week">{t('offer.duration1Week')}</SelectItem>
                      <SelectItem value="2_weeks">{t('offer.duration2Weeks')}</SelectItem>
                      <SelectItem value="1_month">{t('offer.duration1Month')}</SelectItem>
                      <SelectItem value="2_plus_months">{t('offer.duration2PlusMonths')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                {t('offer.message')}
              </h3>
              <div className="space-y-1.5">
                <Label htmlFor="note" className="text-sm font-medium text-slate-700 dark:text-gray-200">
                  {t('offer.additionalDetails')}
                </Label>
                <p className="text-xs text-slate-500 dark:text-gray-400">{t('common.optional')}</p>
                <Textarea
                  id="note"
                  placeholder={t('offer.additionalDetailsPlaceholder')}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={sending}
                  className="min-h-[100px] resize-none border-slate-200 dark:border-gray-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-slate-200 dark:border-gray-700 px-5 py-4 flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
              className="h-10 border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800 w-full sm:w-auto px-6"
            >
              {t('offer.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={sending}
              className="h-10 bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800 text-white w-full sm:w-auto px-6 shadow-sm"
            >
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('offer.sendOffer')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
