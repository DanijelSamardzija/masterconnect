'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Briefcase,
  User,
  Rss,
  Wrench,
  Search,
  MessageCircle,
  Coins,
  UserCircle,
  HelpCircle,
  ExternalLink,
  Sparkles,
  FileText,
  ChevronRight,
  TrendingUp,
  Building2,
  Rocket,
  HardHat,
  Leaf,
  Code2,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useLanguage } from '@/lib/contexts/language-context';

export default function HelpPage() {
  const { t } = useLanguage();

  const postTypes = [
    {
      key: 'serviceListing',
      who: 'professional',
      icon: Wrench,
      color: 'orange',
      href: '/create-post',
    },
    {
      key: 'hiring',
      who: 'professional',
      icon: Briefcase,
      color: 'orange',
      href: '/jobs/new',
    },
    {
      key: 'serviceRequest',
      who: 'professional',
      icon: Search,
      color: 'orange',
      href: '/jobs/new',
    },
    {
      key: 'portfolio',
      who: 'professional',
      icon: FileText,
      color: 'orange',
      href: '/create-post',
    },
    {
      key: 'jobSeeker',
      who: 'customer',
      icon: User,
      color: 'blue',
      href: '/create-post',
    },
    {
      key: 'serviceRequestCustomer',
      who: 'customer',
      icon: Search,
      color: 'blue',
      href: '/jobs/new',
    },
    {
      key: 'social',
      who: 'everyone',
      icon: Rss,
      color: 'purple',
      href: '/create-post',
    },
  ];

  const features = [
    { key: 'feed', icon: Rss, href: '/feed', color: 'orange' },
    { key: 'jobs', icon: Briefcase, href: '/jobs', color: 'blue' },
    { key: 'services', icon: Wrench, href: '/services', color: 'green' },
    { key: 'messages', icon: MessageCircle, href: '/messages', color: 'teal' },
    { key: 'credits', icon: Coins, href: '/profile', color: 'yellow' },
    { key: 'profile', icon: UserCircle, href: '/profile/edit', color: 'pink' },
  ];

  const faqs = ['q1', 'q2', 'q3', 'q4', 'q5'];

  const whoLabel = (who: string) => {
    if (who === 'professional') return t('help.posts.onlyPro');
    if (who === 'customer') return t('help.posts.onlyCustomer');
    return t('help.posts.everyone');
  };

  const whoBadgeClass = (who: string) => {
    if (who === 'professional') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
    if (who === 'customer') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
  };

  const iconBg = (color: string) => {
    const map: Record<string, string> = {
      blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
      green: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
      purple: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
      orange: 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400',
      teal: 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400',
      yellow: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400',
      pink: 'bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400',
    };
    return map[color] ?? map.orange;
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-950 pb-24 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Back button */}
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('privacy.backToHome')}
            </Button>
          </Link>
        </div>

        {/* Hero */}
        <div className="text-center mb-12 py-8 px-4 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg">
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 rounded-full p-3">
              <HelpCircle className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">{t('help.title')}</h1>
          <p className="text-orange-100 text-lg max-w-xl mx-auto">{t('help.subtitle')}</p>
        </div>

        {/* Who are you? */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-2 text-foreground">{t('help.whoAreYou.title')}</h2>
          <p className="text-muted-foreground mb-6">{t('help.whoAreYou.subtitle')}</p>
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-900/50">
                    <Wrench className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h3 className="text-xl font-bold text-orange-800 dark:text-orange-300">{t('help.professional.title')}</h3>
                </div>
                <p className="text-orange-700 dark:text-orange-400 text-sm leading-relaxed">{t('help.professional.desc')}</p>
              </CardContent>
            </Card>
            <Card className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50">
                    <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold text-blue-800 dark:text-blue-300">{t('help.customer.title')}</h3>
                </div>
                <p className="text-blue-700 dark:text-blue-400 text-sm leading-relaxed">{t('help.customer.desc')}</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Who can post what */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-2 text-foreground">{t('help.posts.title')}</h2>
          <p className="text-muted-foreground mb-4">{t('help.posts.subtitle')}</p>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${whoBadgeClass('customer')}`}>{t('help.posts.onlyCustomer')}</span>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${whoBadgeClass('professional')}`}>{t('help.posts.onlyPro')}</span>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${whoBadgeClass('everyone')}`}>{t('help.posts.everyone')}</span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {postTypes.map(({ key, who, icon: Icon, color, href }) => (
              <Card key={key} className="border border-border hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${iconBg(color)}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="font-semibold text-foreground">{t(`help.posts.${key}.title`)}</h3>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${whoBadgeClass(who)}`}>
                          {whoLabel(who)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                        {t(`help.posts.${key}.desc`)}
                      </p>
                      <Link href={href}>
                        <Button size="sm" variant="outline" className="text-xs h-7 px-3">
                          {t(`help.posts.${key}.cta`)}
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Platform Features */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-foreground">{t('help.features.title')}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ key, icon: Icon, href, color }) => (
              <Link key={key} href={href}>
                <Card className="border border-border hover:shadow-md hover:border-orange-300 dark:hover:border-orange-700 transition-all cursor-pointer h-full">
                  <CardContent className="p-5">
                    <div className={`inline-flex p-2.5 rounded-xl mb-3 ${iconBg(color)}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1.5">{t(`help.features.${key}.title`)}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t(`help.features.${key}.desc`)}</p>
                    <div className="flex items-center gap-1 mt-3 text-xs text-orange-500 font-medium">
                      {t('help.posts.goTo')}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Credits section */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-yellow-100 dark:bg-yellow-900/40">
              <Coins className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">{t('credits.info.howToEarnSpend')}</h2>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Earn */}
            <Card className="border border-border">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/40">
                    <Coins className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="font-semibold text-foreground">{t('credits.info.earn.title')}</h3>
                </div>
                <div className="space-y-2">
                  {([
                    { key: 'registration', amount: '+10' },
                    { key: 'profile', amount: '+10' },
                    { key: 'firstPost', amount: '+15' },
                    { key: 'firstService', amount: '+20' },
                    { key: 'firstJob', amount: '+20' },
                    { key: 'imagePost', amount: '+5', noteKey: 'imagePostNote' },
                    { key: 'videoPost', amount: '+10', noteKey: 'videoPostNote' },
                    { key: 'referral', amount: '+25', noteKey: 'referralNote' },
                  ] as { key: string; amount: string; noteKey?: string }[]).map((item) => (
                    <div key={item.key} className="flex items-center justify-between rounded-lg bg-green-500/8 px-3 py-2">
                      <div>
                        <span className="text-sm text-foreground">{t(`credits.info.earn.${item.key}`)}</span>
                        {item.noteKey && (
                          <span className="text-[11px] text-muted-foreground ml-1.5">({t(`credits.info.earn.${item.noteKey}`)})</span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-green-600 dark:text-green-400 ml-3 shrink-0">{item.amount} {t('credits.unit')}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Spend */}
            <Card className="border border-border">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/40">
                    <Coins className="h-4 w-4 text-orange-500" />
                  </div>
                  <h3 className="font-semibold text-foreground">{t('credits.info.spend.title')}</h3>
                </div>
                <div className="space-y-2">
                  {([
                    { key: 'boostFeed', amount: '15', noteKey: 'boostFeedNote' },
                    { key: 'boostListing', amount: '25', noteKey: 'boostListingNote' },
                    { key: 'creatorPremium', amount: '200', noteKey: 'creatorPremiumNote' },
                    { key: 'supportSmall', amount: '5', noteKey: 'perSupport' },
                    { key: 'supportMedium', amount: '10', noteKey: 'perSupport' },
                    { key: 'supportLarge', amount: '20', noteKey: 'perSupport' },
                  ] as { key: string; amount: string; noteKey: string }[]).map((item) => (
                    <div key={item.key} className="flex items-center justify-between rounded-lg bg-orange-500/8 px-3 py-2">
                      <div>
                        <span className="text-sm text-foreground">{t(`credits.info.spend.${item.key}`)}</span>
                        <span className="text-[11px] text-muted-foreground ml-1.5">({t(`credits.info.spend.${item.noteKey}`)})</span>
                      </div>
                      <span className="text-sm font-bold text-orange-600 dark:text-orange-400 ml-3 shrink-0">{item.amount} {t('credits.unit')}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">{t('credits.info.footer')}</p>
        </section>

        {/* Creator Premium callout */}
        <section className="mb-12">
          <Card className="border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-orange-100 dark:bg-orange-900/50 flex-shrink-0">
                  <Sparkles className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-orange-800 dark:text-orange-300 mb-1">Creator Premium</h3>
                  <p className="text-orange-700 dark:text-orange-400 text-sm leading-relaxed mb-3">
                    {t('help.faq.a3')}
                  </p>
                  <Link href="/profile">
                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white text-xs">
                      {t('credits.creatorPremium.activate')}
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Invest section */}
        <section className="mb-12">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(145deg, #0d1528, #0a1020)', border: '1px solid rgba(234,88,12,0.25)' }}
          >
            {/* Header */}
            <div
              className="px-6 py-6"
              style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(234,88,12,0.18) 0%, transparent 70%)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl" style={{ background: 'rgba(234,88,12,0.15)', border: '1px solid rgba(234,88,12,0.3)' }}>
                  <TrendingUp className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{t('help.invest.title')}</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-orange-300" style={{ background: 'rgba(234,88,12,0.2)', border: '1px solid rgba(234,88,12,0.4)' }}>
                      {t('help.invest.badge')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1 max-w-xl">{t('help.invest.desc')}</p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 space-y-5">
              {/* Who can use it */}
              <div className="grid md:grid-cols-2 gap-3">
                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-orange-400" />
                    <span className="text-sm font-semibold text-white">{t('help.invest.investor.title')}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{t('help.invest.investor.desc')}</p>
                </div>
                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-orange-400" />
                    <span className="text-sm font-semibold text-white">{t('help.invest.business.title')}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{t('help.invest.business.desc')}</p>
                </div>
              </div>

              {/* How it works */}
              <div>
                <p className="text-sm font-semibold text-white mb-3">{t('help.invest.how.title')}</p>
                <div className="grid md:grid-cols-3 gap-3">
                  {([
                    { step: '1', titleKey: 'help.invest.how.step1.title', descKey: 'help.invest.how.step1.desc', icon: Search },
                    { step: '2', titleKey: 'help.invest.how.step2.title', descKey: 'help.invest.how.step2.desc', icon: DollarSign },
                    { step: '3', titleKey: 'help.invest.how.step3.title', descKey: 'help.invest.how.step3.desc', icon: TrendingUp },
                  ] as { step: string; titleKey: string; descKey: string; icon: React.ElementType }[]).map(({ step, titleKey, descKey, icon: Icon }) => (
                    <div key={step} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-orange-400 shrink-0" style={{ background: 'rgba(234,88,12,0.2)', border: '1px solid rgba(234,88,12,0.35)' }}>{step}</span>
                        <Icon className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs font-semibold text-white">{t(titleKey)}</span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{t(descKey)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Categories */}
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2">{t('help.invest.categories')}</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { icon: Building2, label: 'Local businesses', color: 'text-blue-400' },
                    { icon: Rocket,    label: 'Startups',         color: 'text-purple-400' },
                    { icon: HardHat,   label: 'Construction',     color: 'text-orange-400' },
                    { icon: Leaf,      label: 'Farming',          color: 'text-emerald-400' },
                    { icon: Code2,     label: 'Tech',             color: 'text-cyan-400' },
                  ] as { icon: React.ElementType; label: string; color: string }[]).map(({ icon: Icon, label, color }) => (
                    <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                      <span className="text-slate-300">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disclaimer + CTA */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-400/80">{t('help.invest.disclaimer')}</p>
                </div>
                <Link href="/invest" className="shrink-0">
                  <Button size="sm" className="text-white text-xs" style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)' }}>
                    {t('help.invest.waitlist.cta')}
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-foreground">{t('help.faq.title')}</h2>
          <Card className="border border-border">
            <CardContent className="p-0">
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((q, i) => (
                  <AccordionItem key={q} value={q} className={i === 0 ? '' : ''}>
                    <AccordionTrigger className="px-6 py-4 text-left font-medium hover:text-orange-500 transition-colors">
                      {t(`help.faq.${q}`)}
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4 text-muted-foreground leading-relaxed">
                      {t(`help.faq.${q.replace('q', 'a')}`)}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </section>

        {/* Contact CTA */}
        <section>
          <Card className="border border-border text-center">
            <CardContent className="p-8">
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-full bg-muted">
                  <MessageCircle className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2 text-foreground">{t('help.contact.title')}</h3>
              <p className="text-muted-foreground mb-5 max-w-sm mx-auto">{t('help.contact.desc')}</p>
              <Link href="/contact">
                <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                  {t('help.contact.cta')}
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>

      </div>
    </div>
  );
}
