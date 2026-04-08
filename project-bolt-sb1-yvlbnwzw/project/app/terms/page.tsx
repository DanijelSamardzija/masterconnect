'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/contexts/language-context';

export default function TermsPage() {
  const { t, language } = useLanguage();

  const lastUpdated = new Date().toLocaleDateString(language === 'sr' ? 'sr-RS' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="bg-slate-50 dark:bg-slate-950 pb-24">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('terms.backToHome')}
            </Button>
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border-2 p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{t('terms.title')}</h1>
          <p className="text-sm text-muted-foreground mb-8">
            {t('terms.lastUpdated')}: {lastUpdated}
          </p>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('terms.section1.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {t('terms.section1.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('terms.section2.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                {t('terms.section2.content1')}
              </p>
              <p className="text-muted-foreground leading-relaxed">
                {t('terms.section2.content2')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('terms.section3.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">{t('terms.section3.intro')}</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>{t('terms.section3.item1')}</li>
                <li>{t('terms.section3.item2')}</li>
                <li>{t('terms.section3.item3')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('terms.section4.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                {t('terms.section4.content1')}
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                {t('terms.section4.content2')}
              </p>
              <p className="text-muted-foreground leading-relaxed">
                {t('terms.section4.content3')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('terms.section5.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">{t('terms.section5.intro')}</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>{t('terms.section5.item1')}</li>
                <li>{t('terms.section5.item2')}</li>
                <li>{t('terms.section5.item3')}</li>
                <li>{t('terms.section5.item4')}</li>
                <li>{t('terms.section5.item5')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('terms.section6.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">{t('terms.section6.intro')}</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>{t('terms.section6.item1')}</li>
                <li>{t('terms.section6.item2')}</li>
                <li>{t('terms.section6.item3')}</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                {t('terms.section6.outro')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('terms.section7.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">{t('terms.section7.intro')}</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>{t('terms.section7.item1')}</li>
                <li>{t('terms.section7.item2')}</li>
                <li>{t('terms.section7.item3')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('terms.section8.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {t('terms.section8.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('terms.section9.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                {t('terms.section9.content1')}
              </p>
              <p className="text-muted-foreground leading-relaxed">
                {t('terms.section9.content2')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('terms.section10.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                {t('terms.section10.content1')}
              </p>
              <p className="text-muted-foreground leading-relaxed">
                {t('terms.section10.content2')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('terms.section11.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                {t('terms.section11.content1')}
              </p>
              <p className="text-muted-foreground leading-relaxed">
                {t('terms.section11.content2')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('terms.section12.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                {t('terms.section12.content1')}
              </p>
              <p className="text-muted-foreground leading-relaxed">
                {t('terms.section12.content2')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('terms.section13.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {t('terms.section13.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('terms.section14.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                {t('terms.section14.content1')}
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                {t('terms.section14.content2')}
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">{t('terms.section14.guaranteesIntro')}</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4 mb-3">
                <li>{t('terms.section14.guarantee1')}</li>
                <li>{t('terms.section14.guarantee2')}</li>
                <li>{t('terms.section14.guarantee3')}</li>
                <li>{t('terms.section14.guarantee4')}</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mb-3">
                {t('terms.section14.content3')}
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                {t('terms.section14.content4')}
              </p>
              <p className="text-muted-foreground leading-relaxed">
                {t('terms.section14.content5')}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
