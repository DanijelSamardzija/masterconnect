'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  Search, Wrench, ArrowRight, Star, Shield, MessageSquare,
  Zap, CheckCircle2, Users, Briefcase, ChevronRight, Loader2
} from 'lucide-react';

export default function Home() {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/feed');
    }
  }, [user, authLoading]);

  const goToJoin = () => {
    router.push('/join');
  };

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setGoogleLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="overflow-x-hidden pb-20 md:pb-0">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center bg-[#0f0f0f]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-600/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10 py-16">
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

            <p className="text-lg md:text-xl text-slate-400 mb-8 max-w-2xl mx-auto leading-relaxed">
              {t('home.hero.subtitle')}
            </p>

            {/* FOMO badges */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              <span className="bg-orange-500/10 border border-orange-500/20 text-orange-300 text-sm px-4 py-1.5 rounded-full">
                {t('home.fomo.jobs')}
              </span>
              <span className="bg-orange-500/10 border border-orange-500/20 text-orange-300 text-sm px-4 py-1.5 rounded-full">
                {t('home.fomo.pros')}
              </span>
            </div>

            {/* Main CTA */}
            <div className="flex flex-col items-center gap-3 mb-6 max-w-sm mx-auto">
              <Button
                size="lg"
                onClick={goToJoin}
                className="bg-orange-600 hover:bg-orange-500 text-white text-lg px-10 h-14 shadow-lg shadow-orange-600/30 w-full rounded-xl font-bold"
              >
                {t('home.hero.ctaMain')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              {/* Google button */}
              <Button
                size="lg"
                onClick={handleGoogleSignup}
                disabled={googleLoading}
                className="w-full bg-white hover:bg-gray-100 text-gray-800 font-bold text-base h-12 rounded-xl shadow flex items-center justify-center gap-3"
              >
                {googleLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                {t('home.hero.ctaGoogle')}
              </Button>

              <p className="text-slate-500 text-sm">{t('home.hero.ctaSubtitle')}</p>
            </div>

            {/* Secondary buttons — hidden on mobile */}
            <div className="hidden sm:flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                variant="outline"
                onClick={goToJoin}
                className="bg-white/5 border-slate-600 text-white hover:bg-white/10 hover:border-slate-500 text-base px-8 h-12 w-full sm:w-auto"
              >
                <Search className="mr-2 h-4 w-4" />
                {t('home.hero.findJob')}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={goToJoin}
                className="bg-white/5 border-slate-600 text-white hover:bg-white/10 hover:border-slate-500 text-base px-8 h-12 w-full sm:w-auto"
              >
                <Users className="mr-2 h-4 w-4" />
                {t('home.hero.findClients')}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>

            {/* Trust bar */}
            <div className="mt-14 flex flex-wrap items-center justify-center gap-6 md:gap-10 text-slate-500 text-sm">
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
            <div className="group relative bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 rounded-2xl p-7 transition-all duration-300 cursor-pointer"
              onClick={goToJoin}>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-5 group-hover:bg-orange-200 transition-colors">
                <Search className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{t('home.forWho.client.title')}</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4">{t('home.forWho.client.desc')}</p>
              <span className="text-orange-600 text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                {t('home.forWho.client.cta')} <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>

            <div className="group relative bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 rounded-2xl p-7 transition-all duration-300 cursor-pointer"
              onClick={goToJoin}>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-5 group-hover:bg-orange-200 transition-colors">
                <Wrench className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{t('home.forWho.pro.title')}</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4">{t('home.forWho.pro.desc')}</p>
              <span className="text-orange-600 text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                {t('home.forWho.pro.cta')} <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>

            <div className="group relative bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 rounded-2xl p-7 transition-all duration-300 cursor-pointer"
              onClick={goToJoin}>
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

      {/* ── FINAL CTA ────────────────────────────────────────── */}
      <section className="py-24 bg-orange-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-5 leading-tight">
            {t('home.cta.title')}
          </h2>
          <p className="text-orange-100 text-lg mb-10 max-w-xl mx-auto">
            {t('home.cta.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              onClick={goToJoin}
              className="bg-white text-orange-700 hover:bg-orange-50 text-base px-10 h-12 font-semibold shadow-xl w-full sm:w-auto"
            >
              {t('home.cta.button')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Link href="/services">
              <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 text-base px-8 h-12 w-full sm:w-auto">
                {t('home.hero.findPro')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── STICKY MOBILE CTA ────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0f0f0f]/95 backdrop-blur-md border-t border-white/10 p-3">
        <Button
          size="lg"
          onClick={goToJoin}
          className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold text-base h-13 rounded-xl shadow-lg shadow-orange-600/30"
        >
          {t('home.hero.stickyBtn')}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>

    </div>
  );
}
