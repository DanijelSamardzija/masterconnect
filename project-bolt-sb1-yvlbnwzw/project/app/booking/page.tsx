'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { useBookingProfile, BookingProfileSummary } from '@/lib/contexts/booking-profile-context';
import { ProtectedRoute } from '@/components/protected-route';
import { supabase } from '@/lib/supabase/client';
import {
  Calendar,
  Wrench,
  UtensilsCrossed,
  ShoppingBag,
  BedDouble,
  PartyPopper,
  ChevronRight,
  Search,
  BookMarked,
  Clock,
  Plus,
  MapPin,
  Scissors,
  Utensils,
  Hammer,
  Package,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
} from 'lucide-react';

// ─── Profile type helpers ────────────────────────────────────────────────────

const PROFILE_TYPE_COLORS: Record<string, { icon: string; badge: string }> = {
  appointment:   { icon: 'bg-orange-100 dark:bg-orange-950',  badge: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300' },
  tradespeople:  { icon: 'bg-blue-100   dark:bg-blue-950',     badge: 'bg-blue-100   dark:bg-blue-900   text-blue-700   dark:text-blue-300'   },
  restaurant:    { icon: 'bg-red-100    dark:bg-red-950',      badge: 'bg-red-100    dark:bg-red-900    text-red-700    dark:text-red-300'    },
  food_order:    { icon: 'bg-green-100  dark:bg-green-950',    badge: 'bg-green-100  dark:bg-green-900  text-green-700  dark:text-green-300'  },
  accommodation: { icon: 'bg-purple-100 dark:bg-purple-950',  badge: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' },
  event:         { icon: 'bg-pink-100   dark:bg-pink-950',     badge: 'bg-pink-100   dark:bg-pink-900   text-pink-700   dark:text-pink-300'   },
};

function ProfileTypeIcon({ type, className }: { type: string; className?: string }) {
  const cls = className ?? 'w-5 h-5';
  switch (type) {
    case 'appointment':   return <Scissors    className={`${cls} text-orange-600 dark:text-orange-400`} />;
    case 'tradespeople':  return <Hammer      className={`${cls} text-blue-600   dark:text-blue-400`}   />;
    case 'restaurant':    return <Utensils    className={`${cls} text-red-600    dark:text-red-400`}    />;
    case 'food_order':    return <Package     className={`${cls} text-green-600  dark:text-green-400`}  />;
    case 'accommodation': return <BedDouble   className={`${cls} text-purple-600 dark:text-purple-400`} />;
    case 'event':         return <PartyPopper className={`${cls} text-pink-600   dark:text-pink-400`}   />;
    default:              return <Calendar    className={`${cls} text-muted-foreground`}                />;
  }
}

// ─── Create Profile Modal ────────────────────────────────────────────────────

// Exact display order per product spec
const PROFILE_TYPES = [
  'appointment',
  'tradespeople',
  'restaurant',
  'food_order',
  'accommodation',
  'event',
] as const;

type ProfileType = typeof PROFILE_TYPES[number];

function CreateProfileModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (profileId: string, profileType: ProfileType) => void;
}) {
  const { t } = useLanguage();
  const [profileType, setProfileType] = useState<ProfileType>('appointment');
  const [typeOpen, setTypeOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!typeOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTypeOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [typeOpen]);

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Placeholder name — user will set the real name in the onboarding Profile step
      const placeholderName = t(`booking.hub.type.${profileType}` as Parameters<typeof t>[0]);
      const { data, error: rpcError } = await (supabase as any).rpc('create_booking_profile', {
        p_name: placeholderName,
        p_profile_type: profileType,
        p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Sarajevo',
      }) as { data: { ok: boolean; profile_id?: string; error?: string } | null; error: unknown };

      if (rpcError || !data?.ok) {
        setError(data?.error ?? 'create_failed');
        return;
      }

      onCreated(data.profile_id!, profileType);
    } catch {
      setError('create_failed');
    } finally {
      setSubmitting(false);
    }
  };

  const colors = PROFILE_TYPE_COLORS[profileType] ?? PROFILE_TYPE_COLORS.appointment;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
      onClick={handleBackdrop}
    >
      <div className="w-full sm:max-w-sm bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-xl p-5 pb-8 sm:pb-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{t('booking.hub.createProfileTitle')}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profile type — custom select */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('booking.hub.profileTypeLabel')}
            </label>
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setTypeOpen((o) => !o)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                  typeOpen
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-background text-foreground hover:border-primary/50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`p-1 rounded-lg ${colors.icon}`}>
                    <ProfileTypeIcon type={profileType} className="w-3.5 h-3.5" />
                  </span>
                  {t(`booking.hub.type.${profileType}` as Parameters<typeof t>[0])}
                </span>
                {typeOpen
                  ? <ChevronUp className="w-4 h-4 shrink-0 text-primary" />
                  : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
              </button>

              {typeOpen && (
                <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                  {PROFILE_TYPES.map((pt) => {
                    const ptColors = PROFILE_TYPE_COLORS[pt] ?? PROFILE_TYPE_COLORS.appointment;
                    const isSelected = pt === profileType;
                    return (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => { setProfileType(pt); setTypeOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors ${
                          isSelected
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-foreground hover:bg-accent'
                        }`}
                      >
                        <span className={`p-1 rounded-lg shrink-0 ${ptColors.icon}`}>
                          <ProfileTypeIcon type={pt} className="w-3.5 h-3.5" />
                        </span>
                        {t(`booking.hub.type.${pt}` as Parameters<typeof t>[0])}
                        {isSelected && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? t('booking.hub.creating') : t('booking.hub.createProfileTitle')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Profile Card ────────────────────────────────────────────────────────────

function ProfileCard({
  profile,
  isActive: isSelected,
  onClick,
  t,
}: {
  profile: BookingProfileSummary;
  isActive: boolean;
  onClick: () => void;
  t: (key: string) => string;
}) {
  const colors = PROFILE_TYPE_COLORS[profile.profile_type] ?? PROFILE_TYPE_COLORS.appointment;

  const stats: string[] = [];
  if (profile.location_count > 0) stats.push(`${profile.location_count} ${profile.location_count === 1 ? 'lok.' : 'lok.'}`);
  if (profile.profile_type === 'accommodation') {
    if (profile.unit_count > 0) stats.push(`${profile.unit_count} jed.`);
  } else {
    if (profile.service_count > 0) stats.push(`${profile.service_count} usl.`);
  }

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-colors text-left ${
        !profile.is_active
          ? 'border-border bg-card opacity-60'
          : isSelected
          ? 'border-primary/60 bg-primary/5 hover:bg-primary/10'
          : 'border-border bg-card hover:border-primary/40 hover:bg-accent'
      }`}
    >
      {/* Icon */}
      <div className={`p-2.5 rounded-xl shrink-0 ${colors.icon}`}>
        <ProfileTypeIcon type={profile.profile_type} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground leading-tight truncate">
            {profile.name}
          </span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${colors.badge}`}>
            {t(`booking.hub.type.${profile.profile_type}`)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {stats.length > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              {stats.join(' · ')}
            </span>
          )}
          {!profile.is_active && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {t('booking.hub.profileInactive')}
            </span>
          )}
          {profile.is_active && !profile.onboarding_done && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
              {t('booking.hub.profileNeedsSetup')}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function BookingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const {
    profiles,
    activeProfileId,
    setActiveProfileId,
    loading: profilesLoading,
    reload,
    reloadWithPreferred,
  } = useBookingProfile();

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [staffBusinessName, setStaffBusinessName] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  // Load staff membership (worker/manager in someone else's business)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: membership } = await (supabase as any)
        .from('staff_members')
        .select('business_id, role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .in('role', ['worker', 'manager'])
        .limit(1)
        .maybeSingle();
      if (!membership) return;
      const { data: biz } = await (supabase as any)
        .from('booking_profiles')
        .select('name')
        .eq('id', membership.business_id)
        .single();
      setStaffBusinessName(biz?.name ?? null);
    })();
  }, [user]);

  const handleProfileClick = (profile: BookingProfileSummary) => {
    if (!profile.is_active) {
      // Deactivated → go to setup so the owner can reactivate
      setActiveProfileId(profile.id);
      router.push('/booking/business/setup');
      return;
    }
    if (!profile.onboarding_done) {
      // Incomplete onboarding (browser Back mid-wizard) → resume
      setActiveProfileId(profile.id);
      const params = new URLSearchParams({ profileId: profile.id, profileType: profile.profile_type });
      router.push(`/booking/business/onboarding?${params.toString()}`);
      return;
    }
    setActiveProfileId(profile.id);
    router.push('/booking/business/bookings');
  };

  const handleCreated = async (profileId: string, profileType: string) => {
    setShowCreate(false);
    // reloadWithPreferred writes profileId to sessionStorage BEFORE fetching,
    // so resolveActiveId picks up the new profile instead of the old one.
    // (setActiveProfileId alone would fail: stale closure sees old profiles[])
    await reloadWithPreferred(profileId);
    const params = new URLSearchParams({ profileId, profileType });
    router.push(`/booking/business/onboarding?${params.toString()}`);
  };

  const CATEGORIES = [
    {
      key: 'termini',
      icon: <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />,
      iconBg: 'bg-orange-100 dark:bg-orange-950',
      title: t('booking.hub.cat.termini'),
      desc: t('booking.hub.cat.terminiDesc'),
      href: '/booking/termini',
    },
    {
      key: 'majstori',
      icon: <Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      iconBg: 'bg-blue-100 dark:bg-blue-950',
      title: t('booking.hub.cat.majstori'),
      desc: t('booking.hub.cat.majstoriDesc'),
      soon: true,
    },
    {
      key: 'restorani',
      icon: <UtensilsCrossed className="w-5 h-5 text-red-600 dark:text-red-400" />,
      iconBg: 'bg-red-100 dark:bg-red-950',
      title: t('booking.hub.cat.restorani'),
      desc: t('booking.hub.cat.restoraniDesc'),
      soon: true,
    },
    {
      key: 'hrana',
      icon: <ShoppingBag className="w-5 h-5 text-green-600 dark:text-green-400" />,
      iconBg: 'bg-green-100 dark:bg-green-950',
      title: t('booking.hub.cat.hrana'),
      desc: t('booking.hub.cat.hranaDesc'),
      soon: true,
    },
    {
      key: 'smjestaj',
      icon: <BedDouble className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
      iconBg: 'bg-purple-100 dark:bg-purple-950',
      title: t('booking.hub.cat.smjestaj'),
      desc: t('booking.hub.cat.smjestajDesc'),
      soon: true,
    },
    {
      key: 'dogadjaji',
      icon: <PartyPopper className="w-5 h-5 text-pink-600 dark:text-pink-400" />,
      iconBg: 'bg-pink-100 dark:bg-pink-950',
      title: t('booking.hub.cat.dogadjaji'),
      desc: t('booking.hub.cat.dogadjajiDesc'),
      soon: true,
    },
  ];

  const filtered = CATEGORIES.filter(
    (c) =>
      search.trim() === '' ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.desc.toLowerCase().includes(search.toLowerCase())
  );

  const loading = authLoading || profilesLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

          {/* Page title */}
          <h1 className="text-xl font-bold text-foreground">{t('booking.hub.title')}</h1>

          {/* ── My Booking Profiles section ── */}
          {profiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">{t('booking.hub.myProfiles')}</h2>
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('booking.hub.newProfile').replace('+ ', '')}
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {profiles.map((p) => (
                  <ProfileCard
                    key={p.id}
                    profile={p}
                    isActive={p.id === activeProfileId}
                    onClick={() => handleProfileClick(p)}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── No profiles yet ── */}
          {profiles.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-6 px-4 rounded-2xl border border-dashed border-border text-center">
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t('booking.hub.noProfiles')}</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">{t('booking.hub.noProfilesDesc')}</p>
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('booking.hub.newProfile')}
              </button>
            </div>
          )}

          {/* ── My Reservations ── */}
          <button
            onClick={() => router.push('/booking/my')}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-accent transition-colors text-left"
          >
            <div className="p-2 bg-orange-100 dark:bg-orange-950 rounded-lg shrink-0">
              <BookMarked className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">{t('booking.hub.myRes')}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{t('booking.hub.myResDesc')}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>

          {/* ── Staff card ── */}
          {staffBusinessName && (
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-950 rounded-lg shrink-0">
                <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{staffBusinessName}</p>
                <p className="text-xs text-muted-foreground mb-2">{t('dashboard.staff.memberDesc')}</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push('/dashboard/staff/bookings')}
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    <Calendar className="w-3 h-3" />
                    {t('booking.staffCard.bookings')}
                  </button>
                  <button
                    onClick={() => router.push('/dashboard/staff/schedule')}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Clock className="w-3 h-3" />
                    {t('schedule.staffView.title')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Search ── */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('booking.hub.searchPh')}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* ── Category browse buttons ── */}
          <div className="flex flex-col gap-2">
            {filtered.map((cat) => (
              <button
                key={cat.key}
                onClick={() => {
                  if (cat.soon) return;
                  router.push((cat as any).href);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl bg-card border transition-colors text-left ${
                  cat.soon
                    ? 'border-border opacity-70 cursor-default'
                    : 'border-border hover:border-primary/50 hover:bg-accent cursor-pointer'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${cat.iconBg}`}>
                  {cat.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">{cat.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight truncate">{cat.desc}</p>
                </div>
                {cat.soon ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                    {t('booking.hub.soon')}
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* ── Create profile modal ── */}
      {showCreate && (
        <CreateProfileModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </ProtectedRoute>
  );
}
