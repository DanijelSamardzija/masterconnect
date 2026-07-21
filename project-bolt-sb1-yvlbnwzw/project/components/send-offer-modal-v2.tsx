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
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/contexts/language-context';
import { devLog } from '@/lib/dev-log';

type SendOfferModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiverId: string;
  receiverName: string;
  postId: string;
};

export function SendOfferModal({ open, onOpenChange, receiverId, receiverName, postId }: SendOfferModalProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('RSD');
  const [estimatedStart, setEstimatedStart] = useState('');
  const [durationDeadline, setDurationDeadline] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    devLog('[SendOffer] ========== HANDLE SUBMIT CALLED ==========');
    e.preventDefault();
    devLog('[SendOffer] Form data:', { price, currency, receiverId, postId });

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
        offerType: 'job',
        price: priceNum,
        currency,
        priceType: 'fixed',
        estimatedStart: estimatedStart || null,
        durationDeadline: durationDeadline || null,
        note: note || null,
      };

      devLog('[SendOffer] Sending offer:', requestBody);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error('Not authenticated');
        setSending(false);
        return;
      }

      const response = await fetch('/api/offers/create', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Supabase-Token': session.access_token,
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      devLog('[SendOffer] Response status:', response.status);
      devLog('[SendOffer] Response headers:', Object.fromEntries(response.headers.entries()));

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send offer');
      }

      toast.success(t('offer.successMessage'));
      onOpenChange(false);

      setPrice('');
      setCurrency('RSD');
      setEstimatedStart('');
      setDurationDeadline('');
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
            {t('offer.jobTitle')}
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
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                {t('offer.timing')}
              </h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="estimatedStart" className="text-sm font-medium text-slate-700 dark:text-gray-200">
                    {t('offer.estimatedStart')}
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-gray-400">{t('common.optional')}</p>
                  <Input
                    id="estimatedStart"
                    type="date"
                    value={estimatedStart}
                    onChange={(e) => setEstimatedStart(e.target.value)}
                    disabled={sending}
                    className="h-10 border-slate-200 dark:border-gray-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="durationDeadline" className="text-sm font-medium text-slate-700 dark:text-gray-200">
                    {t('offer.durationDeadline')}
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-gray-400">{t('common.optional')}</p>
                  <Select value={durationDeadline} onValueChange={setDurationDeadline} disabled={sending}>
                    <SelectTrigger id="durationDeadline" className="h-10 border-slate-200 dark:border-gray-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20">
                      <SelectValue placeholder={t('offer.durationDeadline')} />
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
                  placeholder={t('offer.offerPlaceholder')}
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
