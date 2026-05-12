'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  TrendingUp, Search, MapPin, Calendar, Shield, AlertTriangle,
  Bookmark, BookmarkCheck, ChevronRight, X, Target, Clock,
  Building2, Rocket, HardHat, Leaf, Code2, Star, CheckCircle2,
  Eye, Users, DollarSign, ArrowUpRight, Info,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type RiskLevel = 'Low' | 'Medium' | 'High';
type ProjectStatus = 'coming_soon' | 'preview' | 'under_review';

type InvestmentProject = {
  id: string;
  title: string;
  description: string;
  category: string;
  city: string;
  country: string;
  funding_goal: number;
  amount_raised: number;
  minimum_investment: number;
  maximum_investment: number;
  funding_deadline: string;
  expected_return: string;
  estimated_roi: string;
  risk_level: RiskLevel;
  status: ProjectStatus;
  verification_status: string;
  is_verified: boolean;
  image_url: string | null;
};

// ─── Dummy Data ───────────────────────────────────────────────────────────────

const DUMMY_PROJECTS: InvestmentProject[] = [
  {
    id: '1',
    title: 'Auto Service Expansion',
    description: 'Established auto repair shop in Belgrade looking to expand with new equipment, additional service bays and a second location in Novi Sad. 12 years in business with loyal customer base.',
    category: 'Local businesses',
    city: 'Belgrade',
    country: 'Serbia',
    funding_goal: 50000,
    amount_raised: 0,
    minimum_investment: 500,
    maximum_investment: 10000,
    funding_deadline: '2025-09-30',
    expected_return: '12–18% annually',
    estimated_roi: '15%',
    risk_level: 'Medium',
    status: 'preview',
    verification_status: 'unverified',
    is_verified: false,
    image_url: null,
  },
  {
    id: '2',
    title: 'Local Bakery Equipment Upgrade',
    description: 'Family-owned bakery in Novi Sad operating for 20 years. Looking to upgrade ovens and expand production capacity to supply local supermarkets and hotels.',
    category: 'Local businesses',
    city: 'Novi Sad',
    country: 'Serbia',
    funding_goal: 18000,
    amount_raised: 0,
    minimum_investment: 200,
    maximum_investment: 5000,
    funding_deadline: '2025-08-15',
    expected_return: '8–12% annually',
    estimated_roi: '10%',
    risk_level: 'Low',
    status: 'preview',
    verification_status: 'unverified',
    is_verified: false,
    image_url: null,
  },
  {
    id: '3',
    title: 'Solar Panel Installation Project',
    description: 'Clean energy startup offering solar installation services to residential and commercial clients. Seeking investment to purchase panel inventory and expand the installation team.',
    category: 'Tech',
    city: 'Kragujevac',
    country: 'Serbia',
    funding_goal: 75000,
    amount_raised: 0,
    minimum_investment: 1000,
    maximum_investment: 20000,
    funding_deadline: '2025-10-31',
    expected_return: '14–20% annually',
    estimated_roi: '17%',
    risk_level: 'Medium',
    status: 'preview',
    verification_status: 'unverified',
    is_verified: false,
    image_url: null,
  },
  {
    id: '4',
    title: 'Small Construction Company Growth',
    description: 'Licensed construction firm with 5 years of operation and 30+ completed projects. Investment needed for heavy machinery purchase to take on larger residential and commercial contracts.',
    category: 'Construction',
    city: 'Niš',
    country: 'Serbia',
    funding_goal: 120000,
    amount_raised: 0,
    minimum_investment: 2000,
    maximum_investment: 30000,
    funding_deadline: '2025-11-30',
    expected_return: '16–22% annually',
    estimated_roi: '19%',
    risk_level: 'High',
    status: 'coming_soon',
    verification_status: 'unverified',
    is_verified: false,
    image_url: null,
  },
  {
    id: '5',
    title: 'Farming Equipment Investment',
    description: 'Family farm in Vojvodina growing wheat, corn and sunflower. Seeking investment for modern harvesting equipment to increase yield efficiency and reduce operational costs by up to 30%.',
    category: 'Farming',
    city: 'Subotica',
    country: 'Serbia',
    funding_goal: 35000,
    amount_raised: 0,
    minimum_investment: 300,
    maximum_investment: 8000,
    funding_deadline: '2025-07-31',
    expected_return: '10–14% annually',
    estimated_roi: '12%',
    risk_level: 'Low',
    status: 'preview',
    verification_status: 'unverified',
    is_verified: false,
    image_url: null,
  },
];

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'all', label: 'Explore', icon: TrendingUp },
  { key: 'trending', label: 'Trending', icon: Star },
  { key: 'Local businesses', label: 'Local businesses', icon: Building2 },
  { key: 'Startups', label: 'Startups', icon: Rocket },
  { key: 'Construction', label: 'Construction', icon: HardHat },
  { key: 'Farming', label: 'Farming', icon: Leaf },
  { key: 'Tech', label: 'Tech', icon: Code2 },
  { key: 'saved', label: 'Saved', icon: Bookmark },
  { key: 'mine', label: 'My projects', icon: Users },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RISK_COLORS: Record<RiskLevel, string> = {
  Low: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  Medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  High: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  coming_soon: 'Coming soon',
  preview: 'Preview',
  under_review: 'Under review',
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Local businesses': Building2,
  'Startups': Rocket,
  'Construction': HardHat,
  'Farming': Leaf,
  'Tech': Code2,
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
}

// ─── Coming Soon Modal ────────────────────────────────────────────────────────

function ComingSoonModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-background border border-border rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground mb-2">Coming Soon</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Investment features are currently in development. Soon you will be able to submit projects, connect with investors and explore verified opportunities.
              </p>
            </div>
            <Button
              onClick={onClose}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl"
            >
              OK
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  saved,
  onComingSoon,
  onToggleSave,
}: {
  project: InvestmentProject;
  saved: boolean;
  onComingSoon: () => void;
  onToggleSave: (id: string) => void;
}) {
  const CategoryIcon = CATEGORY_ICONS[project.category] || TrendingUp;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      {/* Image placeholder */}
      <div className="h-40 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20 flex items-center justify-center relative">
        <CategoryIcon className="h-12 w-12 text-orange-300 dark:text-orange-700" />
        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_COLORS[project.risk_level]}`}>
            {project.risk_level} risk
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400">
            {STATUS_LABELS[project.status]}
          </span>
        </div>
        <button
          onClick={() => onToggleSave(project.id)}
          className="absolute top-3 right-3 p-1.5 rounded-xl bg-white/80 dark:bg-black/50 hover:bg-white dark:hover:bg-black/70 transition-colors"
        >
          {saved
            ? <BookmarkCheck className="h-4 w-4 text-orange-500" />
            : <Bookmark className="h-4 w-4 text-muted-foreground" />
          }
        </button>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Title + category */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs text-muted-foreground font-medium">{project.category}</span>
            {project.is_verified && (
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
            )}
          </div>
          <h3 className="font-semibold text-foreground text-base leading-snug">{project.title}</h3>
        </div>

        {/* Location */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span>{project.city}, {project.country}</span>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {project.description}
        </p>

        {/* Funding info */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted rounded-xl p-2.5">
            <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
              <Target className="h-3 w-3" /> Goal
            </p>
            <p className="text-sm font-semibold text-foreground">{formatCurrency(project.funding_goal)}</p>
          </div>
          <div className="bg-muted rounded-xl p-2.5">
            <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Min. invest
            </p>
            <p className="text-sm font-semibold text-foreground">{formatCurrency(project.minimum_investment)}</p>
          </div>
          <div className="bg-muted rounded-xl p-2.5">
            <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> Est. ROI
            </p>
            <p className="text-sm font-semibold text-orange-500">{project.estimated_roi}</p>
          </div>
          <div className="bg-muted rounded-xl p-2.5">
            <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Deadline
            </p>
            <p className="text-sm font-semibold text-foreground">
              {new Date(project.funding_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Expected return */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-xl px-3 py-2">
          <TrendingUp className="h-3.5 w-3.5 text-orange-400 shrink-0" />
          <span>Expected return: <span className="font-medium text-foreground">{project.expected_return}</span></span>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 mt-auto pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-xl text-xs"
            onClick={onComingSoon}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            View project
          </Button>
          <Button
            size="sm"
            className="flex-1 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold"
            onClick={onComingSoon}
          >
            Invest now
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvestPage() {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);

  const filteredProjects = DUMMY_PROJECTS.filter(p => {
    if (activeTab === 'trending') return true;
    if (activeTab === 'saved') return saved.has(p.id);
    if (activeTab === 'mine') return false;
    if (activeTab !== 'all') return p.category === activeTab;
    return true;
  }).filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.city.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSave = (id: string) => {
    setSaved(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {modalOpen && <ComingSoonModal onClose={() => setModalOpen(false)} />}

      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0b1220] via-[#0f1e35] to-[#0b1220] text-white">
        <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">
          <div className="flex flex-col items-center text-center gap-4">
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs font-semibold px-3 py-1">
              Coming soon
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Invest in real projects
            </h1>
            <p className="text-slate-300 max-w-xl text-base md:text-lg leading-relaxed">
              Discover local businesses, startups and service projects looking for investors.
            </p>
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-6"
                onClick={() => setModalOpen(true)}
              >
                <Rocket className="h-4 w-4 mr-2" />
                Submit a project
              </Button>
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 rounded-xl px-6"
                onClick={() => setModalOpen(true)}
              >
                <Users className="h-4 w-4 mr-2" />
                Become an investor
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Legal disclaimer */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              <strong>Preview only.</strong> This section is currently a preview. GigZone does not provide financial advice, does not guarantee returns, and does not currently process investments. All investment features are under development.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects, cities..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 rounded-xl h-11 bg-muted border-0"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-2 min-w-max">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground">
          {activeTab === 'saved' && saved.size === 0
            ? 'No saved projects yet.'
            : activeTab === 'mine'
            ? 'You have no submitted projects yet.'
            : `${filteredProjects.length} project${filteredProjects.length !== 1 ? 's' : ''} found`
          }
        </p>

        {/* Project grid */}
        {filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                saved={saved.has(project.id)}
                onComingSoon={() => setModalOpen(true)}
                onToggleSave={toggleSave}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="font-medium text-foreground">No projects found</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different search or category</p>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="bg-gradient-to-r from-orange-500/10 to-orange-600/10 border border-orange-200 dark:border-orange-900/50 rounded-2xl p-6 text-center space-y-3">
          <h3 className="font-semibold text-foreground text-lg">Have a project that needs funding?</h3>
          <p className="text-sm text-muted-foreground">
            Submit your business or project and connect with local investors. Fully verified and secure — coming soon.
          </p>
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold px-6"
            onClick={() => setModalOpen(true)}
          >
            Submit your project
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

      </div>
    </div>
  );
}
