'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  UserCog,
  Zap,
  BarChart3,
  FileText,
  Settings,
  ExternalLink,
  ChevronLeft,
  ChevronDown,
  Hammer,
  Check,
} from 'lucide-react';
import type { ReactNode } from 'react';

export type TradeOwnerTab =
  | 'overview'
  | 'jobs'
  | 'clients'
  | 'staff'
  | 'emergency'
  | 'analytics'
  | 'docs'
  | 'settings';

function buildNavItems(profileId: string): { tab: TradeOwnerTab; href: string; labelKey: string; icon: ReactNode }[] {
  const base = `/booking/trade/${profileId}`;
  return [
    { tab: 'overview',   href: base,                   labelKey: 'trade.nav.overview',   icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
    { tab: 'jobs',       href: `${base}/jobs`,          labelKey: 'trade.nav.jobs',       icon: <Briefcase       className="h-3.5 w-3.5" /> },
    { tab: 'clients',    href: `${base}/clients`,       labelKey: 'trade.nav.clients',    icon: <Users           className="h-3.5 w-3.5" /> },
    { tab: 'staff',      href: `${base}/staff`,         labelKey: 'trade.nav.staff',      icon: <UserCog         className="h-3.5 w-3.5" /> },
    { tab: 'emergency',  href: `${base}/emergency`,     labelKey: 'trade.nav.emergency',  icon: <Zap             className="h-3.5 w-3.5" /> },
    { tab: 'analytics',  href: `${base}/analytics`,     labelKey: 'trade.nav.analytics',  icon: <BarChart3       className="h-3.5 w-3.5" /> },
    { tab: 'docs',       href: `${base}/docs`,          labelKey: 'trade.nav.docs',       icon: <FileText        className="h-3.5 w-3.5" /> },
    { tab: 'settings',   href: `${base}/settings`,      labelKey: 'trade.nav.settings',   icon: <Settings        className="h-3.5 w-3.5" /> },
  ];
}

// ─── Profile Switcher ─────────────────────────────────────────────────────────

function ProfileSwitcher({ profileId }: { profileId: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { profiles, activeProfileId, activeProfile, setActiveProfileId } = useBookingProfile();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const tradeProfiles = profiles.filter((p) => p.is_active && p.profile_type === 'tradespeople');
  const canSwitch = tradeProfiles.length > 1;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const displayProfile = activeProfile ?? profiles.find((p) => p.id === profileId);
  if (!displayProfile) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => canSwitch && setOpen((v) => !v)}
        className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl border border-border bg-card transition-colors text-left ${
          canSwitch ? 'hover:border-primary/40 hover:bg-accent cursor-pointer' : 'cursor-default'
        }`}
      >
        <div className="p-1.5 rounded-lg shrink-0 bg-blue-100 dark:bg-blue-950">
          <Hammer className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate leading-tight">
            {displayProfile.name}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {t('booking.hub.type.tradespeople')}
          </p>
        </div>
        {canSwitch && (
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-full z-40 bg-card border border-border rounded-xl shadow-lg py-1 overflow-hidden">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('booking.nav.profilePicker')}
          </p>
          {tradeProfiles.map((p) => {
            const isSelected = p.id === activeProfileId;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setActiveProfileId(p.id);
                  router.push(`/booking/trade/${p.id}`);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-accent transition-colors text-left"
              >
                <div className="p-1.5 rounded-lg shrink-0 bg-blue-100 dark:bg-blue-950">
                  <Hammer className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {t('booking.hub.type.tradespeople')}
                  </p>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Nav ─────────────────────────────────────────────────────────────────

export function TradeOwnerNav({
  profileId,
  active,
}: {
  profileId: string;
  active?: TradeOwnerTab;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const navItems = buildNavItems(profileId);

  return (
    <>
      <div className="mb-3">
        <ProfileSwitcher profileId={profileId} />
      </div>

      <div className="flex items-start gap-2 mb-4">
        <button
          onClick={() => router.push('/booking')}
          className="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground shrink-0 mt-0.5"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-wrap gap-x-1 gap-y-0.5">
          {navItems.map(({ tab, href, labelKey, icon }) => (
            <button
              key={tab}
              onClick={() => router.push(href)}
              className={`flex items-center gap-1.5 text-xs whitespace-nowrap py-2 px-2 rounded-lg transition-colors ${
                active === tab
                  ? 'font-semibold text-primary hover:text-primary/80 hover:bg-accent'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {icon}
              {t(labelKey as Parameters<typeof t>[0])}
            </button>
          ))}
          <button
            onClick={() => router.push(`/booking/majstori/${profileId}`)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap py-2 px-2 rounded-lg hover:bg-accent transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('trade.nav.publicPage')}
          </button>
        </div>
      </div>
    </>
  );
}
