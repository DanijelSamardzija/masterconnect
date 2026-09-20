'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import {
  Calendar,
  Settings,
  ExternalLink,
  ChevronLeft,
  BarChart3,
  BookOpen,
  Share2,
  ChevronDown,
  Scissors,
  BedDouble,
  Utensils,
  Hammer,
  Package,
  Check,
} from 'lucide-react';
import { ServiceSharePicker } from '@/components/booking/service-share-picker';
import type { ReactNode } from 'react';

export type BusinessBookingTab = 'bookings' | 'schedule' | 'my-analytics' | 'analytics' | 'setup' | 'absences' | 'guide';

const NAV_ITEMS: { tab: BusinessBookingTab; href: string; labelKey: string; icon: ReactNode }[] = [
  { tab: 'bookings',  href: '/booking/business/bookings',  labelKey: 'ownerBookings.navLabel',          icon: <Calendar  className="h-3.5 w-3.5" /> },
  { tab: 'schedule',  href: '/booking/business/schedule',  labelKey: 'schedule.title',                  icon: <Calendar  className="h-3.5 w-3.5" /> },
  { tab: 'analytics', href: '/booking/business/analytics', labelKey: 'bookingAnalytics.navLabel',       icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { tab: 'setup',     href: '/booking/business/setup',     labelKey: 'dashboard.business.activeButton', icon: <Settings  className="h-3.5 w-3.5" /> },
  { tab: 'absences',  href: '/booking/business/absences',  labelKey: 'absences.title',                  icon: <Calendar  className="h-3.5 w-3.5" /> },
  { tab: 'guide',     href: '/booking/business/guide',     labelKey: 'guide.navLabel',                  icon: <BookOpen  className="h-3.5 w-3.5" /> },
];

// ─── Profile type icon (reuses same mapping as Hub page) ─────────────────────

function ProfileTypeIcon({ type, className }: { type: string; className?: string }) {
  const cls = className ?? 'w-3.5 h-3.5';
  switch (type) {
    case 'appointment':   return <Scissors   className={`${cls} text-orange-600 dark:text-orange-400`} />;
    case 'accommodation': return <BedDouble  className={`${cls} text-purple-600 dark:text-purple-400`} />;
    case 'restaurant':    return <Utensils   className={`${cls} text-red-600    dark:text-red-400`}    />;
    case 'tradespeople':  return <Hammer     className={`${cls} text-blue-600   dark:text-blue-400`}   />;
    case 'food_order':    return <Package    className={`${cls} text-green-600  dark:text-green-400`}  />;
    default:              return <Calendar   className={`${cls} text-muted-foreground`}                />;
  }
}

const TYPE_ICON_BG: Record<string, string> = {
  appointment:   'bg-orange-100 dark:bg-orange-950',
  accommodation: 'bg-purple-100 dark:bg-purple-950',
  restaurant:    'bg-red-100    dark:bg-red-950',
  tradespeople:  'bg-blue-100   dark:bg-blue-950',
  food_order:    'bg-green-100  dark:bg-green-950',
};

// ─── Profile Switcher ─────────────────────────────────────────────────────────

function ProfileSwitcher() {
  const { t } = useLanguage();
  const { profiles, activeProfileId, activeProfile, setActiveProfileId } = useBookingProfile();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeProfiles = profiles.filter((p) => p.is_active);
  const canSwitch = activeProfiles.length > 1;

  // Close dropdown when clicking outside
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

  // Nothing to show if context hasn't loaded a profile yet
  if (!activeProfile) return null;

  const iconBg = TYPE_ICON_BG[activeProfile.profile_type] ?? TYPE_ICON_BG.appointment;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => canSwitch && setOpen((v) => !v)}
        className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl border border-border bg-card transition-colors text-left ${
          canSwitch ? 'hover:border-primary/40 hover:bg-accent cursor-pointer' : 'cursor-default'
        }`}
      >
        {/* Icon */}
        <div className={`p-1.5 rounded-lg shrink-0 ${iconBg}`}>
          <ProfileTypeIcon type={activeProfile.profile_type} />
        </div>

        {/* Name + type */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate leading-tight">
            {activeProfile.name}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {t(`booking.hub.type.${activeProfile.profile_type}`)}
          </p>
        </div>

        {/* Chevron only when switchable */}
        {canSwitch && (
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full z-40 bg-card border border-border rounded-xl shadow-lg py-1 overflow-hidden">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('booking.nav.profilePicker')}
          </p>
          {activeProfiles.map((p) => {
            const bg = TYPE_ICON_BG[p.profile_type] ?? TYPE_ICON_BG.appointment;
            const isSelected = p.id === activeProfileId;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setActiveProfileId(p.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-accent transition-colors text-left"
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${bg}`}>
                  <ProfileTypeIcon type={p.profile_type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {t(`booking.hub.type.${p.profile_type}`)}
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

export function BusinessBookingNav({ active }: { active?: BusinessBookingTab }) {
  const router = useRouter();
  const { t } = useLanguage();
  // activeProfileId is the single source of truth — no profile.id from useAuth
  const { activeProfileId } = useBookingProfile();
  const [sharePicker, setSharePicker] = useState(false);

  return (
    <>
      {/* Profile switcher — renders above the tab row */}
      <div className="mb-3">
        <ProfileSwitcher />
      </div>

      <div className="flex items-start gap-2 mb-4">
        <button
          onClick={() => router.push(active ? '/booking/business' : '/booking')}
          className="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground shrink-0 mt-0.5"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-wrap gap-x-1 gap-y-0.5">
          {NAV_ITEMS.map(({ tab, href, labelKey, icon }) => (
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
          {/* Share and public link use activeProfileId — never user.id or profile.id */}
          {activeProfileId && (
            <>
              <button
                onClick={() => setSharePicker(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap py-2 px-2 rounded-lg hover:bg-accent transition-colors"
              >
                <Share2 className="h-3.5 w-3.5" />
                {t('booking.shareService')}
              </button>
              <button
                onClick={() => router.push(`/booking/${activeProfileId}`)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap py-2 px-2 rounded-lg hover:bg-accent transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('dashboard.services.bookingPage')}
              </button>
            </>
          )}
        </div>
      </div>

      {activeProfileId && (
        <ServiceSharePicker
          businessId={activeProfileId}
          open={sharePicker}
          onOpenChange={setSharePicker}
        />
      )}
    </>
  );
}
