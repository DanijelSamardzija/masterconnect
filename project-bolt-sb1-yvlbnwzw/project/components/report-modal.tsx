'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/contexts/language-context';

type ReportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: 'post' | 'comment' | 'profile';
  targetId: string;
  targetOwnerUserId: string;
};

const REPORT_REASONS = {
  en: [
    { value: 'spam', label: 'Spam' },
    { value: 'scam', label: 'Scam/Fraud' },
    { value: 'harassment', label: 'Harassment/Hate' },
    { value: 'inappropriate', label: 'Inappropriate content' },
    { value: 'other', label: 'Other' },
  ],
  sr: [
    { value: 'spam', label: 'Spam' },
    { value: 'scam', label: 'Prevara' },
    { value: 'harassment', label: 'Uznemiravanje/Mržnja' },
    { value: 'inappropriate', label: 'Neprikladan sadržaj' },
    { value: 'other', label: 'Ostalo' },
  ]
};

export function ReportModal({
  open,
  onOpenChange,
  targetType,
  targetId,
  targetOwnerUserId,
}: ReportModalProps) {
  const { t, language: locale } = useLanguage();
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reasons = REPORT_REASONS[locale as 'en' | 'sr'] || REPORT_REASONS.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason) {
      toast.error(t('report.selectReason'));
      return;
    }

    setSubmitting(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error(t('report.signInRequired'));
        setSubmitting(false);
        return;
      }

      const response = await fetch('/api/reports', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetType,
          targetId,
          targetOwnerUserId,
          reason,
          details: details.trim() || null
        })
      });

      if (response.status === 409) {
        toast.error(t('report.alreadyReported'));
        onOpenChange(false);
        return;
      }

      if (response.ok) {
        toast.success(t('report.submitted'));
        onOpenChange(false);
        setReason('');
        setDetails('');
      } else {
        const { error } = await response.json();
        toast.error(error || t('report.failed'));
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error(t('report.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('report.title')}</DialogTitle>
            <DialogDescription>
              {t('report.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Label>{t('report.selectReasonLabel')}</Label>
              <RadioGroup value={reason} onValueChange={setReason}>
                {reasons.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Label htmlFor={option.value} className="font-normal cursor-pointer">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="details">{t('report.detailsLabel')}</Label>
              <Textarea
                id="details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={t('report.detailsPlaceholder')}
                rows={3}
                disabled={submitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting || !reason}>
              {submitting ? t('report.submitting') : t('report.submitButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
