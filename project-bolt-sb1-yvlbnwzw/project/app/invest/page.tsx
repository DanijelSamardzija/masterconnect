'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/contexts/language-context';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, Search, MapPin, Calendar, Bookmark, BookmarkCheck,
  ChevronRight, X, Target, Building2, Rocket, HardHat, Leaf,
  Code2, Star, CheckCircle2, Eye, Users, DollarSign, ArrowUpRight,
  Info, Lock, Shield, BarChart2, Globe, Zap, Award,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type RiskLevel = 'Low' | 'Medium' | 'High';
type ProjectStatus = 'coming_soon' | 'preview' | 'under_review';

type Project = {
  id: string;
  title: string;
  description: string;
  category: string;
  city: string;
  country: string;
  funding_goal: number;
  funding_pct: number;
  minimum_investment: number;
  funding_deadline: string;
  expected_return: string;
  estimated_roi: string;
  risk_level: RiskLevel;
  status: ProjectStatus;
  is_verified: boolean;
  investors: number;
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const PROJECTS: Project[] = [
  {
    id: '1', title: 'Auto Service Expansion',
    description: 'Established auto repair shop in Belgrade expanding with new equipment and a second location. 12 years in business with a loyal customer base of 800+ clients.',
    category: 'Local businesses', city: 'Belgrade', country: 'Serbia',
    funding_goal: 50000, funding_pct: 34, minimum_investment: 500,
    funding_deadline: '2025-09-30', expected_return: '12–18% annually',
    estimated_roi: '15%', risk_level: 'Medium', status: 'preview',
    is_verified: false, investors: 7,
  },
  {
    id: '2', title: 'Local Bakery Equipment Upgrade',
    description: 'Family-owned bakery in Novi Sad operating 20 years. Upgrading ovens to supply local supermarkets and hotels with capacity tripled.',
    category: 'Local businesses', city: 'Novi Sad', country: 'Serbia',
    funding_goal: 18000, funding_pct: 61, minimum_investment: 200,
    funding_deadline: '2025-08-15', expected_return: '8–12% annually',
    estimated_roi: '10%', risk_level: 'Low', status: 'preview',
    is_verified: false, investors: 14,
  },
  {
    id: '3', title: 'Solar Panel Installation',
    description: 'Clean energy startup offering solar installations to residential and commercial clients. Scaling panel inventory and installation team across central Serbia.',
    category: 'Tech', city: 'Kragujevac', country: 'Serbia',
    funding_goal: 75000, funding_pct: 22, minimum_investment: 1000,
    funding_deadline: '2025-10-31', expected_return: '14–20% annually',
    estimated_roi: '17%', risk_level: 'Medium', status: 'preview',
    is_verified: false, investors: 5,
  },
  {
    id: '4', title: 'Construction Company Growth',
    description: 'Licensed construction firm with 30+ completed projects. Acquiring heavy machinery to take on larger residential and commercial contracts.',
    category: 'Construction', city: 'Niš', country: 'Serbia',
    funding_goal: 120000, funding_pct: 11, minimum_investment: 2000,
    funding_deadline: '2025-11-30', expected_return: '16–22% annually',
    estimated_roi: '19%', risk_level: 'High', status: 'coming_soon',
    is_verified: false, investors: 3,
  },
  {
    id: '5', title: 'Farming Equipment Investment',
    description: 'Vojvodina family farm growing wheat, corn and sunflower. Modern harvesting equipment to increase yield efficiency and cut costs by 30%.',
    category: 'Farming', city: 'Subotica', country: 'Serbia',
    funding_goal: 35000, funding_pct: 48, minimum_investment: 300,
    funding_deadline: '2025-07-31', expected_return: '10–14% annually',
    estimated_roi: '12%', risk_level: 'Low', status: 'preview',
    is_verified: false, investors: 11,
  },
  {
    id: '6', title: 'Tech Startup — B2B SaaS',
    description: 'Early-stage SaaS platform for small business invoicing and accounting. Already 120 paying beta users. Seeking seed investment for product expansion.',
    category: 'Startups', city: 'Belgrade', country: 'Serbia',
    funding_goal: 90000, funding_pct: 18, minimum_investment: 1500,
    funding_deadline: '2025-12-15', expected_return: '20–35% annually',
    estimated_roi: '27%', risk_level: 'High', status: 'preview',
    is_verified: false, investors: 4,
  },
];

const TABS = [
  { key: 'all',              labelKey: 'invest.tab.explore',      icon: TrendingUp },
  { key: 'trending',         labelKey: 'invest.tab.trending',     icon: Star },
  { key: 'Local businesses', labelKey: 'invest.tab.local',        icon: Building2 },
  { key: 'Startups',         labelKey: 'invest.tab.startups',     icon: Rocket },
  { key: 'Construction',     labelKey: 'invest.tab.construction', icon: HardHat },
  { key: 'Farming',          labelKey: 'invest.tab.farming',      icon: Leaf },
  { key: 'Tech',             labelKey: 'invest.tab.tech',         icon: Code2 },
  { key: 'saved',            labelKey: 'invest.tab.saved',        icon: Bookmark },
  { key: 'mine',             labelKey: 'invest.tab.mine',         icon: Users },
];

const RISK_STYLES: Record<RiskLevel, { bar: string; text: string; bg: string }> = {
  Low:    { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  Medium: { bar: 'bg-amber-500',   text: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  High:   { bar: 'bg-red-500',     text: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Local businesses': Building2, 'Startups': Rocket,
  'Construction': HardHat, 'Farming': Leaf, 'Tech': Code2,
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  'Local businesses': 'from-blue-600/20 to-blue-800/10',
  'Startups':         'from-purple-600/20 to-purple-800/10',
  'Construction':     'from-orange-600/20 to-orange-800/10',
  'Farming':          'from-emerald-600/20 to-emerald-800/10',
  'Tech':             'from-cyan-600/20 to-cyan-800/10',
};

const ICON_COLORS: Record<string, string> = {
  'Local businesses': 'text-blue-400',
  'Startups':         'text-purple-400',
  'Construction':     'text-orange-400',
  'Farming':          'text-emerald-400',
  'Tech':             'text-cyan-400',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

// ─── Coming Soon Modal ────────────────────────────────────────────────────────

function ComingSoonModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-sm animate-in zoom-in-95 duration-200"
          style={{ filter: 'drop-shadow(0 0 40px rgba(234,88,12,0.3))' }}
        >
          <div className="bg-[#0d1528] border border-orange-500/30 rounded-3xl p-7 text-center space-y-5">
            <div
              className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center"
              style={{ background: 'radial-gradient(circle, rgba(234,88,12,0.3) 0%, rgba(234,88,12,0.05) 100%)', boxShadow: '0 0 30px rgba(234,88,12,0.4)' }}
            >
              <TrendingUp className="h-8 w-8 text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">{t('invest.comingSoon')}</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                {t('invest.modal.desc')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all duration-200"
              style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)', boxShadow: '0 4px 20px rgba(234,88,12,0.4)' }}
            >
              {t('invest.modal.ok')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ project, saved, onComingSoon, onToggleSave }: {
  project: Project; saved: boolean;
  onComingSoon: () => void; onToggleSave: (id: string) => void;
}) {
  const { t } = useLanguage();
  const [hovered, setHovered] = useState(false);
  const Icon = CATEGORY_ICONS[project.category] || TrendingUp;
  const risk = RISK_STYLES[project.risk_level];
  const grad = CATEGORY_GRADIENTS[project.category] || 'from-slate-600/20 to-slate-800/10';
  const iconColor = ICON_COLORS[project.category] || 'text-slate-400';

  const riskLabel = `${t(`invest.risk.${project.risk_level}`)} ${t('invest.risk.suffix')}`;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: 'linear-gradient(145deg, #0d1528, #0a1020)',
        border: hovered ? '1px solid rgba(234,88,12,0.5)' : '1px solid rgba(255,255,255,0.07)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered ? '0 8px 40px rgba(234,88,12,0.15), 0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {/* Card top */}
      <div className={`relative h-36 bg-gradient-to-br ${grad} flex items-center justify-center`}>
        <Icon className={`h-12 w-12 ${iconColor} opacity-60`} />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${risk.bg} ${risk.text}`}>
            {riskLabel}
          </span>
          {project.status === 'preview' && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-orange-500/20 border border-orange-500/30 text-orange-400">
              {t('invest.card.previewBadge')}
            </span>
          )}
          {project.status === 'coming_soon' && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-500/20 border border-slate-500/30 text-slate-400">
              {t('invest.card.comingSoonBadge')}
            </span>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={() => onToggleSave(project.id)}
          className="absolute top-3 right-3 p-1.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 transition-all"
        >
          {saved
            ? <BookmarkCheck className="h-4 w-4 text-orange-400" />
            : <Bookmark className="h-4 w-4 text-slate-400" />
          }
        </button>

        {/* Investors count */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/50 border border-white/10 rounded-lg px-2 py-1">
          <Users className="h-3 w-3 text-slate-400" />
          <span className="text-[10px] text-slate-300 font-medium">{project.investors} {t('invest.card.interested')}</span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <p className="text-[11px] text-slate-500 font-medium mb-1">{project.category}</p>
          <h3 className="font-semibold text-white text-sm leading-snug">{project.title}</h3>
          <div className="flex items-center gap-1 mt-1.5">
            <MapPin className="h-3 w-3 text-slate-500 shrink-0" />
            <span className="text-[11px] text-slate-500">{project.city}, {project.country}</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{project.description}</p>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] text-slate-400">{t('invest.card.fundingProgress')}</span>
            <span className="text-[11px] font-semibold text-orange-400">{project.funding_pct}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${project.funding_pct}%`,
                background: 'linear-gradient(90deg, #ea580c, #f97316)',
                boxShadow: '0 0 8px rgba(234,88,12,0.6)',
              }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {fmt(project.funding_goal * project.funding_pct / 100)} {t('invest.card.raisedOf')} {fmt(project.funding_goal)}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2 text-center">
            <p className="text-[9px] text-slate-500 mb-0.5">{t('invest.card.minInvest')}</p>
            <p className="text-xs font-bold text-white">{fmt(project.minimum_investment)}</p>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2 text-center">
            <p className="text-[9px] text-slate-500 mb-0.5">{t('invest.card.estRoi')}</p>
            <p className="text-xs font-bold text-orange-400">{project.estimated_roi}</p>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2 text-center">
            <p className="text-[9px] text-slate-500 mb-0.5">{t('invest.card.deadline')}</p>
            <p className="text-xs font-bold text-white">
              {new Date(project.funding_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>

        {/* Return strip */}
        <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
          <TrendingUp className="h-3.5 w-3.5 text-orange-400 shrink-0" />
          <span className="text-[11px] text-slate-400">{t('invest.card.expected')} <span className="text-white font-medium">{project.expected_return}</span></span>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 mt-auto pt-1">
          <button
            onClick={onComingSoon}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium text-slate-300 border border-white/10 hover:border-white/20 hover:text-white transition-all bg-white/[0.04] hover:bg-white/[0.07]"
          >
            <Eye className="h-3.5 w-3.5" />
            {t('invest.card.view')}
          </button>
          <button
            onClick={onComingSoon}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all duration-200"
            style={{
              background: hovered ? 'linear-gradient(135deg, #ea580c, #c2410c)' : 'rgba(234,88,12,0.8)',
              boxShadow: hovered ? '0 4px 16px rgba(234,88,12,0.4)' : 'none',
            }}
          >
            <Zap className="h-3.5 w-3.5" />
            {t('invest.card.investNow')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Blurred locked section ───────────────────────────────────────────────────

function LockedSection({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none' }}>
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
        style={{ background: 'rgba(10,16,32,0.6)', backdropFilter: 'blur(2px)' }}>
        <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Lock className="h-5 w-5 text-slate-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvestPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState(false);

  const filtered = PROJECTS.filter(p => {
    if (activeTab === 'trending') return true;
    if (activeTab === 'saved') return saved.has(p.id);
    if (activeTab === 'mine') return false;
    if (activeTab !== 'all') return p.category === activeTab;
    return true;
  }).filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.city.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSave = (id: string) => setSaved(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const countLabel = (() => {
    if (activeTab === 'saved' && saved.size === 0) return t('invest.count.noSaved');
    if (activeTab === 'mine') return t('invest.count.noMine');
    return `${filtered.length} ${filtered.length === 1 ? t('invest.count.project') : t('invest.count.projects')}`;
  })();

  const heroStats = [
    { icon: Globe,      label: t('invest.stats.projectsListed'),   value: '5+',     sub: t('invest.stats.preview') },
    { icon: Users,      label: t('invest.stats.interestedUsers'),   value: '40+',    sub: t('invest.stats.registered') },
    { icon: DollarSign, label: t('invest.stats.totalGoal'),         value: '€388K',  sub: t('invest.stats.acrossProjects') },
    { icon: Award,      label: t('invest.stats.avgRoi'),            value: '16%',    sub: t('invest.stats.annually') },
  ];

  const dashboardLabels = [
    t('invest.dashboard.totalInvested'),
    t('invest.dashboard.activeProjects'),
    t('invest.dashboard.avgRoi'),
    t('invest.dashboard.nextPayout'),
  ];

  return (
    <div className="min-h-screen" style={{ background: '#080d18' }}>
      <style>{`
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 12px rgba(234,88,12,0.4), 0 0 24px rgba(234,88,12,0.15); }
          50%       { box-shadow: 0 0 20px rgba(234,88,12,0.7), 0 0 50px rgba(234,88,12,0.25); }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
        .glow-badge   { animation: glow-pulse 2.5s ease-in-out infinite; }
        .float-icon   { animation: float 3s ease-in-out infinite; }
        .shimmer-bar  {
          background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0) 100%);
          background-size: 400px 100%;
          animation: shimmer 2s infinite linear;
        }
      `}</style>

      {modal && <ComingSoonModal onClose={() => setModal(false)} />}

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(234,88,12,0.15) 0%, transparent 70%), linear-gradient(180deg, #0b1220 0%, #080d18 100%)' }}>
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative max-w-5xl mx-auto px-4 py-14 md:py-20 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <span
              className="glow-badge inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase text-orange-300"
              style={{ background: 'rgba(234,88,12,0.15)', border: '1px solid rgba(234,88,12,0.4)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              {t('invest.comingSoon')}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-4 text-white leading-tight">
            {t('invest.hero.title1')}{' '}
            <span style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {t('invest.hero.title2')}
            </span>
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-base md:text-lg leading-relaxed mb-8">
            {t('invest.hero.subtitle')}
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => setModal(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white text-sm transition-all duration-200 hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)', boxShadow: '0 4px 24px rgba(234,88,12,0.4)' }}
            >
              <Rocket className="h-4 w-4" />
              {t('invest.hero.submitProject')}
            </button>
            <button
              onClick={() => setModal(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-slate-300 text-sm border border-white/15 hover:border-white/30 hover:text-white transition-all duration-200 bg-white/[0.04] hover:bg-white/[0.08]"
            >
              <Users className="h-4 w-4" />
              {t('invest.hero.becomeInvestor')}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-12 max-w-2xl mx-auto">
            {heroStats.map(({ icon: Icon, label, value, sub }) => (
              <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Icon className="h-4 w-4 text-orange-400 mx-auto mb-1.5" />
                <p className="text-lg font-black text-white">{value}</p>
                <p className="text-[10px] text-slate-500 leading-tight">{label}</p>
                <p className="text-[9px] text-slate-600">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── DISCLAIMER ───────────────────────────────────────── */}
      <div style={{ background: 'rgba(251,191,36,0.05)', borderBottom: '1px solid rgba(251,191,36,0.15)' }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-start gap-2">
          <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-400/80 leading-relaxed">
            <strong className="text-amber-300">{t('invest.disclaimer.title')}</strong>{' '}
            {t('invest.disclaimer.body')}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* ── LOCKED DASHBOARD ─────────────────────────────────── */}
        <LockedSection title={t('invest.dashboard.title')} subtitle={t('invest.locked.available')}>
          <div className="p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-sm font-semibold text-white mb-4">{t('invest.dashboard.portfolio')}</p>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {dashboardLabels.map((l, i) => (
                <div key={l} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-xs text-slate-500">{l}</p>
                  <div className="h-5 mt-1 rounded shimmer-bar" style={{ width: ['70%', '50%', '60%', '80%'][i] }} />
                </div>
              ))}
            </div>
            <div className="h-24 rounded-xl shimmer-bar" />
          </div>
        </LockedSection>

        {/* ── SEARCH ───────────────────────────────────────────── */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            placeholder={t('invest.search.placeholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-10 py-3 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', caretColor: '#ea580c' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(234,88,12,0.4)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-slate-500 hover:text-white transition-colors" />
            </button>
          )}
        </div>

        {/* ── TABS ─────────────────────────────────────────────── */}
        <div className="overflow-x-auto -mx-4 px-4 pb-1">
          <div className="flex gap-2 min-w-max">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200"
                  style={active ? {
                    background: 'linear-gradient(135deg, rgba(234,88,12,0.3), rgba(234,88,12,0.15))',
                    border: '1px solid rgba(234,88,12,0.5)',
                    color: '#fb923c',
                    boxShadow: '0 0 12px rgba(234,88,12,0.2)',
                  } : {
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    color: '#64748b',
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(tab.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── COUNT ────────────────────────────────────────────── */}
        <p className="text-xs text-slate-600">{countLabel}</p>

        {/* ── PROJECT GRID ─────────────────────────────────────── */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => (
              <ProjectCard
                key={p.id} project={p}
                saved={saved.has(p.id)}
                onComingSoon={() => setModal(true)}
                onToggleSave={toggleSave}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 text-slate-700" />
            <p className="font-medium text-slate-400">{t('invest.empty.title')}</p>
            <p className="text-sm text-slate-600 mt-1">{t('invest.empty.subtitle')}</p>
          </div>
        )}

        {/* ── LOCKED LEADERBOARD ───────────────────────────────── */}
        <LockedSection title={t('invest.leaderboard.title')} subtitle={t('invest.locked.available')}>
          <div className="p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-sm font-semibold text-white mb-4">{t('invest.leaderboard.subtitle')}</p>
            {[92, 78, 65, 54, 43].map((w, i) => (
              <div key={i} className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 rounded-full shimmer-bar shrink-0" />
                <div className="flex-1">
                  <div className="h-3 rounded shimmer-bar mb-1" style={{ width: `${w}%` }} />
                  <div className="h-2 rounded shimmer-bar" style={{ width: `${w * 0.6}%` }} />
                </div>
                <div className="h-4 w-12 rounded shimmer-bar" />
              </div>
            ))}
          </div>
        </LockedSection>

        {/* ── BOTTOM CTA ───────────────────────────────────────── */}
        <div
          className="rounded-2xl p-7 text-center space-y-4"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(234,88,12,0.12) 0%, rgba(234,88,12,0.03) 70%)', border: '1px solid rgba(234,88,12,0.2)' }}
        >
          <div className="float-icon w-12 h-12 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'rgba(234,88,12,0.15)', border: '1px solid rgba(234,88,12,0.3)' }}>
            <BarChart2 className="h-6 w-6 text-orange-400" />
          </div>
          <h3 className="text-xl font-bold text-white">{t('invest.cta.title')}</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            {t('invest.cta.subtitle')}
          </p>
          <button
            onClick={() => setModal(true)}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-white text-sm transition-all duration-200 hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)', boxShadow: '0 4px 24px rgba(234,88,12,0.35)' }}
          >
            {t('invest.cta.button')}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
