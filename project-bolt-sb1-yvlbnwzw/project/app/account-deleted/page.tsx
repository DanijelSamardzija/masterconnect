'use client';

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/language-context';

export default function AccountDeletedPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>

        {/* Title + subtitle */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('accountDeleted.title')}</h1>
          <p className="text-muted-foreground">{t('accountDeleted.subtitle')}</p>
        </div>

        {/* Body */}
        <div className="space-y-3 text-sm text-muted-foreground text-left">
          <p>{t('accountDeleted.body1')}</p>
          <p>{t('accountDeleted.body2')}</p>
          <p>{t('accountDeleted.body3')}</p>
        </div>

        {/* CTA */}
        <Link
          href="/"
          className="block w-full rounded-full bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white text-center transition-colors hover:bg-orange-600 active:bg-orange-700"
        >
          {t('accountDeleted.returnHome')}
        </Link>

        {/* Footer */}
        <p className="text-xs text-muted-foreground">{t('accountDeleted.footer')}</p>
      </div>
    </div>
  );
}
