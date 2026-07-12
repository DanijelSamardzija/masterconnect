'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/contexts/language-context';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

const features = [
  { emoji: '🌍', key: 'f1', soon: false },
  { emoji: '💼', key: 'f2', soon: false },
  { emoji: '🛠️', key: 'f3', soon: false },
  { emoji: '📸', key: 'f4', soon: false },
  { emoji: '💬', key: 'f5', soon: false },
  { emoji: '🎯', key: 'f6', soon: false },
  { emoji: '💳', key: 'f7', soon: false },
  { emoji: '❤️', key: 'f8', soon: true },
  { emoji: '🚀', key: 'f9', soon: true },
  { emoji: '📱', key: 'f10', soon: false },
  { emoji: '🌐', key: 'f11', soon: false },
];

export default function OPlatformi() {
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0a0a0a]">

      {/* Hero */}
      <section className="relative pt-20 pb-16 px-4 border-b border-white/8">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-orange-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-3xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold px-3 py-1 rounded-full mb-6 tracking-wider">
            {t('about.badge')}
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-[1.1] tracking-tight">
            {t('about.title')}
          </h1>
          <p className="text-slate-400 text-base md:text-lg leading-relaxed max-w-xl">
            {t('about.subtitle')}
          </p>
        </div>
      </section>

      {/* Feature list */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="divide-y divide-white/8">
            {features.map((f) => (
              <div key={f.key} className="flex items-start gap-5 py-5 group">
                <div className="text-2xl leading-none mt-0.5 flex-shrink-0 w-8 text-center">
                  {f.emoji}
                </div>
                <p className="text-slate-300 text-sm md:text-base leading-relaxed group-hover:text-white transition-colors">
                  {t(`about.${f.key}`)}
                  {f.soon && (
                    <span className="ml-2 inline-flex items-center bg-orange-500/15 border border-orange-500/20 text-orange-400 text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded align-middle">
                      {t('about.soon')}
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 border-t border-white/8">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-white font-bold text-lg mb-1">{t('home.cta.title')}</p>
            <p className="text-slate-500 text-sm">{t('home.cta.subtitle')}</p>
          </div>
          <Button
            size="lg"
            onClick={() => router.push('/join')}
            className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-8 h-12 rounded-xl shadow-lg shadow-orange-600/25 whitespace-nowrap flex-shrink-0"
          >
            {t('about.cta')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Back link */}
      <div className="pb-12 px-4 text-center">
        <Link href="/" className="text-slate-600 text-sm hover:text-slate-400 transition-colors">
          ← {t('about.backHome')}
        </Link>
      </div>

    </div>
  );
}
