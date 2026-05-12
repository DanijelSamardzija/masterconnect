'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/contexts/language-context';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t bg-white dark:bg-slate-900">
      <div className="w-full max-w-[1100px] mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-1 text-sm md:text-base">
            <Link
              href="/privacy"
              className="text-foreground hover:text-primary transition-colors"
            >
              {t('footer.privacy')}
            </Link>
            <span className="hidden md:inline text-muted-foreground mx-3">|</span>
            <Link
              href="/terms"
              className="text-foreground hover:text-primary transition-colors"
            >
              {t('footer.terms')}
            </Link>
            <span className="hidden md:inline text-muted-foreground mx-3">|</span>
            <Link
              href="/contact"
              className="text-foreground hover:text-primary transition-colors"
            >
              {t('footer.contact')}
            </Link>
            <span className="hidden md:inline text-muted-foreground mx-3">|</span>
            <Link
              href="/invest"
              className="text-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              Invest
              <span className="text-[9px] font-bold bg-orange-500 text-white px-1 py-0.5 rounded-full leading-none">SOON</span>
            </Link>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-3xl leading-relaxed">
            {t('footer.disclaimer')}
          </p>

          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {t('footer.copyright')}
          </div>
        </div>
      </div>
    </footer>
  );
}
