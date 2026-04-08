'use client';

import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/contexts/language-context';

export default function PrivacyPage() {
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
              {t('privacy.backToHome')}
            </Button>
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border-2 p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{t('privacy.title')}</h1>
          <p className="text-sm text-muted-foreground mb-8">
            {t('privacy.lastUpdated')}: {lastUpdated}
          </p>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('privacy.section1.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {t('privacy.section1.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('privacy.section2.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">{t('privacy.section2.intro')}</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>{t('privacy.section2.item1')}</li>
                <li>{t('privacy.section2.item2')}</li>
                <li>{t('privacy.section2.item3')}</li>
                <li>{t('privacy.section2.item4')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('privacy.section3.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">{t('privacy.section3.intro')}</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>{t('privacy.section3.item1')}</li>
                <li>{t('privacy.section3.item2')}</li>
                <li>{t('privacy.section3.item3')}</li>
                <li>{t('privacy.section3.item4')}</li>
                <li>{t('privacy.section3.item5')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('privacy.section4.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">{t('privacy.section4.intro')}</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>{t('privacy.section4.item1')}</li>
                <li>{t('privacy.section4.item2')}</li>
                <li>{t('privacy.section4.item3')}</li>
                <li>{t('privacy.section4.item4')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('privacy.section5.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                {t('privacy.section5.content1')}
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">{t('privacy.section5.content2')}</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>{t('privacy.section5.item1')}</li>
                <li>{t('privacy.section5.item2')}</li>
                <li>{t('privacy.section5.item3')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('privacy.section6.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {t('privacy.section6.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('privacy.section7.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">{t('privacy.section7.intro')}</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>{t('privacy.section7.item1')}</li>
                <li>{t('privacy.section7.item2')}</li>
                <li>{t('privacy.section7.item3')}</li>
                <li>{t('privacy.section7.item4')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('privacy.section8.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {t('privacy.section8.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('privacy.section9.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {t('privacy.section9.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('privacy.section10.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {t('privacy.section10.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('privacy.section11.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {t('privacy.section11.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">{t('privacy.section12.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {t('privacy.section12.content')}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
