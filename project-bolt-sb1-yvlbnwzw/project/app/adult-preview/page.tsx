'use client';

import { useState } from 'react';
import { AdultNavigation } from '@/components/adult/adult-navigation';
import { CreatorCard, CreatorCardCompact } from '@/components/adult/creator-card';
import { MOCK_CREATORS } from '@/mock/adult/data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatFollowers } from '@/lib/adult/types';
import {
  CheckCircle, Star, MapPin, Zap, MessageCircle,
  Search as SearchIcon, SlidersHorizontal, TrendingUp, Clock,
  Users, Camera, Film, Moon, Building2, Video, Briefcase, Globe,
  BarChart2, Shield, Image as ImageIcon, Play, X,
} from 'lucide-react';

// ─── static data ────────────────────────────────────────────────

const GALLERY_GRADIENTS = [
  'linear-gradient(135deg, #1a0a14 0%, #8B1E3F 100%)',
  'linear-gradient(135deg, #0d0515 0%, #3d1a6e 100%)',
  'linear-gradient(135deg, #0a0a0f 0%, #1e3a5f 100%)',
  'linear-gradient(135deg, #0f1510 0%, #1a5c2e 100%)',
  'linear-gradient(135deg, #0f0a00 0%, #92400e 100%)',
  'linear-gradient(135deg, #0a0505 0%, #7f1d1d 100%)',
];

const REVIEW_MOCKS = [
  { name: 'K.M.', rating: 5, text: 'Exceptional quality content. Very professional and responsive. Highly recommend!', date: '2 days ago' },
  { name: 'S.P.', rating: 5, text: 'Amazing experience, exceeded all expectations. Will definitely book again.', date: '1 week ago' },
  { name: 'A.V.', rating: 4, text: 'Very good. Consistent quality and great communication throughout.', date: '2 weeks ago' },
];

const PREMIUM_PLANS = [
  {
    name: 'Free', price: 0, period: '', popular: false,
    accentHex: 'hsl(var(--muted-foreground))',
    features: [
      { text: 'Public profile page', ok: true },
      { text: 'Up to 10 gallery photos', ok: true },
      { text: '3 services listed', ok: true },
      { text: 'Verified badge', ok: false },
      { text: 'Priority in search', ok: false },
      { text: 'Analytics dashboard', ok: false },
    ],
    cta: 'Current Plan', ctaOff: true,
  },
  {
    name: 'Creator', price: 29, period: '/ month', popular: true,
    accentHex: 'var(--adult-accent-2)',
    features: [
      { text: 'Public profile page', ok: true },
      { text: 'Unlimited gallery & videos', ok: true },
      { text: 'Priority search placement', ok: true },
      { text: 'Verified badge', ok: true },
      { text: 'Analytics dashboard', ok: true },
      { text: '50 Boost credits / month', ok: true },
    ],
    cta: 'Start Creator', ctaOff: false,
  },
  {
    name: 'Pro', price: 79, period: '/ month', popular: false,
    accentHex: '#f59e0b',
    features: [
      { text: 'Everything in Creator', ok: true },
      { text: 'Top search placement', ok: true },
      { text: 'Advanced analytics + export', ok: true },
      { text: 'Custom profile URL', ok: true },
      { text: '200 Boost credits / month', ok: true },
      { text: 'Dedicated account manager', ok: true },
    ],
    cta: 'Start Pro', ctaOff: false,
  },
];

const PREMIUM_FEATURES = [
  { icon: TrendingUp, title: 'Priority Search Placement', desc: 'Your profile appears first in search results and category listings, reaching more potential subscribers.' },
  { icon: Shield,     title: 'Verified Creator Badge',    desc: 'Build trust instantly with the verified badge. Clients prefer verified creators 3× more.' },
  { icon: BarChart2,  title: 'Analytics Dashboard',       desc: 'Track followers, revenue, engagement rates, and content performance in real time.' },
];

const CATEGORY_META: Record<string, { icon: React.ElementType; color: string; description: string }> = {
  Creators:      { icon: Users,     color: '#8B1E3F', description: 'Content creators & influencers' },
  Models:        { icon: Camera,    color: '#7c3aed', description: 'Professional models for hire' },
  Entertainment: { icon: Film,      color: '#b45309', description: 'Performers & entertainers' },
  'Night Clubs': { icon: Moon,      color: '#0e7490', description: 'Venues, events & VIP experiences' },
  Webcam:        { icon: Video,     color: '#15803d', description: 'Live streaming professionals' },
  Photography:   { icon: Camera,    color: '#1d4ed8', description: 'Photo shoots & studio sessions' },
  Studios:       { icon: Building2, color: '#374151', description: 'Production studios & facilities' },
  Agencies:      { icon: Briefcase, color: '#6d28d9', description: 'Full-service talent agencies' },
};

