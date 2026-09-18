'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { BusinessBookingNav } from '@/components/booking/business-booking-nav';
import { useLanguage } from '@/lib/contexts/language-context';
import { BookOpen } from 'lucide-react';

type GuideType = 'termini' | 'restaurants' | 'accommodation' | 'delivery' | 'events';

const GUIDE_TYPES: { id: GuideType; emoji: string; labelKey: string; available: boolean }[] = [
  { id: 'termini',       emoji: '📅', labelKey: 'guide.type.termini',       available: true  },
  { id: 'restaurants',   emoji: '🍽️', labelKey: 'guide.type.restaurants',   available: false },
  { id: 'accommodation', emoji: '🏨', labelKey: 'guide.type.accommodation', available: false },
  { id: 'delivery',      emoji: '🛍️', labelKey: 'guide.type.delivery',      available: false },
  { id: 'events',        emoji: '🎫', labelKey: 'guide.type.events',        available: false },
];

function Divider() {
  return <div className="border-t border-border" />;
}

const STATUS_COLORS: Record<string, string> = {
  upcoming:  'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  pending:   'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  completed: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  cancelled: 'bg-muted text-muted-foreground',
  no_show:   'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
};

function TerminiGuide() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-7">

      {/* 1. Usluge */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">1</span>
          {t('guide.termini.s1.title')}
        </h3>
        <p className="text-sm text-muted-foreground pl-8">{t('guide.termini.s1.intro')}</p>
        <ul className="flex flex-col gap-2 pl-8">
          {(['1','2','3','4','5','6'] as const).map((n) => (
            <li key={n} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-0.5 shrink-0">•</span>
              {t(`guide.termini.s1.${n}` as Parameters<typeof t>[0])}
            </li>
          ))}
        </ul>
      </section>

      <Divider />

      {/* 2. Podešavanja */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">2</span>
          {t('guide.termini.s2.title')}
        </h3>
        <ul className="flex flex-col gap-2 pl-8">
          {(['1','2','3','4'] as const).map((n) => (
            <li key={n} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-0.5 shrink-0">•</span>
              {t(`guide.termini.s2.${n}` as Parameters<typeof t>[0])}
            </li>
          ))}
        </ul>
      </section>

      <Divider />

      {/* 3. Booking stranica */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">3</span>
          {t('guide.termini.s3.title')}
        </h3>
        <p className="text-sm text-muted-foreground pl-8">{t('guide.termini.s3.intro')}</p>
        <ul className="flex flex-col gap-2 pl-8">
          {(['1','2','3'] as const).map((n) => (
            <li key={n} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-0.5 shrink-0">•</span>
              {t(`guide.termini.s3.${n}` as Parameters<typeof t>[0])}
            </li>
          ))}
        </ul>
      </section>

      <Divider />

      {/* 4. Tok rezervacije */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">4</span>
          {t('guide.termini.s4.title')}
        </h3>
        <ol className="flex flex-col gap-2 pl-8">
          {(['1','2','3','4'] as const).map((n, i) => (
            <li key={n} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-foreground text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              {t(`guide.termini.s4.${n}` as Parameters<typeof t>[0])}
            </li>
          ))}
        </ol>
      </section>

      <Divider />

      {/* 5. Statusi */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">5</span>
          {t('guide.termini.s5.title')}
        </h3>
        <p className="text-sm text-muted-foreground pl-8">{t('guide.termini.s5.intro')}</p>
        <div className="flex flex-col gap-2 pl-8">
          {(['upcoming','pending','completed','cancelled','no_show'] as const).map((s) => (
            <div key={s} className="flex items-start gap-2.5 text-sm">
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold mt-0.5 ${STATUS_COLORS[s]}`}>
                {t(`guide.termini.s5.${s}` as Parameters<typeof t>[0]).split(' — ')[0]}
              </span>
              <span className="text-muted-foreground">
                {t(`guide.termini.s5.${s}` as Parameters<typeof t>[0]).split(' — ')[1]}
              </span>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      {/* 6. Vlasnik */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">{t('guide.termini.s6.title')}</h3>
        <ul className="flex flex-col gap-1.5">
          {(['1','2','3','4','5','6','7','8','9'] as const).map((n) => (
            <li key={n} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-green-600 dark:text-green-400 mt-0.5 shrink-0 font-bold">✓</span>
              {t(`guide.termini.s6.${n}` as Parameters<typeof t>[0])}
            </li>
          ))}
        </ul>
      </section>

      {/* 7. Radnik */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">{t('guide.termini.s7.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('guide.termini.s7.intro')}</p>
        <ul className="flex flex-col gap-1.5">
          {(['1','2','3','4','5','6'] as const).map((n) => (
            <li key={n} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0 font-bold">→</span>
              {t(`guide.termini.s7.${n}` as Parameters<typeof t>[0])}
            </li>
          ))}
        </ul>
      </section>

      <Divider />

      {/* 8. Odsustva */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">{t('guide.termini.s8.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('guide.termini.s8.intro')}</p>
        <ul className="flex flex-col gap-1.5">
          {(['1','2','3'] as const).map((n) => (
            <li key={n} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-0.5 shrink-0">•</span>
              {t(`guide.termini.s8.${n}` as Parameters<typeof t>[0])}
            </li>
          ))}
        </ul>
      </section>

      {/* 9. Klijent */}
      <section className="rounded-xl bg-muted/40 border border-border p-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">{t('guide.termini.s9.title')}</h3>
        <ul className="flex flex-col gap-1.5">
          {(['1','2','3','4'] as const).map((n) => (
            <li key={n} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className={`mt-0.5 shrink-0 font-bold ${n === '4' ? 'text-orange-500' : 'text-green-600 dark:text-green-400'}`}>
                {n === '4' ? '✗' : '✓'}
              </span>
              {t(`guide.termini.s9.${n}` as Parameters<typeof t>[0])}
            </li>
          ))}
        </ul>
      </section>

    </div>
  );
}

function ComingSoon({ type }: { type: GuideType }) {
  const { t } = useLanguage();
  const config = GUIDE_TYPES.find((g) => g.id === type)!;
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <span className="text-5xl leading-none">{config.emoji}</span>
      <div>
        <p className="font-semibold text-base mb-2">{t('guide.comingSoon')}</p>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          {t(`guide.comingSoon.desc.${type}` as Parameters<typeof t>[0])}
        </p>
      </div>
    </div>
  );
}

function GuidePageInner() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawType = searchParams.get('type') ?? 'termini';
  const activeType: GuideType = GUIDE_TYPES.some((g) => g.id === rawType)
    ? (rawType as GuideType)
    : 'termini';

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 pt-4 pb-12">
          <BusinessBookingNav active="guide" />

          <div className="mb-5">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary shrink-0" />
              {t('guide.title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t('guide.subtitle')}</p>
          </div>

          <div className="flex flex-col md:flex-row gap-6">

            {/* Navigation */}
            <div className="md:w-52 shrink-0">
              {/* Mobile: horizontal scroll */}
              <div className="flex md:hidden gap-1 overflow-x-auto pb-1 -mx-4 px-4">
                {GUIDE_TYPES.map(({ id, emoji, labelKey }) => (
                  <button
                    key={id}
                    onClick={() => router.replace(`/booking/business/guide?type=${id}`)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors shrink-0 ${
                      activeType === id
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'bg-accent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{emoji}</span>
                    <span>{t(labelKey as Parameters<typeof t>[0])}</span>
                  </button>
                ))}
              </div>
              {/* Desktop: vertical sidebar */}
              <div className="hidden md:flex flex-col gap-1">
                {GUIDE_TYPES.map(({ id, emoji, labelKey, available }) => (
                  <button
                    key={id}
                    onClick={() => router.replace(`/booking/business/guide?type=${id}`)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-colors w-full ${
                      activeType === id
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <span className="text-base shrink-0">{emoji}</span>
                    <span className="flex-1 min-w-0">{t(labelKey as Parameters<typeof t>[0])}</span>
                    {!available && (
                      <span className="text-[10px] text-muted-foreground bg-muted rounded px-1 py-0.5 shrink-0 leading-none">
                        {t('guide.comingSoon')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {activeType === 'termini' ? (
                <TerminiGuide />
              ) : (
                <ComingSoon type={activeType} />
              )}
            </div>

          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}

export default function GuidePage() {
  return (
    <Suspense>
      <GuidePageInner />
    </Suspense>
  );
}
