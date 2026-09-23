'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeDashboardLayout } from '@/components/trade/TradeDashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { Briefcase, Users, Wrench, Zap, Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type OverviewStats = {
  requestsOpen: number;
  requestsTotal: number;
  servicesActive: number;
  servicesTotal: number;
  staffCount: number;
  emergencyEnabled: boolean;
  profileName: string;
  profileAvatar: string | null;
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  primary,
  secondary,
  iconBg,
}: {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary?: string;
  iconBg: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
      <div className={`p-2.5 rounded-xl shrink-0 ${iconBg}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground leading-tight">{primary}</p>
        {secondary && <p className="text-xs text-muted-foreground leading-tight">{secondary}</p>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TradeOverviewPage() {
  const { profileId } = useParams() as { profileId: string };
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { setActiveProfileId } = useBookingProfile();

  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profileId) return;
    setActiveProfileId(profileId);
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileId]);

  async function loadStats() {
    setLoading(true);
    try {
      const [profileRes, requestsRes, servicesRes, staffRes] = await Promise.all([
        (supabase as any)
          .from('booking_profiles')
          .select('name, avatar_url, emergency_enabled')
          .eq('id', profileId)
          .single(),
        (supabase as any)
          .from('tradesperson_requests')
          .select('status')
          .eq('business_id', profileId),
        (supabase as any)
          .from('tradesperson_services')
          .select('is_active')
          .eq('business_id', profileId),
        (supabase as any)
          .from('staff_members')
          .select('id')
          .eq('business_id', profileId)
          .eq('is_active', true),
      ]);

      const profile = profileRes.data;
      const requests: { status: string }[] = requestsRes.data ?? [];
      const services: { is_active: boolean }[] = servicesRes.data ?? [];
      const staffCount = staffRes.data?.length ?? 0;

      const openStatuses = ['open', 'quoted', 'accepted', 'scheduled', 'in_progress'];
      setStats({
        requestsOpen: requests.filter((r) => openStatuses.includes(r.status)).length,
        requestsTotal: requests.length,
        servicesActive: services.filter((s) => s.is_active).length,
        servicesTotal: services.length,
        staffCount,
        emergencyEnabled: profile?.emergency_enabled ?? false,
        profileName: profile?.name ?? '',
        profileAvatar: profile?.avatar_url ?? null,
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <TradeDashboardLayout profileId={profileId} active="overview">
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </TradeDashboardLayout>
    );
  }

  return (
    <TradeDashboardLayout profileId={profileId} active="overview">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          {stats?.profileAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={stats.profileAvatar}
              alt={stats.profileName}
              className="w-12 h-12 rounded-2xl object-cover shrink-0 border border-border"
            />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
              <Wrench className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{stats?.profileName}</h1>
            <p className="text-sm text-muted-foreground">{t('trade.dashboard.overview.title')}</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          icon={<Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          label={t('trade.dashboard.overview.requests')}
          primary={String(stats?.requestsOpen ?? 0)}
          secondary={`${stats?.requestsTotal ?? 0} ${t('trade.dashboard.overview.total')}`}
          iconBg="bg-blue-100 dark:bg-blue-950"
        />
        <StatCard
          icon={<Wrench className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
          label={t('trade.dashboard.overview.services')}
          primary={String(stats?.servicesActive ?? 0)}
          secondary={`${stats?.servicesTotal ?? 0} ${t('trade.dashboard.overview.total')}`}
          iconBg="bg-orange-100 dark:bg-orange-950"
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-green-600 dark:text-green-400" />}
          label={t('trade.dashboard.overview.staff')}
          primary={String(stats?.staffCount ?? 0)}
          secondary={t('trade.dashboard.overview.active')}
          iconBg="bg-green-100 dark:bg-green-950"
        />
        <StatCard
          icon={<Zap className="w-5 h-5 text-red-600 dark:text-red-400" />}
          label={t('trade.nav.emergency')}
          primary={stats?.emergencyEnabled ? '✓' : '—'}
          secondary={stats?.emergencyEnabled ? t('trade.onboarding.emergency.enable') : t('trade.onboarding.emergency.disabled')}
          iconBg="bg-red-100 dark:bg-red-950"
        />
      </div>

      {/* Quick nav cards */}
      <div className="flex flex-col gap-2">
        {[
          {
            label: t('trade.nav.requests'),
            desc: `${stats?.requestsOpen ?? 0} ${t('trade.dashboard.overview.pending')}`,
            onClick: () => router.push(`/booking/trade/${profileId}/jobs`),
            icon: <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
          },
          {
            label: t('trade.nav.staff'),
            desc: `${stats?.staffCount ?? 0} ${t('trade.dashboard.overview.active')}`,
            onClick: () => router.push(`/booking/trade/${profileId}/staff`),
            icon: <Users className="w-4 h-4 text-green-600 dark:text-green-400" />,
          },
        ].map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/30 transition-colors text-left"
          >
            <div className="shrink-0">{item.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <span className="text-muted-foreground text-xs">›</span>
          </button>
        ))}
      </div>
    </TradeDashboardLayout>
  );
}
