'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useRouter } from 'next/navigation';
import {
  Search, Wrench, ArrowRight, Star, Shield, MessageSquare,
  Zap, CheckCircle2, Users, Briefcase, ChevronRight
} from 'lucide-react';

export default function Home() {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/feed');
    }
  }, [user, authLoading]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="overflow-x-hidden">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center bg-[#0f0f0f]">
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
        {/* Orange glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-600/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10 py-24">
          <div className="max-w-4xl mx-auto text-center">

            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
              <Zap className="h-3.5 w-3.5" />
              {t('home.hero.badge')}
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6">
              {t('home.hero.title1')}
              <span className="text-orange-500"> {t('home.hero.title2')}</span>
            </h1>

            <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              {t('home.hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/services">
                <Button size="lg" className="bg-orange-600 hover:bg-orange-500 text-white text-base px-8 h-12 shadow-lg shadow-orange-600/25 w-full sm:w-auto">
                  <Search className="mr-2 h-4 w-4" />
                  {t('home.hero.findPro')}
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white text-base px-8 h-12 w-full sm:w-auto">
                  {t('home.hero.offerServices')}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-center mt-3">
              <Link href="/feed">
                <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-800 w-full sm:w-auto">
                  <Briefcase className="mr-1.5 h-3.5 w-3.5" />
                  {t('home.browseFeed')}
                </Button>
              </Link>
              <Link href="/jobs">
                <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-800 w-full sm:w-auto">
                  <Users className="mr-1.5 h-3.5 w-3.5" />
                  {t('home.browseJobs')}
                </Button>
              </Link>
            </div>

            {/* Trust bar */}
            <div className="mt-16 flex flex-wrap items-center justify-center gap-6 md:gap-10 text-slate-500 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{t('home.hero.trust1')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{t('home.hero.trust2')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{t('home.hero.trust3')}</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── FOR WHO ──────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">{t('home.forWho.title')}</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">{t('home.forWho.subtitle')}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Card 1 */}
            <div className="group relative bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 rounded-2xl p-7 transition-all duration-300 cursor-pointer"
              onClick={() => router.push('/services')}>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-5 group-hover:bg-orange-200 transition-colors">
                <Search className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{t('home.forWho.client.title')}</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4">{t('home.forWho.client.desc')}</p>
              <span className="text-orange-600 text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                {t('home.forWho.client.cta')} <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>

            {/* Card 2 */}
            <div className="group relative bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 rounded-2xl p-7 transition-all duration-300 cursor-pointer"
              onClick={() => router.push('/login')}>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-5 group-hover:bg-orange-200 transition-colors">
                <Wrench className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{t('home.forWho.pro.title')}</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4">{t('home.forWho.pro.desc')}</p>
              <span className="text-orange-600 text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                {t('home.forWho.pro.cta')} <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>

            {/* Card 3 */}
            <div className="group relative bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 rounded-2xl p-7 transition-all duration-300 cursor-pointer"
              onClick={() => router.push('/jobs')}>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-5 group-hover:bg-orange-200 transition-colors">
                <Briefcase className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{t('home.forWho.employer.title')}</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4">{t('home.forWho.employer.desc')}</p>
              <span className="text-orange-600 text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                {t('home.forWho.employer.cta')} <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section className="py-20 bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">{t('home.howItWorks.title')}</h2>
            <p className="text-slate-400 text-lg">{t('home.howItWorks.subtitle')}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto relative">
            {/* Connector line desktop */}
            <div className="hidden md:block absolute top-8 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-gradient-to-r from-orange-600/0 via-orange-600/40 to-orange-600/0" />

            {[
              { num: '01', icon: <Search className="h-5 w-5" />, title: t('home.howItWorks.step1.title'), desc: t('home.howItWorks.step1.desc') },
              { num: '02', icon: <MessageSquare className="h-5 w-5" />, title: t('home.howItWorks.step2.title'), desc: t('home.howItWorks.step2.desc') },
              { num: '03', icon: <CheckCircle2 className="h-5 w-5" />, title: t('home.howItWorks.step3.title'), desc: t('home.howItWorks.step3.desc') },
            ].map((step) => (
              <div key={step.num} className="relative bg-slate-900 border border-slate-800 rounded-2xl p-7 text-center">
                <div className="w-14 h-14 bg-orange-600/10 border border-orange-600/20 rounded-2xl flex items-center justify-center mx-auto mb-5 text-orange-500">
                  {step.icon}
                </div>
                <div className="text-xs font-bold text-orange-500/60 tracking-widest mb-2">{step.num}</div>
                <h3 className="text-base font-bold text-white mb-3">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">{t('home.whyChoose.title')}</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: <Shield className="h-6 w-6 text-orange-600" />, title: t('home.whyChoose.verified.title'), desc: t('home.whyChoose.verified.desc') },
              { icon: <Star className="h-6 w-6 text-orange-600" />, title: t('home.whyChoose.rated.title'), desc: t('home.whyChoose.rated.desc') },
              { icon: <Users className="h-6 w-6 text-orange-600" />, title: t('home.whyChoose.quality.title'), desc: t('home.whyChoose.quality.desc') },
            ].map((f, i) => (
              <div key={i} className="bg-slate-50 border border-slate-200 rounded-2xl p-7">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-5">
                  {f.icon}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="py-24 bg-orange-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-5 leading-tight">
            {t('home.cta.title')}
          </h2>
          <p className="text-orange-100 text-lg mb-10 max-w-xl mx-auto">
            {t('home.cta.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login">
              <Button size="lg" className="bg-white text-orange-700 hover:bg-orange-50 text-base px-10 h-12 font-semibold shadow-xl w-full sm:w-auto">
                {t('home.cta.button')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/services">
              <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 text-base px-8 h-12 w-full sm:w-auto">
                {t('home.hero.findPro')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