const ALL_FEED_CATEGORIES = ['All', 'Creators', 'Models', 'Entertainment', 'Night Clubs', 'Webcam', 'Photography', 'Studios', 'Agencies'];

const SECTIONS = [
  { id: 'age-gate', label: 'Age Gate' },
  { id: 'feed',     label: 'Feed' },
  { id: 'services', label: 'Services' },
  { id: 'search',   label: 'Search' },
  { id: 'creators', label: 'Creators' },
  { id: 'models',   label: 'Models' },
  { id: 'clubs',    label: 'Clubs' },
  { id: 'premium',  label: 'Premium' },
  { id: 'profile',  label: 'Profile' },
];

// ─── page ────────────────────────────────────────────────────────

export default function AdultPreviewPage() {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [feedCategory, setFeedCategory]       = useState('All');
  const [feedSort, setFeedSort]               = useState('trending');
  const [serviceCategory, setServiceCategory] = useState('All');

  const profileCreator = MOCK_CREATORS[0];
  const onlineCreators = MOCK_CREATORS.filter(c => c.isOnline);
  const creatorsOnly   = MOCK_CREATORS.filter(c => c.category === 'Creators');
  const modelsOnly     = MOCK_CREATORS.filter(c => c.category === 'Models');
  const clubsOnly      = MOCK_CREATORS.filter(c => c.category === 'Night Clubs');

  const serviceProviders = serviceCategory === 'All'
    ? MOCK_CREATORS
    : MOCK_CREATORS.filter(c => c.category === serviceCategory);

  const feedCreators = feedCategory === 'All'
    ? MOCK_CREATORS
    : MOCK_CREATORS.filter(c => c.category === feedCategory);

  return (
    <div className="theme-adult dark">

      {/* ── Fixed: main navigation ── */}
      <AdultNavigation />

      {/* ── Fixed: section quick-nav ── */}
      <div
        className="fixed top-16 left-0 right-0 z-[99]"
        style={{
          background: 'rgba(9,9,9,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--adult-border)',
        }}
      >
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="flex items-center gap-1 py-2 overflow-x-auto">
            <span
              className="text-[10px] font-bold tracking-widest shrink-0 self-center mr-2 uppercase"
              style={{ color: 'var(--adult-text-dim)' }}
            >
              Preview
            </span>
            {SECTIONS.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className="shrink-0 text-xs px-3 py-1 rounded-full font-medium transition-colors duration-150 hover:bg-white/5"
                style={{ color: 'var(--adult-text-muted)', textDecoration: 'none' }}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Scrollable body — offset for 2 fixed bars (64 + 40 = 104px) ── */}
      <div style={{ background: 'var(--adult-bg)', minHeight: '100vh', paddingTop: '104px' }}>

        {/* ════════════════════════════════════════════════════════
            1. AGE GATE
        ════════════════════════════════════════════════════════ */}
        <section id="age-gate" className="scroll-mt-28">
          <SectionLabel number={1} label="Age Gate" />

          <div
            className="flex items-center justify-center px-4 py-16"
            style={{ background: 'linear-gradient(180deg, #0d0509 0%, #1a0a14 50%, var(--adult-bg) 100%)' }}
          >
            <div className="w-full max-w-sm text-center">

              {/* Logo */}
              <div className="flex items-center justify-center gap-3 mb-10">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-2xl select-none"
                  style={{ background: 'var(--adult-gradient)' }}
                  aria-hidden
                >
                  GZ
                </div>
                <div className="text-left">
                  <p className="font-bold text-xl tracking-tight leading-none text-foreground">GigZone</p>
                  <p className="font-black text-xs tracking-[0.3em] mt-0.5" style={{ color: 'var(--adult-accent-2)' }}>
                    ADULT
                  </p>
                </div>
              </div>

              {/* 18+ badge */}
              <div
                role="img"
                aria-label="18 plus — adults only"
                className="w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-3xl mx-auto mb-6 shadow-2xl select-none"
                style={{ background: 'var(--adult-gradient)', boxShadow: '0 0 40px rgba(139,30,63,0.4)' }}
              >
                18+
              </div>

              <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">Adults Only</h1>
              <p className="text-sm mb-10 text-muted-foreground">
                This section contains content intended for adults only.
                <br />You must be 18 or older to continue.
              </p>

              <div className="w-full mb-6" style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--adult-border), transparent)' }} />

              <label className="flex items-start gap-3 cursor-pointer mb-8 text-left w-full" htmlFor="age-gate-confirm">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    id="age-gate-confirm"
                    type="checkbox"
                    checked={ageConfirmed}
                    onChange={e => setAgeConfirmed(e.target.checked)}
                    className="sr-only"
                    aria-label="I confirm I am at least 18 years of age"
                  />
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200"
                    style={{
                      background: ageConfirmed ? 'var(--adult-gradient)' : 'transparent',
                      border: ageConfirmed ? 'none' : '2px solid var(--adult-border)',
                    }}
                  >
                    {ageConfirmed && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">
                  I confirm that I am at least{' '}
                  <span className="text-foreground font-medium">18 years of age</span>{' '}
                  and agree to the terms of service for adult content.
                </span>
              </label>

              <Button
                disabled={!ageConfirmed}
                className="w-full h-14 text-base font-bold rounded-2xl mb-3 btn-adult-gradient disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Enter GigZone Adult
              </Button>

              <Button variant="outline" className="w-full h-12 rounded-2xl">
                ← Back to GigZone
              </Button>

              <p className="mt-8 text-xs leading-relaxed" style={{ color: 'var(--adult-text-dim)' }}>
                By entering, you confirm you are of legal age in your jurisdiction.
                All content is produced by and for consenting adults.
              </p>
            </div>
          </div>
        </section>

        <Divider />

        {/* ════════════════════════════════════════════════════════
            2. FEED
        ════════════════════════════════════════════════════════ */}
        <section id="feed" className="scroll-mt-28">
          <SectionLabel number={2} label="Feed — Discover Creators" />

          <div className="max-w-[1400px] mx-auto px-4 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-1">Discover Creators</h1>
              <p className="text-sm text-muted-foreground">
                {MOCK_CREATORS.length} creators available · Updated daily
              </p>
            </div>

            {/* Search + Sort */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <SearchIcon
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                  aria-hidden
                />
                <input
                  readOnly
                  placeholder="Search creators, categories, cities..."
                  aria-label="Search creators"
                  className="w-full h-11 pl-10 pr-4 rounded-xl text-sm outline-none"
                  style={{
                    background: 'var(--adult-surface)',
                    border: '1px solid var(--adult-border)',
                    color: 'var(--adult-text)',
                  }}
                />
              </div>
              <div className="flex gap-2" role="group" aria-label="Sort options">
                {([
                  { key: 'trending', label: 'Trending', Icon: TrendingUp },
                  { key: 'newest',   label: 'Newest',   Icon: Clock },
                  { key: 'top',      label: 'Top Rated', Icon: Star },
                ] as const).map(({ key, label, Icon }) => (
                  <Button
                    key={key}
                    onClick={() => setFeedSort(key)}
                    variant={feedSort === key ? 'default' : 'outline'}
                    size="sm"
                    className={`h-11 shrink-0 ${feedSort === key ? 'btn-adult-gradient' : ''}`}
                    aria-pressed={feedSort === key}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden sm:inline ml-1.5">{label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Category pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-8" role="group" aria-label="Filter by category">
              {ALL_FEED_CATEGORIES.map(cat => (
                <Button
                  key={cat}
                  onClick={() => setFeedCategory(cat)}
                  variant={feedCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  className={`shrink-0 rounded-full ${feedCategory === cat ? 'btn-adult-gradient' : ''}`}
                  aria-pressed={feedCategory === cat}
                >
                  {cat}
                </Button>
              ))}
            </div>

            {/* Live Now */}
            <section className="mb-10" aria-label="Creators live now">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full adult-pulse" style={{ background: 'var(--adult-online)' }} aria-hidden />
                <h2 className="text-sm font-semibold text-foreground">Live Now</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {onlineCreators.length} online
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {onlineCreators.map(c => <CreatorCardCompact key={c.id} creator={c} />)}
              </div>
            </section>

            {/* Main grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {feedCreators.map(c => <CreatorCard key={c.id} creator={c} />)}
            </div>
          </div>
        </section>

        <Divider />

        {/* ════════════════════════════════════════════════════════
            3. SERVICES
        ════════════════════════════════════════════════════════ */}
        <section id="services" className="scroll-mt-28">
          <SectionLabel number={3} label="Services" />

          <div className="max-w-[1400px] mx-auto px-4 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-1">Services</h1>
              <p className="text-sm text-muted-foreground">Premium services from verified professionals</p>
            </div>

            {/* Category tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10" role="group" aria-label="Filter by category">
              <button
                onClick={() => setServiceCategory('All')}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-200 border"
                style={serviceCategory === 'All'
                  ? { background: 'rgba(139,30,63,0.13)', border: '1px solid var(--adult-accent)' }
                  : { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }
                }
                aria-pressed={serviceCategory === 'All'}
              >
                <Globe className="h-6 w-6" style={{ color: serviceCategory === 'All' ? 'var(--adult-accent-2)' : 'hsl(var(--muted-foreground))' }} aria-hidden />
                <span className="text-sm font-medium text-foreground">All</span>
                <span className="text-xs text-muted-foreground">{MOCK_CREATORS.length} providers</span>
              </button>

              {Object.entries(CATEGORY_META).map(([cat, meta]) => {
                const Icon = meta.icon;
                const isActive = serviceCategory === cat;
                const count = MOCK_CREATORS.filter(c => c.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setServiceCategory(cat)}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-200 border"
                    style={isActive
                      ? { background: `${meta.color}22`, border: `1px solid ${meta.color}` }
                      : { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }
                    }
                    aria-pressed={isActive}
                  >
                    <Icon className="h-6 w-6" style={{ color: isActive ? meta.color : 'hsl(var(--muted-foreground))' }} aria-hidden />
                    <span className="text-sm font-medium text-foreground">{cat}</span>
                    <span className="text-xs text-muted-foreground">{count} providers</span>
                  </button>
                );
              })}
            </div>

            {/* Provider list */}
            <div className="space-y-3" role="list" aria-label="Service providers">
              {serviceProviders.slice(0, 7).map(c => (
                <Card key={c.id} className="transition-all duration-200 hover:ring-1 hover:ring-primary/30">
                  <CardContent className="flex items-center gap-4 py-4">
                    <Avatar className="w-14 h-14 rounded-xl shrink-0">
                      <AvatarFallback className="rounded-xl text-base font-bold text-white" style={c.avatarStyle}>
                        {c.avatarInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{c.name}</span>
                        {c.verified && <CheckCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--adult-accent-2)' }} aria-label="Verified" />}
                        {c.isPremium && <Badge className="text-[10px] btn-adult-gradient border-0">PRO</Badge>}
                        {c.isOnline && (
                          <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--adult-online)' }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--adult-online)' }} aria-hidden />
                            Online
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] h-5">{c.category}</Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" aria-hidden />{c.countryFlag} {c.city}
                        </span>
                      </div>
                      <p className="text-xs mt-1 line-clamp-1 text-muted-foreground">{c.bio}</p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1" aria-label={`${c.rating.toFixed(1)} stars`}>
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" aria-hidden />
                        <span className="text-sm font-bold text-foreground">{c.rating.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">({c.reviewCount})</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" aria-hidden />{formatFollowers(c.followers)} followers
                      </div>
                      <div
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full mt-1"
                        style={{ background: 'rgba(139,30,63,0.13)', color: 'var(--adult-accent-2)', border: '1px solid rgba(139,30,63,0.25)' }}
                      >
                        <Zap className="h-3 w-3" aria-hidden />{c.supportPrice} credits
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <Divider />

        {/* ════════════════════════════════════════════════════════
            4. SEARCH
        ════════════════════════════════════════════════════════ */}
        <section id="search" className="scroll-mt-28">
          <SectionLabel number={4} label="Search" />

          <div className="max-w-[1400px] mx-auto px-4 py-8">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground mb-1">Search</h1>
              <p className="text-sm text-muted-foreground">Find creators, models, and services across the platform</p>
            </div>

            {/* Search bar */}
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
                <input
                  readOnly
                  placeholder="Search by name, city, description..."
                  aria-label="Search creators"
                  className="w-full h-12 pl-11 pr-4 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--adult-surface)', border: '1px solid var(--adult-border)', color: 'var(--adult-text)' }}
                />
              </div>
              <Button className="h-12 gap-2 btn-adult-gradient" aria-label="Toggle filters">
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Filters</span>
              </Button>
            </div>

            {/* Filters panel */}
            <Card className="mb-6">
              <CardContent className="pt-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Filters</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  {['Country', 'Category', 'Minimum Rating'].map(label => (
                    <div key={label}>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
                      <select
                        disabled
                        className="w-full h-10 px-3 rounded-xl text-sm outline-none appearance-none opacity-60"
                        style={{ background: 'var(--adult-surface)', border: '1px solid var(--adult-border)', color: 'var(--adult-text)' }}
                      >
                        <option>All</option>
                      </select>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Quick filters">
                  {['✓ Verified Only', '★ Premium Only', '● Online Now'].map(label => (
                    <Button key={label} variant="outline" size="sm">{label}</Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <p className="text-sm mb-4 text-muted-foreground">{MOCK_CREATORS.length} results</p>

            {/* Search results grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {MOCK_CREATORS.slice(0, 8).map(c => (
                <Card key={c.id} className="overflow-hidden transition-all duration-200 hover:ring-1 hover:ring-primary/30 adult-fadein">
                  <div className="h-28 relative" style={c.coverStyle}>
                    {c.isOnline && (
                      <span
                        className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
                        aria-label="Live"
                      >
                        <span className="w-1.5 h-1.5 rounded-full adult-pulse" style={{ background: 'var(--adult-online)' }} aria-hidden />
                        LIVE
                      </span>
                    )}
                    {c.isPremium && (
                      <Badge className="absolute top-2 right-2 text-[10px] btn-adult-gradient border-0" aria-label="Premium">
                        PRO
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-12 h-12 rounded-xl border-2 border-background -mt-8 shrink-0 shadow-xl">
                        <AvatarFallback className="rounded-xl text-sm font-bold text-white" style={c.avatarStyle}>
                          {c.avatarInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-foreground truncate">{c.name}</span>
                          {c.verified && <CheckCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--adult-accent-2)' }} aria-label="Verified" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{c.category} · {c.countryFlag} {c.city}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" aria-hidden />
                        <span className="text-sm font-bold text-foreground">{c.rating.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">({c.reviewCount})</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" aria-hidden />{formatFollowers(c.followers)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <Divider />

        {/* ════════════════════════════════════════════════════════
            5. CREATORS
        ════════════════════════════════════════════════════════ */}
        <section id="creators" className="scroll-mt-28">
          <SectionLabel number={5} label="Creators" />

          <div className="max-w-[1400px] mx-auto px-4 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-1">Creators</h1>
              <p className="text-sm text-muted-foreground">
                Top content creators — {creatorsOnly.length} available
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {creatorsOnly.map(c => <CreatorCard key={c.id} creator={c} />)}
            </div>
          </div>
        </section>

        <Divider />

        {/* ════════════════════════════════════════════════════════
            6. MODELS
        ════════════════════════════════════════════════════════ */}
        <section id="models" className="scroll-mt-28">
          <SectionLabel number={6} label="Models" />

          <div className="max-w-[1400px] mx-auto px-4 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-1">Models</h1>
              <p className="text-sm text-muted-foreground">
                Professional models for hire — {modelsOnly.length} available
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {modelsOnly.map(c => <CreatorCard key={c.id} creator={c} />)}
            </div>
          </div>
        </section>

        <Divider />

        {/* ════════════════════════════════════════════════════════
            7. CLUBS
        ════════════════════════════════════════════════════════ */}
        <section id="clubs" className="scroll-mt-28">
          <SectionLabel number={7} label="Clubs & Venues" />

          {/* Hero */}
          <div
            className="relative py-16 px-4 overflow-hidden"
            style={{ background: 'linear-gradient(180deg, rgba(14,116,144,0.12) 0%, var(--adult-bg) 100%)' }}
          >
            <div className="max-w-[1400px] mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, #0e7490, #06b6d4)' }}
                  aria-hidden
                >
                  <Moon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <Badge className="border-0 text-[10px] tracking-wider mb-1 text-white" style={{ background: 'linear-gradient(135deg, #0e7490, #06b6d4)' }}>
                    VENUES
                  </Badge>
                  <h1 className="text-3xl font-bold text-foreground">Night Clubs & Venues</h1>
                </div>
              </div>
              <p className="text-muted-foreground max-w-xl mb-6 text-sm">
                Discover premium clubs, lounges, and entertainment venues. Book VIP tables, events, and exclusive experiences across Europe.
              </p>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-2xl font-black text-foreground">{clubsOnly.length}</p>
                  <p className="text-xs text-muted-foreground">Venues</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black" style={{ color: 'var(--adult-online)' }}>
                    {clubsOnly.filter(c => c.isOnline).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Open Tonight</p>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-[1400px] mx-auto px-4 pb-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {clubsOnly.map(c => <CreatorCard key={c.id} creator={c} />)}
            </div>

            <div
              className="mt-12 rounded-2xl p-8 text-center"
              style={{ background: 'rgba(14,116,144,0.08)', border: '1px solid rgba(14,116,144,0.2)' }}
            >
              <h3 className="text-xl font-bold text-foreground mb-2">Own a Club or Venue?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                List your venue on GigZone Adult and reach thousands of guests looking for exclusive experiences.
              </p>
              <Button className="btn-adult-gradient">List Your Venue</Button>
            </div>
          </div>
        </section>

        <Divider />

        {/* ════════════════════════════════════════════════════════
            8. PREMIUM
        ════════════════════════════════════════════════════════ */}
        <section id="premium" className="scroll-mt-28">
          <SectionLabel number={8} label="Premium Plans" />

          {/* Hero */}
          <div
            className="relative py-20 px-4 text-center overflow-hidden"
            style={{ background: 'linear-gradient(180deg, #1a0a14 0%, var(--adult-bg) 100%)' }}
          >
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(139,30,63,0.2) 0%, transparent 70%)' }}
            />
            <div className="relative z-10 max-w-2xl mx-auto">
              <Badge className="btn-adult-gradient border-0 mb-6 gap-1.5 px-3 py-1.5 text-xs font-bold tracking-wide">
                <Star className="h-3 w-3 fill-current" aria-hidden /> PREMIUM PLANS
              </Badge>
              <h1 className="text-4xl sm:text-5xl font-black text-foreground mb-4 leading-tight">
                Grow Your Creator
                <br />
                <span style={{ background: 'var(--adult-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Business
                </span>
              </h1>
              <p className="text-base max-w-lg mx-auto text-muted-foreground">
                Join thousands of premium creators earning more with better visibility, analytics, and tools.
              </p>
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-4 pb-16">
            {/* Pricing cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16 -mt-8">
              {PREMIUM_PLANS.map(plan => (
                <Card
                  key={plan.name}
                  className="overflow-hidden"
                  style={plan.popular
                    ? { border: '1px solid var(--adult-accent)', boxShadow: '0 0 40px rgba(139,30,63,0.25)' }
                    : undefined
                  }
                >
                  {plan.popular && (
                    <div className="text-center py-2 text-xs font-black tracking-wider text-white btn-adult-gradient" aria-label="Most popular">
                      MOST POPULAR
                    </div>
                  )}
                  <CardContent className="p-6">
                    <h3 className="text-sm font-semibold mb-1" style={{ color: plan.accentHex }}>{plan.name}</h3>
                    <div className="flex items-end gap-1 mb-5">
                      <span className="text-4xl font-black text-foreground">{plan.price === 0 ? 'Free' : `€${plan.price}`}</span>
                      {plan.period && <span className="text-sm pb-1 text-muted-foreground">{plan.period}</span>}
                    </div>
                    <Button
                      disabled={plan.ctaOff}
                      className={`w-full mb-6 ${!plan.ctaOff && plan.popular ? 'btn-adult-gradient' : ''}`}
                      variant={plan.ctaOff ? 'outline' : plan.popular ? 'default' : 'secondary'}
                    >
                      {plan.cta}
                    </Button>
                    <ul className="space-y-3">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          {feat.ok
                            ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: plan.popular ? plan.accentHex : 'hsl(142 71% 45%)' }} aria-hidden />
                            : <X className="h-4 w-4 shrink-0 mt-0.5 text-muted" aria-hidden />
                          }
                          <span className={`text-xs ${feat.ok ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                            {feat.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Feature highlights */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-foreground text-center mb-2">Why go Premium?</h2>
              <p className="text-sm text-center mb-8 text-muted-foreground">
                Everything you need to grow your creator career on GigZone Adult
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {PREMIUM_FEATURES.map(({ icon: Icon, title, desc }) => (
                  <Card key={title}>
                    <CardContent className="pt-5">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                        style={{ background: 'rgba(139,30,63,0.12)', border: '1px solid rgba(139,30,63,0.25)' }}
                        aria-hidden
                      >
                        <Icon className="h-5 w-5" style={{ color: 'var(--adult-accent-2)' }} />
                      </div>
                      <h4 className="font-semibold text-foreground text-sm mb-2">{title}</h4>
                      <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* CTA */}
            <Card style={{ border: '1px solid rgba(139,30,63,0.25)', background: 'linear-gradient(135deg, #1a0a14, hsl(var(--card)))' }}>
              <CardContent className="py-10 text-center">
                <p className="text-2xl font-bold text-foreground mb-1">Join 2,400+ Premium Creators</p>
                <p className="text-sm mb-6 text-muted-foreground">
                  Creators on Premium earn on average{' '}
                  <span className="text-foreground font-semibold">3.2× more</span> than free accounts.
                </p>
                <Button
                  className="btn-adult-gradient px-8 py-3.5 h-auto text-sm font-bold rounded-2xl hover:opacity-90"
                  style={{ boxShadow: '0 8px 32px rgba(139,30,63,0.4)' }}
                >
                  Start Creator Plan — €29/mo
                </Button>
                <p className="text-xs mt-3" style={{ color: 'var(--adult-text-dim)' }}>Cancel anytime. No hidden fees.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <Divider />

        {/* ════════════════════════════════════════════════════════
            9. CREATOR PROFILE
        ════════════════════════════════════════════════════════ */}
        <section id="profile" className="scroll-mt-28">
          <SectionLabel number={9} label={`Creator Profile — ${profileCreator.name}`} />

          {/* Cover */}
          <div className="relative h-56 sm:h-72 w-full" style={profileCreator.coverStyle}>
            <div className="absolute inset-0" style={{ background: 'var(--adult-gradient-cover)' }} aria-hidden />
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              {profileCreator.isOnline && (
                <span
                  className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full text-white"
                  style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}
                  aria-label="Live now"
                >
                  <span className="w-2 h-2 rounded-full adult-pulse" style={{ background: 'var(--adult-online)' }} aria-hidden />
                  LIVE NOW
                </span>
              )}
              {profileCreator.isPremium && (
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                  style={{ background: 'var(--adult-gradient)' }}
                  aria-label="Premium creator"
                >
                  ★ PREMIUM
                </span>
              )}
            </div>
          </div>

          <div className="max-w-4xl mx-auto px-4 pb-16">
            {/* Profile header */}
            <div className="flex items-end gap-4 -mt-10 mb-6">
              <Avatar className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl shrink-0 shadow-2xl border-4 border-background">
                <AvatarFallback className="rounded-2xl text-2xl font-black text-white" style={profileCreator.avatarStyle}>
                  {profileCreator.avatarInitials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex items-center gap-2 ml-auto pb-1">
                <Button className="btn-adult-gradient" aria-label="Follow">Follow</Button>
                <Button variant="outline" className="gap-1.5" aria-label="Support">
                  <Zap className="h-3.5 w-3.5" style={{ color: 'var(--adult-accent-2)' }} aria-hidden /> Support
                </Button>
                <Button variant="outline" className="gap-1.5" aria-label="Message">
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Message
                </Button>
              </div>
            </div>

            {/* Name + meta */}
            <div className="mb-4">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-2xl font-bold text-foreground">{profileCreator.name}</h1>
                {profileCreator.verified && (
                  <CheckCircle className="h-5 w-5 shrink-0" style={{ color: 'var(--adult-accent-2)' }} aria-label="Verified creator" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {profileCreator.handle} · {profileCreator.category}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {profileCreator.countryFlag} {profileCreator.city}
                </span>
                <span className="flex items-center gap-1" aria-label={`${profileCreator.rating.toFixed(1)} stars from ${profileCreator.reviewCount} reviews`}>
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" aria-hidden />
                  <span className="text-sm font-bold text-foreground">{profileCreator.rating.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">({profileCreator.reviewCount} reviews)</span>
                </span>
              </div>
            </div>

            {/* Stats card */}
            <Card className="mb-4">
              <CardContent className="grid grid-cols-4 gap-4 py-4">
                {[
                  { label: 'Followers', value: formatFollowers(profileCreator.followers) },
                  { label: 'Following', value: formatFollowers(profileCreator.following) },
                  { label: 'Gallery',   value: profileCreator.galleryCount },
                  { label: 'Videos',    value: profileCreator.videoCount },
                ].map(stat => (
                  <div key={stat.label} className="text-center" aria-label={`${stat.label}: ${stat.value}`}>
                    <p className="text-lg font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Mobile actions */}
            <div className="flex gap-2 mb-6 sm:hidden">
              <Button className="flex-1 btn-adult-gradient">Follow</Button>
              <Button variant="outline" className="gap-1.5">
                <Zap className="h-4 w-4" style={{ color: 'var(--adult-accent-2)' }} aria-hidden /> Support
              </Button>
              <Button variant="outline" size="icon" aria-label="Message">
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-6" aria-label="Tags">
              {profileCreator.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">#{tag}</Badge>
              ))}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="About" className="mb-8">
              <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start h-auto p-0 mb-6 gap-1 overflow-x-auto">
                {(['About', 'Gallery', 'Videos', 'Services', 'Reviews'] as const).map(tab => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--adult-accent-2)] data-[state=active]:text-foreground data-[state=active]:bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap shrink-0"
                  >
                    {tab}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="About" className="space-y-4 mt-0">
                <Card>
                  <CardContent className="pt-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3">About</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{profileCreator.bio}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Details</h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Category', value: profileCreator.category },
                        { label: 'Location', value: `${profileCreator.countryFlag} ${profileCreator.city}` },
                        { label: 'Status',   value: profileCreator.isOnline ? '🟢 Online' : '⚫ Offline' },
                        { label: 'Verified', value: profileCreator.verified ? '✓ Verified' : 'Not verified' },
                        { label: 'Support',  value: `${profileCreator.supportPrice} credits` },
                      ].map(item => (
                        <div key={item.label} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="text-foreground font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="Gallery" className="mt-0">
                <div className="grid grid-cols-3 gap-1.5">
                  {GALLERY_GRADIENTS.concat(GALLERY_GRADIENTS)
                    .slice(0, Math.min(profileCreator.galleryCount, 12))
                    .map((grad, i) => (
                      <div
                        key={i}
                        className="aspect-square rounded-xl flex items-center justify-center"
                        style={{ background: grad }}
                        aria-label={`Gallery image ${i + 1}`}
                      >
                        <ImageIcon className="h-6 w-6 opacity-20 text-white" aria-hidden />
                      </div>
                    ))}
                </div>
                <p className="text-center text-sm mt-4 text-muted-foreground">
                  {profileCreator.galleryCount} photos total · Subscribe for full access
                </p>
              </TabsContent>

              <TabsContent value="Videos" className="mt-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Array.from({ length: Math.min(profileCreator.videoCount, 6) }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-video rounded-xl flex items-center justify-center relative overflow-hidden"
                      style={{ background: GALLERY_GRADIENTS[i % GALLERY_GRADIENTS.length] }}
                      aria-label={`Video ${i + 1}`}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
                        aria-hidden
                      >
                        <Play className="h-4 w-4 text-white ml-0.5" />
                      </div>
                      <p className="absolute bottom-2 right-2 text-xs text-white/60 font-medium" aria-hidden>
                        {Math.floor((i * 7 + 3) % 8 + 1)}:{String((i * 13 + 24) % 60).padStart(2, '0')}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-center text-sm mt-4 text-muted-foreground">
                  {profileCreator.videoCount} videos total · Subscribe for full access
                </p>
              </TabsContent>

              <TabsContent value="Services" className="space-y-3 mt-0">
                {[
                  { title: 'Basic Package',   price: profileCreator.supportPrice,      desc: 'Access to all public content',           duration: 'monthly' },
                  { title: 'Premium Package', price: profileCreator.supportPrice * 3,  desc: 'Full access + exclusive content + DMs', duration: 'monthly' },
                  { title: 'Custom Booking',  price: profileCreator.supportPrice * 10, desc: 'Personalized sessions and custom content', duration: 'per session' },
                ].map(pkg => (
                  <Card key={pkg.title}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div>
                        <p className="font-semibold text-foreground text-sm">{pkg.title}</p>
                        <p className="text-xs mt-0.5 text-muted-foreground">{pkg.desc}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-bold text-foreground">
                          {pkg.price}{' '}
                          <span className="text-xs font-normal text-muted-foreground">credits</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">{pkg.duration}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="Reviews" className="space-y-3 mt-0">
                <Card>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="text-center" aria-label={`Overall rating: ${profileCreator.rating.toFixed(1)}`}>
                      <p className="text-4xl font-black text-foreground">{profileCreator.rating.toFixed(1)}</p>
                      <div className="flex gap-0.5 justify-center mt-1" aria-hidden>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(profileCreator.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`} />
                        ))}
                      </div>
                      <p className="text-xs mt-1 text-muted-foreground">{profileCreator.reviewCount} reviews</p>
                    </div>
                    <div className="flex-1" aria-hidden>
                      {[5, 4, 3, 2, 1].map(n => (
                        <div key={n} className="flex items-center gap-2 mb-1">
                          <span className="text-xs w-2 text-muted-foreground">{n}</span>
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: n === 5 ? '70%' : n === 4 ? '20%' : n === 3 ? '7%' : '3%',
                                background: 'var(--adult-gradient)',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {REVIEW_MOCKS.map((review, i) => (
                  <Card key={i}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="text-xs font-bold bg-muted text-foreground">
                              {review.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium text-foreground">{review.name}</span>
                        </div>
                        <div className="flex items-center gap-1" aria-label={`${review.rating} stars, ${review.date}`}>
                          {Array.from({ length: review.rating }).map((_, j) => (
                            <Star key={j} className="h-3 w-3 fill-yellow-400 text-yellow-400" aria-hidden />
                          ))}
                          <span className="text-xs ml-1 text-muted-foreground">{review.date}</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{review.text}</p>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </div>
        </section>

        <div className="h-16" aria-hidden />
      </div>
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────────

function SectionLabel({ number, label }: { number: number; label: string }) {
  return (
    <div
      className="px-4 py-2.5"
      style={{ borderBottom: '1px solid rgba(139,30,63,0.2)', background: 'rgba(9,9,9,0.6)' }}
    >
      <div className="max-w-[1400px] mx-auto flex items-center gap-3">
        <span
          className="text-xs font-black w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0 select-none"
          style={{ background: 'var(--adult-gradient)' }}
          aria-hidden
        >
          {number}
        </span>
        <span className="text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--adult-accent-2)' }}>
          {label}
        </span>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-3" style={{ background: 'var(--adult-surface)' }} aria-hidden />;
}
