'use client';

import { Clock } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/language-context';

export function BookingBetaBanner() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center mx-auto mb-4">
          <Clock className="h-8 w-8 text-blue-500 dark:text-blue-400" />
        </div>
        <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 mb-3">
          {t('booking.beta.badge')}
        </span>
        <h2 className="text-xl font-bold text-foreground mb-2">
          {t('booking.beta.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('booking.beta.message')}
        </p>
      </div>
    </div>
  );
}
