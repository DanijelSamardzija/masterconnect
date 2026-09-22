'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { useBookingAccess } from '@/lib/hooks/use-booking-access';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { BookingBetaBanner } from '@/components/booking-beta-banner';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, Plus, Pencil, X, CheckCircle2, MapPin, ExternalLink, AlertTriangle, Check, Loader2, Info, Copy, Share2, Trash2, Camera, Bell, Mail } from 'lucide-react';
import { TimePicker24h } from '@/components/ui/time-picker-24h';
import { SharePostModal } from '@/components/share-post-modal';
import { BusinessBookingNav } from '@/components/booking/business-booking-nav';
import { RestaurantTablesTab } from '@/components/setup/RestaurantTablesTab';
import { MenuTab } from '@/components/setup/MenuTab';
import { DeliverySettingsTab } from '@/components/setup/DeliverySettingsTab';
import { TradeServicesTab } from '@/components/setup/TradeServicesTab';
import { AccommodationUnitsTab } from '@/components/setup/AccommodationUnitsTab';
import { AccommodationSettingsTab } from '@/components/setup/AccommodationSettingsTab';
import { Button } from '@/components/ui/button';
import { CityAutocomplete } from '@/components/city-autocomplete';
import { countries } from '@/lib/countries';

type Tab = 'profile' | 'services' | 'hours' | 'locations' | 'rules' | 'staff' | 'notifications'
         | 'tables' | 'menu' | 'delivery' | 'trade_services' | 'acc_units' | 'acc_rules';

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number | null;
  price_type: string;
  capacity: number;
  booking_type: string;
  currency: string;
  is_active: boolean;
  post_id: string | null;
};

type HourPeriod = {
  sort_order: number;
  start_time: string;
  end_time: string;
};

type DayHours = {
  day_of_week: number;
  is_closed: boolean;
  periods: HourPeriod[];
};

type LocationRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  phone: string | null;
  is_primary: boolean;
  is_active: boolean;
};

type BookingRules = {
  confirmation_mode: 'instant' | 'requires_approval';
  min_notice_minutes: number;
  max_advance_days: number;
  cancellation_hours: number;
};

type PostListing = {
  id: string;
  job_title: string | null;
  booking_enabled: boolean;
};

type BusinessClosure = {
  id: string;
  reason: string;
  note: string | null;
  date_from: string; // 'YYYY-MM-DD'
  date_to: string;   // 'YYYY-MM-DD'
  is_past: boolean;
};

type StaffMember = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'worker';
  is_active: boolean;
  primary_location_id: string | null;
  primary_location_name: string | null;
  joined_at: string;
};

type StaffInvitation = {
  id: string;
  email: string;
  role: 'manager' | 'worker';
  location_id: string | null;
  location_name: string | null;
  status: string;
  expires_at: string;
  created_at: string;
};

type StaffResult = {
  id: string;
  name: string;
  avatar_url: string | null;
  city: string | null;
};

type OffReason = 'day_off' | 'vacation' | 'sick_leave';
const OFF_REASON_CYCLE: OffReason[] = ['day_off', 'vacation', 'sick_leave'];

type DaySchedule = {
  is_closed:   boolean;
  off_reason:  OffReason;
  start_time:  string;
  end_time:    string;
  has_break:   boolean;
  break_start: string;
  break_end:   string;
};

type WeekShift = {
  shift_date:            string;
  start_time:            string | null;
  end_time:              string | null;
  is_off:                boolean;
  off_reason:            string | null;
  break_start:           string | null;
  break_end:             string | null;
  is_template_generated: boolean;
};

const BOOKING_TYPES = [
  'appointment_service',
  'tradespeople',
  'restaurant',
  'accommodation',
  'event',
  'order',
] as const;

const PRICE_TYPES = ['fixed', 'from', 'negotiable', 'free'] as const;

const CURRENCIES = [
  'EUR', 'USD', 'RSD',
  'BAM', 'GBP', 'CHF',
  'MKD', 'ALL', 'HUF', 'CZK', 'PLN',
  'CAD', 'AUD', 'NOK', 'SEK', 'DKK',
] as const;

const DEFAULT_HOURS: DayHours[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  is_closed: i === 0 || i === 6,
  periods: [{ sort_order: 0, start_time: '09:00', end_time: '17:00' }],
}));

// Week-by-week schedule helpers (0=Mon, ..., 6=Sun)
const STAFF_SCHEDULE_WEEKS = 13;
const DOW_LABELS = ['setup.hours.day.1','setup.hours.day.2','setup.hours.day.3','setup.hours.day.4','setup.hours.day.5','setup.hours.day.6','setup.hours.day.0'] as const;
const DEFAULT_DAY_SCHEDULE: DaySchedule = { is_closed: true, off_reason: 'day_off', start_time: '09:00', end_time: '17:00', has_break: false, break_start: '12:00', break_end: '13:00' };

function getMondayOf(d: Date): Date {
  const r = new Date(d); r.setHours(0,0,0,0);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  return r;
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function formatWeekRangeShort(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const months = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
  const sm = months[weekStart.getMonth()]; const em = months[weekEnd.getMonth()];
  if (weekStart.getMonth() === weekEnd.getMonth()) return `${weekStart.getDate()}–${weekEnd.getDate()} ${sm}`;
  return `${weekStart.getDate()} ${sm} – ${weekEnd.getDate()} ${em}`;
}
function getScheduleWeeks(): Date[] {
  const monday = getMondayOf(new Date());
  return Array.from({ length: STAFF_SCHEDULE_WEEKS }, (_, i) => addDays(monday, i * 7));
}
function emptyWeekSchedule(): Record<number, DaySchedule> {
  return Object.fromEntries([0,1,2,3,4,5,6].map(d => [d, { ...DEFAULT_DAY_SCHEDULE }]));
}
function shiftToSchedule(s: WeekShift): DaySchedule {
  return {
    is_closed:   s.is_off,
    off_reason:  (s.off_reason as OffReason | undefined) ?? 'day_off',
    start_time:  s.start_time?.slice(0,5) ?? '09:00',
    end_time:    s.end_time?.slice(0,5)   ?? '17:00',
    has_break:   !!(s.break_start && s.break_end),
    break_start: s.break_start?.slice(0,5) ?? '12:00',
    break_end:   s.break_end?.slice(0,5)   ?? '13:00',
  };
}

function shiftsToWeekSchedule(weekStart: Date, shifts: WeekShift[]): Record<number, DaySchedule> {
  const byDate: Record<string, WeekShift> = {};
  for (const s of shifts) byDate[s.shift_date] = s;
  return Object.fromEntries([0,1,2,3,4,5,6].map(dow => {
    const date = isoDateLocal(addDays(weekStart, dow));
    const s = byDate[date];
    return [dow, s ? shiftToSchedule(s) : { ...DEFAULT_DAY_SCHEDULE }];
  }));
}
function isWeekExplicit(weekStart: Date, shifts: WeekShift[]): boolean {
  const dates = new Set([0,1,2,3,4,5,6].map(d => isoDateLocal(addDays(weekStart, d))));
  return shifts.some(s => dates.has(s.shift_date) && !s.is_template_generated);
}

// Convert one company DayHours entry to DaySchedule (single slot or two slots → break)
function companyDayToSchedule(ch: DayHours | undefined): DaySchedule {
  if (!ch || ch.is_closed || ch.periods.length === 0) return { ...DEFAULT_DAY_SCHEDULE };
  const sorted = [...ch.periods].sort((a, b) => a.sort_order - b.sort_order);
  const hasBreak = sorted.length >= 2;
  return {
    is_closed:   false,
    off_reason:  'day_off',
    start_time:  sorted[0].start_time,
    end_time:    sorted[sorted.length - 1].end_time,
    has_break:   hasBreak,
    break_start: hasBreak ? sorted[0].end_time  : '12:00',
    break_end:   hasBreak ? sorted[1].start_time : '13:00',
  };
}

// Build week schedule using company hours as fallback for days without explicit shifts
function shiftsToWeekScheduleOwner(weekStart: Date, shifts: WeekShift[], companyHours: DayHours[]): Record<number, DaySchedule> {
  const byDate: Record<string, WeekShift> = {};
  for (const s of shifts) byDate[s.shift_date] = s;
  return Object.fromEntries([0,1,2,3,4,5,6].map(dow => {
    const date = isoDateLocal(addDays(weekStart, dow));
    const s = byDate[date];
    if (s) return [dow, shiftToSchedule(s)];
    // Fallback: company hours (staff dow 0=Mon → company dow 1; staff dow 6=Sun → company dow 0)
    const companyDow = dow === 6 ? 0 : dow + 1;
    return [dow, companyDayToSchedule(companyHours.find(h => h.day_of_week === companyDow))];
  }));
}

// Parse raw RPC rows to DayHours[]
type OpeningHoursRow = { day_of_week: number; start_time: string; end_time: string; is_closed: boolean; sort_order: number };
function parseOpeningHoursRows(rows: OpeningHoursRow[]): DayHours[] {
  const dayMap = new Map<number, { is_closed: boolean; periods: HourPeriod[] }>();
  for (const row of rows) {
    if (!dayMap.has(row.day_of_week)) dayMap.set(row.day_of_week, { is_closed: row.is_closed, periods: [] });
    const day = dayMap.get(row.day_of_week)!;
    if (!row.is_closed) day.periods.push({ sort_order: row.sort_order, start_time: row.start_time, end_time: row.end_time });
  }
  for (const [, day] of dayMap) day.periods.sort((a, b) => a.sort_order - b.sort_order);
  return Array.from({ length: 7 }, (_, i) => {
    const saved = dayMap.get(i);
    if (saved) return { day_of_week: i, is_closed: saved.is_closed, periods: saved.periods.length > 0 ? saved.periods : [{ sort_order: 0, start_time: '09:00', end_time: '17:00' }] };
    return { ...DEFAULT_HOURS[i] };
  });
}

const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  // Balkani & Ex-YU
  { value: 'Europe/Sarajevo',   label: 'Sarajevo (Europe/Sarajevo)' },
  { value: 'Europe/Belgrade',   label: 'Beograd (Europe/Belgrade)' },
  { value: 'Europe/Zagreb',     label: 'Zagreb (Europe/Zagreb)' },
  { value: 'Europe/Ljubljana',  label: 'Ljubljana (Europe/Ljubljana)' },
  { value: 'Europe/Skopje',     label: 'Skoplje (Europe/Skopje)' },
  { value: 'Europe/Podgorica',  label: 'Podgorica (Europe/Podgorica)' },
  { value: 'Europe/Tirane',     label: 'Tirana (Europe/Tirane)' },
  { value: 'Europe/Sofia',      label: 'Sofija (Europe/Sofia)' },
  { value: 'Europe/Bucharest',  label: 'Bukurešt (Europe/Bucharest)' },
  { value: 'Europe/Athens',     label: 'Atina (Europe/Athens)' },
  // Central Europe
  { value: 'Europe/Vienna',     label: 'Beč (Europe/Vienna)' },
  { value: 'Europe/Berlin',     label: 'Berlin (Europe/Berlin)' },
  { value: 'Europe/Zurich',     label: 'Cirih (Europe/Zurich)' },
  { value: 'Europe/Prague',     label: 'Prag (Europe/Prague)' },
  { value: 'Europe/Warsaw',     label: 'Varšava (Europe/Warsaw)' },
  { value: 'Europe/Budapest',   label: 'Budimpešta (Europe/Budapest)' },
  { value: 'Europe/Bratislava', label: 'Bratislava (Europe/Bratislava)' },
  // Western Europe
  { value: 'Europe/Paris',      label: 'Pariz (Europe/Paris)' },
  { value: 'Europe/Amsterdam',  label: 'Amsterdam (Europe/Amsterdam)' },
  { value: 'Europe/Brussels',   label: 'Brisel (Europe/Brussels)' },
  { value: 'Europe/Rome',       label: 'Rim (Europe/Rome)' },
  { value: 'Europe/Madrid',     label: 'Madrid (Europe/Madrid)' },
  { value: 'Europe/Lisbon',     label: 'Lisabon (Europe/Lisbon)' },
  { value: 'Europe/London',     label: 'London (Europe/London)' },
  { value: 'Europe/Dublin',     label: 'Dublin (Europe/Dublin)' },
  // Nordic
  { value: 'Europe/Stockholm',  label: 'Stokholm (Europe/Stockholm)' },
  { value: 'Europe/Copenhagen', label: 'Kopenhagen (Europe/Copenhagen)' },
  { value: 'Europe/Helsinki',   label: 'Helsinki (Europe/Helsinki)' },
  // Eastern
  { value: 'Europe/Kyiv',       label: 'Kijev (Europe/Kyiv)' },
  { value: 'Europe/Istanbul',   label: 'Istanbul (Europe/Istanbul)' },
  { value: 'Europe/Moscow',     label: 'Moskva (Europe/Moscow)' },
  // Middle East & Gulf
  { value: 'Asia/Riyadh',       label: 'Rijad (Asia/Riyadh)' },
  { value: 'Asia/Dubai',        label: 'Dubai (Asia/Dubai)' },
  // Asia
  { value: 'Asia/Kolkata',      label: 'Mumbai / Delhi (Asia/Kolkata)' },
  { value: 'Asia/Singapore',    label: 'Singapur (Asia/Singapore)' },
  { value: 'Asia/Shanghai',     label: 'Šangaj (Asia/Shanghai)' },
  { value: 'Asia/Tokyo',        label: 'Tokio (Asia/Tokyo)' },
  // Americas
  { value: 'America/New_York',    label: 'New York (America/New_York)' },
  { value: 'America/Chicago',     label: 'Chicago (America/Chicago)' },
  { value: 'America/Denver',      label: 'Denver (America/Denver)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (America/Los_Angeles)' },
  { value: 'America/Toronto',     label: 'Toronto (America/Toronto)' },
  { value: 'America/Sao_Paulo',   label: 'São Paulo (America/Sao_Paulo)' },
  // Australia & Pacific
  { value: 'Australia/Sydney',    label: 'Sidnej (Australia/Sydney)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (Australia/Melbourne)' },
  { value: 'Pacific/Auckland',    label: 'Auckland (Pacific/Auckland)' },
];

const BIZ_CATEGORIES = [
  { key: 'appointment',  emoji: '🗓️', ready: true },
  { key: 'tradespeople', emoji: '🔧', ready: false },
  { key: 'restaurant',   emoji: '🍽️', ready: false },
  { key: 'food_order',   emoji: '🍔', ready: false },
  { key: 'accommodation',emoji: '🏠', ready: false },
  { key: 'event',        emoji: '🎉', ready: false },
] as const;

function matchCountryValue(nominatimCountry: string): string {
  if (!nominatimCountry) return '';
  const lower = nominatimCountry.toLowerCase().trim();
  const match = countries.find(
    (c) =>
      c.value.toLowerCase() === lower ||
      c.sr.toLowerCase() === lower ||
      c.en.toLowerCase() === lower ||
      c.de.toLowerCase() === lower
  );
  return match?.value ?? '';
}

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Sarajevo';
  } catch {
    return 'Europe/Sarajevo';
  }
}

function TimezoneSelect({ value, onChange, className }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const options = TIMEZONE_OPTIONS.some(o => o.value === value)
    ? TIMEZONE_OPTIONS
    : [{ value, label: value }, ...TIMEZONE_OPTIONS];

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={className}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function labelInput(label: string, children: React.ReactNode) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export default function BusinessSetupPage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasAccess, loading: authLoading } = useBookingAccess();
  const {
    activeProfileId,
    loading: profileCtxLoading,
    reload: reloadProfileCtx,
  } = useBookingProfile();

  const VALID_TABS: Tab[] = ['profile', 'services', 'hours', 'locations', 'rules', 'staff', 'notifications',
    'tables', 'menu', 'delivery', 'trade_services', 'acc_units', 'acc_rules'];
  const tabFromUrl = searchParams.get('tab') as Tab | null;
  const initialTab: Tab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'profile';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // ── Profile state ──────────────────────────────────────────────────────────
  const [bizName, setBizName] = useState('');
  const [bizCategory, setBizCategory] = useState<string>('');
  const [timezone, setTimezone] = useState('Europe/Sarajevo');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isBusinessActive, setIsBusinessActive] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);

  // ── Notification prefs state ───────────────────────────────────────────────
  type NotifPrefs = {
    push_enabled: boolean;
    email_enabled: boolean;
    quiet_enabled: boolean;
    quiet_from: string;
    quiet_to: string;
    notify_new_booking: boolean;
    notify_new_booking_email: boolean;
    notify_staff_booking: boolean;
    notify_staff_booking_email: boolean;
    notify_staff_added_booking: boolean;
    notify_staff_added_booking_email: boolean;
    notify_cancellation: boolean;
    notify_cancellation_email: boolean;
    notify_reschedule: boolean;
    notify_reschedule_email: boolean;
  };
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    push_enabled: true,
    email_enabled: true,
    quiet_enabled: false,
    quiet_from: '22:00',
    quiet_to: '07:00',
    notify_new_booking: true,
    notify_new_booking_email: true,
    notify_staff_booking: true,
    notify_staff_booking_email: true,
    notify_staff_added_booking: true,
    notify_staff_added_booking_email: true,
    notify_cancellation: true,
    notify_cancellation_email: true,
    notify_reschedule: true,
    notify_reschedule_email: true,
  });
  const [notifPrefsSaving, setNotifPrefsSaving] = useState(false);

  // ── Services state ─────────────────────────────────────────────────────────
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = useState(initialTab === 'services');
  const [showSvcForm, setShowSvcForm] = useState(false);
  const [editingSvc, setEditingSvc] = useState<ServiceRow | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcDuration, setSvcDuration] = useState('60');
  const [svcPrice, setSvcPrice] = useState('');
  const [svcPriceType, setSvcPriceType] = useState<string>('fixed');
  const [svcCurrency, setSvcCurrency] = useState('BAM');
  const [svcCapacity, setSvcCapacity] = useState('1');
  const [svcBookingType, setSvcBookingType] = useState<string>('appointment_service');
  const [svcSaving, setSvcSaving] = useState(false);

  // ── Booking Rules state ────────────────────────────────────────────────────
  const [rules, setRules] = useState<BookingRules>({
    confirmation_mode: 'instant',
    min_notice_minutes: 60,
    max_advance_days: 60,
    cancellation_hours: 24,
  });
  const [rulesLoading, setRulesLoading] = useState(initialTab === 'rules');
  const [rulesSaving, setRulesSaving] = useState(false);
  const [activeRuleInfo, setActiveRuleInfo] = useState<string | null>(null);

  // ── Post listings state (F11B) ─────────────────────────────────────────────
  const [postListings, setPostListings] = useState<PostListing[]>([]);
  const [postsLoading, setPostsLoading] = useState(initialTab === 'services');
  const [togglingPost, setTogglingPost] = useState<string | null>(null);

  // ── Hours state ────────────────────────────────────────────────────────────
  const [primaryLocId, setPrimaryLocId] = useState<string | null>(null);
  const [hoursLocId, setHoursLocId]     = useState<string | null>(null);
  const [hours, setHours] = useState<DayHours[]>(DEFAULT_HOURS);
  const [deletedPeriods, setDeletedPeriods] = useState<Array<{ day_of_week: number; sort_order: number }>>([]);
  const [hoursLoading, setHoursLoading] = useState(initialTab === 'hours');
  const [hoursSaving, setHoursSaving] = useState(false);

  // ── Closures state ─────────────────────────────────────────────────────────
  const [closures, setClosures] = useState<BusinessClosure[]>([]);
  const [closureFrom, setClosureFrom] = useState('');
  const [closureTo, setClosureTo] = useState('');
  const [closureReason, setClosureReason] = useState('vacation');
  const [closureNote, setClosureNote] = useState('');
  const [closureSaving, setClosureSaving] = useState(false);
  const [closureWarning, setClosureWarning] = useState<number | null>(null);
  const [deletingClosureId, setDeletingClosureId] = useState<string | null>(null);

  // ── Locations state ────────────────────────────────────────────────────────
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locsLoading, setLocsLoading] = useState(initialTab === 'locations');
  const [showLocForm, setShowLocForm] = useState(false);
  const [editingLoc, setEditingLoc] = useState<LocationRow | null>(null);
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locCity, setLocCity] = useState('');
  const [locCountry, setLocCountry] = useState('');
  const [locTimezone, setLocTimezone] = useState('Europe/Sarajevo');
  const [locPhone, setLocPhone] = useState('');
  const [locSaving, setLocSaving] = useState(false);
  const [deactivatingLocId, setDeactivatingLocId] = useState<string | null>(null);

  // ── Staff state ────────────────────────────────────────────────────────────
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffInvitations, setStaffInvitations] = useState<StaffInvitation[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'worker'>('worker');
  const [inviteLocationId, setInviteLocationId] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [staffAddSearch, setStaffAddSearch] = useState('');
  const [staffAddResults, setStaffAddResults] = useState<StaffResult[]>([]);
  const [staffAddSearching, setStaffAddSearching] = useState(false);
  const [selectedStaffToAdd, setSelectedStaffToAdd] = useState<StaffResult | null>(null);
  const [addingStaffRole, setAddingStaffRole] = useState<'manager' | 'worker'>('worker');
  const [addingStaff, setAddingStaff] = useState(false);
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [staffShiftsMap,       setStaffShiftsMap]       = useState<Record<string, WeekShift[]>>({});
  const [staffWeekIndexMap,    setStaffWeekIndexMap]    = useState<Record<string, number>>({});
  const [staffScheduleEditMap, setStaffScheduleEditMap] = useState<Record<string, Record<number, DaySchedule>>>({});
  const [companyHoursCache,    setCompanyHoursCache]    = useState<DayHours[] | null>(null);
  const [staffServicesMap, setStaffServicesMap] = useState<Record<string, string[]>>({});
  const [staffHoursSaving, setStaffHoursSaving] = useState<string | null>(null);
  const [staffCopyingMap, setStaffCopyingMap] = useState<Record<string, boolean>>({});
  const [staffServicesSaving, setStaffServicesSaving] = useState<string | null>(null);
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);
  const [revokingStaffId, setRevokingStaffId] = useState<string | null>(null);
  const [confirmingRevokeId, setConfirmingRevokeId] = useState<string | null>(null);
  const [savingLocStaffId, setSavingLocStaffId] = useState<string | null>(null);
  const [staffPermissionsMap, setStaffPermissionsMap] = useState<Record<string, Record<string, boolean>>>({});
  const [permSaving, setPermSaving] = useState<string | null>(null);
  // Service-location assignment state
  const [serviceLocMap, setServiceLocMap] = useState<Record<string, string[]>>({});
  const [serviceLocSaving, setServiceLocSaving] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ svcId: string; svcName: string; postId: string | null } | null>(null);
  const [deleteModalFutureCount, setDeleteModalFutureCount] = useState<number | null>(null);
  const [deleteModalLoading, setDeleteModalLoading] = useState(false);
  const [deactivateProfileModal, setDeactivateProfileModal] = useState(false);
  const [deactivateProfileLoading, setDeactivateProfileLoading] = useState(false);
  const [deactivateProfileFutureCount, setDeactivateProfileFutureCount] = useState<number | null>(null);
  const [deleteProfileModal, setDeleteProfileModal] = useState(false);
  const [deleteProfileStep, setDeleteProfileStep] = useState<1 | 2>(1);
  const [deleteProfileConfirmName, setDeleteProfileConfirmName] = useState('');
  const [deleteProfileLoading, setDeleteProfileLoading] = useState(false);
  const [deleteProfileHasBookings, setDeleteProfileHasBookings] = useState(false);
  const [deleteProfileBookingCount, setDeleteProfileBookingCount] = useState(0);
  const [reactivateProfileModal, setReactivateProfileModal] = useState(false);
  const [reactivateProfileLoading, setReactivateProfileLoading] = useState(false);
  const [shareSvcId, setShareSvcId] = useState<string | null>(null);

  // ── Guard: redirect to Hub if no active booking profile ───────────────────
  useEffect(() => {
    if (!profileCtxLoading && !activeProfileId) {
      router.replace('/booking');
    }
  }, [profileCtxLoading, activeProfileId, router]);

  // ── Load profile on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !activeProfileId) return;
    (async () => {
      setProfileLoading(true);
      const [bpRes, locRes, notifRes] = await Promise.all([
        // Booking profile data (name, active state, type) — comes from booking_profiles
        (supabase as any).from('booking_profiles').select('name, is_active, profile_type, avatar_url').eq('id', activeProfileId).single() as Promise<{ data: { name: string; is_active: boolean; profile_type: string } | null; error: unknown }>,
        // Primary location timezone for this booking profile
        supabase.from('business_locations').select('timezone').eq('business_id', activeProfileId).eq('is_primary', true).maybeSingle(),
        // Notification prefs — owner-level, stays on profiles table
        (supabase as any).from('profiles').select('notification_prefs').eq('id', user.id).single(),
      ]);
      if (bpRes.data) {
        setBizName(bpRes.data.name ?? '');
        setIsBusinessActive(bpRes.data.is_active ?? false);
        setBizCategory(bpRes.data.profile_type ?? '');
        setAvatarUrl((bpRes.data as any).avatar_url ?? '');
        const prefs = notifRes.data?.notification_prefs ?? {};
        setNotifPrefs({
          push_enabled:         prefs.push_enabled         !== false,
          email_enabled:        prefs.email_enabled        !== false,
          quiet_enabled:        prefs.quiet_enabled        === true,
          quiet_from:           prefs.quiet_from           ?? '22:00',
          quiet_to:             prefs.quiet_to             ?? '07:00',
          notify_new_booking:          prefs.notify_new_booking          !== false,
          notify_new_booking_email:    prefs.notify_new_booking_email    !== false,
          notify_staff_booking:              prefs.notify_staff_booking              !== false,
          notify_staff_booking_email:        prefs.notify_staff_booking_email        !== false,
          notify_staff_added_booking:        prefs.notify_staff_added_booking        !== false,
          notify_staff_added_booking_email:  prefs.notify_staff_added_booking_email  !== false,
          notify_cancellation:               prefs.notify_cancellation               !== false,
          notify_cancellation_email:   prefs.notify_cancellation_email   !== false,
          notify_reschedule:           prefs.notify_reschedule           !== false,
          notify_reschedule_email:     prefs.notify_reschedule_email     !== false,
        });
      }
      // Load saved timezone from primary location; fall back to browser timezone for new users
      setTimezone(locRes.data?.timezone ?? getBrowserTimezone());
      setProfileLoading(false);
    })();
  }, [user, activeProfileId]);

  // ── Load services ──────────────────────────────────────────────────────────
  const loadServices = useCallback(async () => {
    if (!activeProfileId) return;
    setServicesLoading(true);
    const { data } = await supabase
      .from('service_catalog')
      .select('id, name, description, duration_minutes, price, price_type, capacity, booking_type, currency, is_active, post_id')
      .eq('business_id', activeProfileId)
      .order('created_at', { ascending: true });
    setServices((data as unknown as ServiceRow[]) ?? []);
    setServicesLoading(false);
  }, [activeProfileId]);

  // ── Load locations + primary location id ──────────────────────────────────
  const loadLocations = useCallback(async () => {
    if (!activeProfileId) return;
    setLocsLoading(true);
    const { data } = await supabase
      .from('business_locations')
      .select('id, name, address, city, country, timezone, phone, is_primary, is_active')
      .eq('business_id', activeProfileId)
      .order('created_at', { ascending: true });
    const rows = (data as LocationRow[]) ?? [];
    setLocations(rows);
    const primary = rows.find((l) => l.is_primary && l.is_active);
    if (primary) setPrimaryLocId(primary.id);
    setLocsLoading(false);
  }, [activeProfileId]);

  // ── Load business closures ─────────────────────────────────────────────────
  const loadClosures = useCallback(async (locId: string) => {
    const { data } = await (supabase as any).rpc('get_business_closures', {
      p_location_id: locId,
    });
    setClosures((data as BusinessClosure[]) ?? []);
  }, []);

  // ── Load opening hours ─────────────────────────────────────────────────────
  const loadHours = useCallback(async (locId: string) => {
    setHoursLoading(true);
    const { data, error } = await (supabase as any).rpc('get_opening_hours', {
      p_location_id: locId,
    });
    if (!error && Array.isArray(data) && data.length > 0) {
      type DBRow = { day_of_week: number; start_time: string; end_time: string; is_closed: boolean; sort_order: number };
      const rows = data as DBRow[];
      // Group rows by day_of_week
      const dayMap = new Map<number, { is_closed: boolean; periods: HourPeriod[] }>();
      for (const row of rows) {
        if (!dayMap.has(row.day_of_week)) {
          dayMap.set(row.day_of_week, { is_closed: row.is_closed, periods: [] });
        }
        const day = dayMap.get(row.day_of_week)!;
        if (!row.is_closed) {
          day.periods.push({ sort_order: row.sort_order, start_time: row.start_time, end_time: row.end_time });
        }
      }
      // Sort periods within each day
      for (const [, day] of dayMap) {
        day.periods.sort((a, b) => a.sort_order - b.sort_order);
      }
      // Build full 7-day array, using DEFAULT_HOURS for missing days
      const loaded: DayHours[] = Array.from({ length: 7 }, (_, i) => {
        const saved = dayMap.get(i);
        if (saved) {
          return {
            day_of_week: i,
            is_closed: saved.is_closed,
            periods: saved.periods.length > 0
              ? saved.periods
              : [{ sort_order: 0, start_time: '09:00', end_time: '17:00' }],
          };
        }
        return { ...DEFAULT_HOURS[i] };
      });
      setHours(loaded);
      setDeletedPeriods([]);
    }
    setHoursLoading(false);
  }, []);

  const loadRules = useCallback(async () => {
    if (!activeProfileId) return;
    setRulesLoading(true);
    const { data } = await (supabase as any).rpc('get_booking_rules', { p_business_id: activeProfileId });
    if (data) setRules(data as BookingRules);
    setRulesLoading(false);
  }, [activeProfileId]);

  const loadPostListings = useCallback(async () => {
    if (!user) return;
    setPostsLoading(true);
    const { data } = await supabase
      .from('posts')
      .select('id, job_title, booking_enabled')
      .eq('user_id', user.id)  // posts belong to the user, not a specific profile
      .eq('post_type', 'service_listing')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setPostListings((data as PostListing[]) ?? []);
    setPostsLoading(false);
  }, [user]);

  // ── Load staff ─────────────────────────────────────────────────────────────
  const loadStaff = useCallback(async () => {
    if (!activeProfileId) return;
    setStaffLoading(true);
    const [staffRes, invRes] = await Promise.all([
      (supabase as any).rpc('get_my_staff', { p_business_id: activeProfileId }),
      (supabase as any).rpc('get_my_staff_invitations', { p_business_id: activeProfileId }),
    ]);
    setStaffMembers((staffRes.data as StaffMember[]) ?? []);
    setStaffInvitations((invRes.data as StaffInvitation[]) ?? []);
    setStaffLoading(false);
  }, [activeProfileId]);

  const loadServiceLocationAssignments = useCallback(async () => {
    if (!activeProfileId) return;
    const { data } = await (supabase as any).rpc('get_service_location_assignments', { p_business_id: activeProfileId });
    if (data && typeof data === 'object') {
      const map: Record<string, string[]> = {};
      for (const [svcId, locIds] of Object.entries(data as Record<string, unknown[]>)) {
        map[svcId] = (locIds as string[]);
      }
      setServiceLocMap(map);
    }
  }, [activeProfileId]);

  // ── Tab switch loaders ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !activeProfileId) return; // wait for auth + active profile
    if (activeTab === 'services') { loadServices(); loadPostListings(); loadLocations(); loadServiceLocationAssignments(); }
    if (activeTab === 'locations') loadLocations();
    if (activeTab === 'staff') { loadStaff(); loadLocations(); loadServices(); }
    if (activeTab === 'notifications') loadStaff();
    if (activeTab === 'rules') loadRules();
    if (activeTab === 'hours') {
      setHoursLoading(true); // show spinner immediately while finding primary location
      loadLocations().then(async () => {
        const { data: locData } = await supabase
          .from('business_locations')
          .select('id')
          .eq('business_id', activeProfileId)
          .eq('is_primary', true)
          .eq('is_active', true)
          .single();
        if (locData?.id) {
          setPrimaryLocId(locData.id);
          setHoursLocId(locData.id);
          await Promise.all([loadHours(locData.id), loadClosures(locData.id)]);
        } else {
          setHoursLoading(false);
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user, activeProfileId]);

  // ── Profile save ───────────────────────────────────────────────────────────
  async function handleSaveProfile() {
    if (!user || !activeProfileId) return;
    if (!bizName.trim()) {
      toast.error(t('setup.error.nameRequired'));
      return;
    }
    setProfileSaving(true);
    const { data, error } = await (supabase as any).rpc('upsert_my_business_profile', {
      p_name: bizName.trim(),
      p_timezone: timezone.trim() || 'Europe/Sarajevo',
      p_booking_profile_id: activeProfileId,
    });
    setProfileSaving(false);
    const result = data as { ok: boolean; error?: string; location_id?: string } | null;
    if (error || !result?.ok) {
      toast.error(t('setup.error.saveFailed'));
      return;
    }
    setIsBusinessActive(true);
    if (result.location_id) setPrimaryLocId(result.location_id);
    // Profile type is immutable — no category save needed
    toast.success(t('setup.profile.saved'));
    // Reload profile context so the nav chip reflects the new name
    reloadProfileCtx();
  }

  // ── Logo upload / remove ───────────────────────────────────────────────────
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !activeProfileId) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(t('bookingSetup.profile.logoMax')); return; }
    setLogoUploading(true);
    try {
      const { compressImage } = await import('@/lib/utils/compress-image');
      const compressed = await compressImage(file, 400);
      const path = `${user.id}/booking-profiles/${activeProfileId}/${Date.now()}.jpg`;
      if (avatarUrl) {
        const oldPath = avatarUrl.split('/avatars/')[1]?.split('?')[0];
        if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
      }
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      await (supabase as any).from('booking_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', activeProfileId);
      setAvatarUrl(publicUrl);
      toast.success(t('setup.profile.saved'));
    } catch {
      toast.error(t('setup.error.saveFailed'));
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  async function handleLogoRemove() {
    if (!user || !activeProfileId) return;
    if (avatarUrl) {
      const oldPath = avatarUrl.split('/avatars/')[1]?.split('?')[0];
      if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
    }
    await (supabase as any).from('booking_profiles')
      .update({ avatar_url: null })
      .eq('id', activeProfileId);
    setAvatarUrl('');
  }

  // ── Notification prefs save ────────────────────────────────────────────────
  async function handleSaveNotifPrefs() {
    if (!user) return;
    setNotifPrefsSaving(true);
    const { data } = await (supabase as any).rpc('update_notification_prefs', {
      p_prefs: {
        push_enabled:         notifPrefs.push_enabled,
        email_enabled:        notifPrefs.email_enabled,
        quiet_enabled:        notifPrefs.quiet_enabled,
        quiet_from:           notifPrefs.quiet_from,
        quiet_to:             notifPrefs.quiet_to,
        quiet_tz:             timezone || 'Europe/Sarajevo',
        notify_new_booking:          notifPrefs.notify_new_booking,
        notify_new_booking_email:    notifPrefs.notify_new_booking_email,
        notify_staff_booking:              notifPrefs.notify_staff_booking,
        notify_staff_booking_email:        notifPrefs.notify_staff_booking_email,
        notify_staff_added_booking:        notifPrefs.notify_staff_added_booking,
        notify_staff_added_booking_email:  notifPrefs.notify_staff_added_booking_email,
        notify_cancellation:               notifPrefs.notify_cancellation,
        notify_cancellation_email:   notifPrefs.notify_cancellation_email,
        notify_reschedule:           notifPrefs.notify_reschedule,
        notify_reschedule_email:     notifPrefs.notify_reschedule_email,
      },
    });
    setNotifPrefsSaving(false);
    if (data?.ok) toast.success(t('notifPrefs.saved'));
    else toast.error(t('setup.error.saveFailed'));
  }

  // ── Service form helpers ───────────────────────────────────────────────────
  function openAddSvc() {
    setEditingSvc(null);
    setSvcName(''); setSvcDesc(''); setSvcDuration('60');
    setSvcPrice(''); setSvcPriceType('fixed'); setSvcCurrency('BAM'); setSvcCapacity('1');
    setSvcBookingType('appointment_service');
    setShowSvcForm(true);
  }

  function openEditSvc(svc: ServiceRow) {
    setEditingSvc(svc);
    setSvcName(svc.name);
    setSvcDesc(svc.description ?? '');
    setSvcDuration(String(svc.duration_minutes));
    setSvcPrice(svc.price !== null ? String(svc.price) : '');
    setSvcPriceType(svc.price_type);
    setSvcCurrency(svc.currency || 'BAM');
    setSvcCapacity(String(svc.capacity));
    setSvcBookingType(svc.booking_type);
    setShowSvcForm(true);
  }

  function closeSvcForm() {
    setShowSvcForm(false);
    setEditingSvc(null);
  }

  async function handleSaveSvc() {
    if (!user || !activeProfileId) return;
    if (!svcName.trim()) { toast.error(t('setup.error.nameRequired')); return; }
    const dur = parseInt(svcDuration, 10);
    if (!dur || dur <= 0) { toast.error(t('setup.error.saveFailed')); return; }
    const price = svcPrice !== '' ? parseFloat(svcPrice) : null;
    setSvcSaving(true);

    if (editingSvc) {
      const { data } = await (supabase as any).rpc('update_service', {
        p_service_id: editingSvc.id,
        p_name: svcName.trim(),
        p_description: svcDesc.trim() || null,
        p_duration_minutes: dur,
        p_price: price,
        p_price_type: svcPriceType,
        p_capacity: parseInt(svcCapacity, 10) || 1,
        p_is_active: editingSvc.is_active,
        p_currency: svcCurrency,
      });
      const result = data as { ok: boolean } | null;
      if (!result?.ok) { toast.error(t('setup.error.saveFailed')); setSvcSaving(false); return; }
    } else {
      const { data } = await (supabase as any).rpc('create_service', {
        p_business_id: activeProfileId,
        p_name: svcName.trim(),
        p_description: svcDesc.trim() || null,
        p_duration_minutes: dur,
        p_price: price,
        p_price_type: svcPriceType,
        p_capacity: parseInt(svcCapacity, 10) || 1,
        p_booking_type: svcBookingType,
        p_currency: svcCurrency,
      });
      const result = data as { ok: boolean } | null;
      if (!result?.ok) { toast.error(t('setup.error.saveFailed')); setSvcSaving(false); return; }
    }

    setSvcSaving(false);
    toast.success(t('setup.profile.saved'));
    closeSvcForm();
    loadServices();
  }

  async function handleToggleSvc(svc: ServiceRow) {
    if (svc.is_active) {
      const { data } = await (supabase as any).rpc('deactivate_service', { p_service_id: svc.id });
      const result = data as { ok: boolean } | null;
      if (!result?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    } else {
      const { data } = await (supabase as any).rpc('update_service', {
        p_service_id: svc.id,
        p_is_active: true,
      });
      const result = data as { ok: boolean } | null;
      if (!result?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    }
    loadServices();
  }

  async function openDeleteModal(svc: ServiceRow) {
    setDeleteModal({ svcId: svc.id, svcName: svc.name, postId: svc.post_id });
    setDeleteModalFutureCount(null);
    setDeleteModalLoading(true);
    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('service_id', svc.id)
      .in('status', ['pending', 'confirmed'])
      .gt('starts_at', new Date().toISOString());
    setDeleteModalFutureCount(count ?? 0);
    setDeleteModalLoading(false);
  }

  async function confirmDeleteModal() {
    if (!deleteModal) return;
    const { data } = await (supabase as any).rpc('delete_service', { p_service_id: deleteModal.svcId });
    const result = data as { ok: boolean; error?: string } | null;
    if (!result?.ok) {
      if (result?.error === 'has_active_bookings') {
        toast.error(t('setup.services.delete.activeBookings'));
      } else {
        toast.error(t('setup.error.saveFailed'));
      }
      setDeleteModal(null);
      return;
    }
    toast.success(t('setup.services.deleted'));
    setDeleteModal(null);
    setDeleteModalFutureCount(null);
    loadServices();
  }

  async function openDeactivateProfileModal() {
    if (!activeProfileId) return;
    setDeactivateProfileModal(true);
    setDeactivateProfileFutureCount(null);
    setDeactivateProfileLoading(true);
    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', activeProfileId)
      .in('status', ['pending', 'confirmed'])
      .gt('starts_at', new Date().toISOString());
    setDeactivateProfileFutureCount(count ?? 0);
    setDeactivateProfileLoading(false);
  }

  async function handleDeactivateProfile() {
    if (!activeProfileId) return;
    setDeactivateProfileLoading(true);
    const { data } = await (supabase as any).rpc('deactivate_booking_profile', {
      p_booking_profile_id: activeProfileId,
    });
    const result = data as { ok: boolean; error?: string; count?: number } | null;
    setDeactivateProfileLoading(false);
    if (!result?.ok) {
      toast.error(
        result?.error === 'has_active_bookings'
          ? t('booking.deleteProfile.hasFutureBlock').replace('{count}', String(result.count ?? ''))
          : t('setup.error.saveFailed')
      );
      setDeactivateProfileModal(false);
      return;
    }
    toast.success(t('booking.deleteProfile.success'));
    setDeactivateProfileModal(false);
    setIsBusinessActive(false);
    reloadProfileCtx();
    loadServices();
  }

  function openDeleteProfileModal() {
    setDeleteProfileStep(1);
    setDeleteProfileConfirmName('');
    setDeleteProfileHasBookings(false);
    setDeleteProfileBookingCount(0);
    setDeleteProfileModal(true);
  }

  function closeDeleteProfileModal() {
    if (deleteProfileLoading) return;
    setDeleteProfileModal(false);
    setDeleteProfileStep(1);
    setDeleteProfileConfirmName('');
    setDeleteProfileHasBookings(false);
    setDeleteProfileBookingCount(0);
  }

  async function handlePermanentDeleteProfile() {
    if (!activeProfileId) return;
    setDeleteProfileLoading(true);
    const { data } = await (supabase as any).rpc('delete_booking_profile', {
      p_booking_profile_id: activeProfileId,
    });
    const result = data as { ok: boolean; error?: string; count?: number } | null;
    setDeleteProfileLoading(false);
    if (!result?.ok) {
      if (result?.error === 'has_bookings') {
        setDeleteProfileBookingCount(result.count ?? 0);
        setDeleteProfileHasBookings(true);
      } else {
        toast.error(t('setup.error.saveFailed'));
        closeDeleteProfileModal();
      }
      return;
    }
    toast.success(t('booking.permanentDelete.success'));
    closeDeleteProfileModal();
    reloadProfileCtx();
    router.replace('/booking');
  }

  async function handleReactivateProfile() {
    if (!activeProfileId) return;
    setReactivateProfileLoading(true);
    const { data } = await (supabase as any).rpc('reactivate_booking_profile', {
      p_booking_profile_id: activeProfileId,
    });
    const result = data as { ok: boolean } | null;
    setReactivateProfileLoading(false);
    if (!result?.ok) {
      toast.error(t('setup.error.saveFailed'));
      setReactivateProfileModal(false);
      return;
    }
    toast.success(t('booking.reactivateProfile.success'));
    setReactivateProfileModal(false);
    setIsBusinessActive(true);
    reloadProfileCtx();
    loadServices();
  }

  // ── Booking Rules helpers ──────────────────────────────────────────────────
  async function handleSaveRules() {
    if (!user) return;
    setRulesSaving(true);
    const { data, error } = await (supabase as any).rpc('upsert_booking_rules', {
      p_confirmation_mode:  rules.confirmation_mode,
      p_min_notice_minutes: rules.min_notice_minutes,
      p_max_advance_days:   rules.max_advance_days,
      p_cancellation_hours: rules.cancellation_hours,
      p_booking_profile_id: activeProfileId,
    });
    setRulesSaving(false);
    const result = data as { ok: boolean; error?: string } | null;
    if (error || !result?.ok) {
      toast.error(t('setup.error.saveFailed'));
      return;
    }
    toast.success(t('setup.rules.saved'));
  }

  async function handleTogglePost(post: PostListing) {
    if (!post.booking_enabled) {
      // Validate readiness before activating
      setTogglingPost(post.id);
      const { data: checkData } = await (supabase as any).rpc('validate_booking_readiness', {
        p_post_id: post.id,
      });
      const check = checkData as { ready: boolean; missing: string[] } | null;
      setTogglingPost(null);
      if (check && !check.ready) {
        const missingLabels = (check.missing ?? []).map((key: string) => {
          const tKey = `setup.posts.validate.${key}` as Parameters<typeof t>[0];
          return t(tKey);
        });
        toast.error(
          `${t('setup.posts.validate.title')}: ${t('setup.posts.validate.missing')} ${missingLabels.join(', ')}`
        );
        return;
      }
    }
    setTogglingPost(post.id);
    const { data } = await (supabase as any).rpc('set_post_booking_enabled', {
      p_post_id: post.id,
      p_enabled: !post.booking_enabled,
    });
    const result = data as { ok: boolean; error?: string } | null;
    setTogglingPost(null);
    if (!result?.ok) {
      toast.error(t('setup.error.saveFailed'));
      return;
    }
    setPostListings((prev) =>
      prev.map((p) => p.id === post.id ? { ...p, booking_enabled: !post.booking_enabled } : p)
    );
  }

  // ── Hours helpers ──────────────────────────────────────────────────────────
  function toggleDay(day: number) {
    const dayHours = hours.find((h) => h.day_of_week === day);
    const willBeClosed = dayHours ? !dayHours.is_closed : true;
    // Schedule deletion of extra periods when closing a day
    if (willBeClosed && dayHours) {
      const extra = dayHours.periods.filter((p) => p.sort_order > 0);
      if (extra.length > 0) {
        setDeletedPeriods((prev) => [
          ...prev,
          ...extra.map((p) => ({ day_of_week: day, sort_order: p.sort_order })),
        ]);
      }
    }
    setHours((prev) => prev.map((h) =>
      h.day_of_week === day ? { ...h, is_closed: !h.is_closed } : h
    ));
  }

  function updatePeriod(day: number, sort_order: number, field: 'start_time' | 'end_time', value: string) {
    setHours((prev) => prev.map((h) => {
      if (h.day_of_week !== day) return h;
      return {
        ...h,
        periods: h.periods.map((p) =>
          p.sort_order === sort_order ? { ...p, [field]: value } : p
        ),
      };
    }));
  }

  function addBreak(day: number) {
    setHours((prev) => prev.map((h) => {
      if (h.day_of_week !== day) return h;
      const p0 = h.periods.find((p) => p.sort_order === 0);
      if (!p0) return h;
      return {
        ...h,
        periods: [
          { ...p0, end_time: '12:00' },
          { sort_order: 1, start_time: '13:00', end_time: p0.end_time },
        ],
      };
    }));
  }

  function removeBreak(day: number) {
    setDeletedPeriods((prev) => [...prev, { day_of_week: day, sort_order: 1 }]);
    setHours((prev) => prev.map((h) => {
      if (h.day_of_week !== day) return h;
      const p0 = h.periods.find((p) => p.sort_order === 0);
      const p1 = h.periods.find((p) => p.sort_order === 1);
      if (!p0 || !p1) return h;
      return { ...h, periods: [{ ...p0, end_time: p1.end_time }] };
    }));
  }

  function removePeriod(day: number, sort_order: number) {
    setDeletedPeriods((prev) => [...prev, { day_of_week: day, sort_order }]);
    setHours((prev) => prev.map((h) => {
      if (h.day_of_week !== day) return h;
      return { ...h, periods: h.periods.filter((p) => p.sort_order !== sort_order) };
    }));
  }

  async function handleSaveHours() {
    if (!hoursLocId) { toast.error(t('setup.error.saveFailed')); return; }
    setHoursSaving(true);

    // Delete removed extra periods first
    for (const dp of deletedPeriods) {
      const { data } = await (supabase as any).rpc('delete_opening_hour_period', {
        p_location_id: hoursLocId,
        p_day_of_week: dp.day_of_week,
        p_sort_order: dp.sort_order,
      });
      const result = data as { ok: boolean } | null;
      if (!result?.ok) {
        toast.error(t('setup.error.saveFailed'));
        setHoursSaving(false);
        return;
      }
    }

    // Upsert all current periods
    for (const h of hours) {
      if (h.is_closed) {
        const { data } = await (supabase as any).rpc('upsert_opening_hours', {
          p_location_id: hoursLocId,
          p_day_of_week: h.day_of_week,
          p_open_time: '09:00',
          p_close_time: '17:00',
          p_is_closed: true,
          p_sort_order: 0,
        });
        const result = data as { ok: boolean } | null;
        if (!result?.ok) {
          toast.error(t('setup.error.saveFailed'));
          setHoursSaving(false);
          return;
        }
      } else {
        for (const period of h.periods) {
          const { data } = await (supabase as any).rpc('upsert_opening_hours', {
            p_location_id: hoursLocId,
            p_day_of_week: h.day_of_week,
            p_open_time: period.start_time,
            p_close_time: period.end_time,
            p_is_closed: false,
            p_sort_order: period.sort_order,
          });
          const result = data as { ok: boolean } | null;
          if (!result?.ok) {
            toast.error(t('setup.error.saveFailed'));
            setHoursSaving(false);
            return;
          }
        }
      }
    }

    setDeletedPeriods([]);
    setHoursSaving(false);

    // Notify staff about business hours change (fire and forget)
    const hoursForNotif = hours.map(h => ({
      dayOfWeek: h.day_of_week,
      open:  h.is_closed ? null : (h.periods[0]?.start_time ?? null),
      close: h.is_closed ? null : (h.periods[h.periods.length - 1]?.end_time ?? null),
      closed: h.is_closed,
    }));
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token && hoursLocId && activeProfileId) {
        fetch('/api/booking/location-hours-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ locationId: hoursLocId, businessId: activeProfileId, newHours: hoursForNotif }),
        }).catch(() => {});
      }
    });

    toast.success(t('setup.hours.saved'));
  }

  // ── Closure helpers ────────────────────────────────────────────────────────
  function formatClosureDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}.`;
  }

  function closeClosureForm() {
    setClosureWarning(null);
    setClosureFrom('');
    setClosureTo('');
    setClosureReason('vacation');
    setClosureNote('');
  }

  async function handleSaveClosure(force = false) {
    if (!hoursLocId || !closureFrom || !closureTo) return;
    if (closureTo < closureFrom) {
      toast.error(t('setup.closures.from') + ' > ' + t('setup.closures.to'));
      return;
    }
    setClosureSaving(true);
    setClosureWarning(null);
    const { data } = await (supabase as any).rpc('create_business_closure', {
      p_location_id: hoursLocId,
      p_date_from: closureFrom,
      p_date_to: closureTo,
      p_reason: closureReason,
      p_note: closureNote.trim() || null,
      p_force: force,
    });
    setClosureSaving(false);
    const result = data as { ok: boolean; warning?: string; booking_count?: number; closure_id?: string } | null;
    if (!result?.ok) {
      if (result?.warning === 'has_bookings' && result?.booking_count) {
        setClosureWarning(result.booking_count);
        return;
      }
      toast.error(t('setup.error.saveFailed'));
      return;
    }
    toast.success(t('setup.closures.saved'));
    closeClosureForm();
    loadClosures(hoursLocId);
  }

  async function handleDeleteClosure(id: string) {
    setDeletingClosureId(id);
    const { data } = await (supabase as any).rpc('delete_business_closure', {
      p_closure_id: id,
    });
    setDeletingClosureId(null);
    const result = data as { ok: boolean } | null;
    if (!result?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    toast.success(t('setup.closures.deleted'));
    if (hoursLocId) loadClosures(hoursLocId);
  }

  // ── Location form helpers ──────────────────────────────────────────────────
  function openAddLoc() {
    setEditingLoc(null);
    setLocName(''); setLocAddress(''); setLocCity(''); setLocCountry('');
    setLocTimezone(getBrowserTimezone()); setLocPhone('');
    setShowLocForm(true);
  }

  function openEditLoc(loc: LocationRow) {
    setEditingLoc(loc);
    setLocName(loc.name);
    setLocAddress(loc.address ?? '');
    setLocCity(loc.city ?? '');
    setLocCountry(loc.country ?? '');
    setLocTimezone(loc.timezone);
    setLocPhone(loc.phone ?? '');
    setShowLocForm(true);
  }

  function closeLocForm() {
    setShowLocForm(false);
    setEditingLoc(null);
  }

  async function handleSaveLoc() {
    if (!user || !activeProfileId) return;
    if (!locName.trim()) { toast.error(t('setup.error.nameRequired')); return; }
    setLocSaving(true);
    if (editingLoc) {
      const { data } = await (supabase as any).rpc('update_location', {
        p_location_id: editingLoc.id,
        p_name: locName.trim(),
        p_address: locAddress.trim() || null,
        p_city: locCity.trim() || null,
        p_country: locCountry.trim() || null,
        p_timezone: locTimezone.trim() || 'Europe/Sarajevo',
        p_phone: locPhone.trim() || null,
      });
      const result = data as { ok: boolean } | null;
      if (!result?.ok) { toast.error(t('setup.error.saveFailed')); setLocSaving(false); return; }
    } else {
      const { data } = await (supabase as any).rpc('create_location', {
        p_business_id: activeProfileId,
        p_name: locName.trim(),
        p_address: locAddress.trim() || null,
        p_city: locCity.trim() || null,
        p_country: locCountry.trim() || null,
        p_timezone: locTimezone.trim() || 'Europe/Sarajevo',
        p_phone: locPhone.trim() || null,
        p_is_primary: locations.length === 0,
      });
      const result = data as { ok: boolean } | null;
      if (!result?.ok) { toast.error(t('setup.error.saveFailed')); setLocSaving(false); return; }
    }
    setLocSaving(false);
    toast.success(t('setup.profile.saved'));
    closeLocForm();
    loadLocations();
  }

  async function handleSetPrimary(locId: string) {
    const { data } = await (supabase as any).rpc('update_location', {
      p_location_id: locId,
      p_is_primary: true,
    });
    const result = data as { ok: boolean } | null;
    if (!result?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    loadLocations();
  }

  async function handleDeactivateLoc(locId: string) {
    setDeactivatingLocId(locId);
  }

  async function confirmDeactivateLoc(locId: string) {
    setDeactivatingLocId(null);
    const { data } = await (supabase as any).rpc('deactivate_location', {
      p_location_id: locId,
    });
    const result = data as { ok: boolean; error?: string } | null;
    if (!result?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    loadLocations();
  }

  // ── Staff search debounce ──────────────────────────────────────────────────
  useEffect(() => {
    if (staffAddSearch.length < 2) { setStaffAddResults([]); return; }
    const timer = setTimeout(async () => {
      setStaffAddSearching(true);
      const { data } = await (supabase as any).rpc('search_profiles', {
        p_search: staffAddSearch,
        p_limit: 6,
      });
      setStaffAddSearching(false);
      if (Array.isArray(data)) {
        const existingIds = new Set(staffMembers.filter((sm) => sm.is_active).map((sm) => sm.user_id));
        setStaffAddResults((data as StaffResult[]).filter((u) => u.id !== user?.id && !existingIds.has(u.id)));
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [staffAddSearch, user?.id, staffMembers]);

  // ── Staff handlers ─────────────────────────────────────────────────────────
  async function handleAddStaffDirect() {
    if (!selectedStaffToAdd || !primaryLocId) return;
    setAddingStaff(true);
    const { data, error } = await (supabase as any).rpc('add_staff_direct', {
      p_user_id: selectedStaffToAdd.id,
      p_role: addingStaffRole,
      p_location_id: primaryLocId,
    });
    setAddingStaff(false);
    if (error) { console.error('add_staff_direct error:', error); toast.error(t('setup.error.saveFailed')); return; }
    if (!(data as any)?.ok) { console.error('add_staff_direct returned:', data); toast.error(t('setup.error.saveFailed')); return; }
    toast.success(t('setup.staff.added'));
    // Fire-and-forget email notification
    fetch('/api/staff/added-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staffUserId: selectedStaffToAdd.id,
        ownerName: (data as any)?.owner_name ?? '',
        role: addingStaffRole,
      }),
    }).catch(() => {});
    setSelectedStaffToAdd(null);
    setStaffAddSearch('');
    setAddingStaffRole('worker');
    loadStaff();
  }

  async function handleSendInvite() {
    if (!user || !activeProfileId || !inviteEmail.trim()) return;
    setInviteSending(true);
    const { data } = await (supabase as any).rpc('send_staff_invitation', {
      p_business_id: activeProfileId,
      p_email: inviteEmail.trim(),
      p_role: inviteRole,
      p_location_id: inviteLocationId || null,
    });
    setInviteSending(false);
    const result = data as { ok: boolean; error?: string } | null;
    if (!result?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    toast.success(t('setup.staff.invite.sent'));
    setInviteEmail(''); setInviteRole('worker'); setInviteLocationId('');
    setShowInviteForm(false);
    loadStaff();
  }

  async function handleCancelInvite(invId: string) {
    setCancellingInviteId(invId);
    const { data } = await (supabase as any).rpc('cancel_staff_invitation', { p_invitation_id: invId });
    setCancellingInviteId(null);
    const result = data as { ok: boolean } | null;
    if (!result?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    toast.success(t('setup.staff.inviteCancelled'));
    loadStaff();
  }

  async function handleRevokeStaff(staffId: string) {
    setConfirmingRevokeId(null);
    setRevokingStaffId(staffId);
    const { data } = await (supabase as any).rpc('revoke_staff_member', { p_staff_member_id: staffId });
    setRevokingStaffId(null);
    const result = data as { ok: boolean } | null;
    if (!result?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    toast.success(t('setup.staff.revoked'));
    loadStaff();
  }

  async function handleSetStaffLocation(staffMemberId: string, locationId: string | null) {
    setSavingLocStaffId(staffMemberId);
    const { data } = await (supabase as any).rpc('set_staff_primary_location', {
      p_staff_member_id: staffMemberId,
      p_location_id: locationId || null,
    });
    setSavingLocStaffId(null);
    if (!(data as { ok: boolean } | null)?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    setStaffMembers(prev => prev.map(sm =>
      sm.id === staffMemberId
        ? { ...sm, primary_location_id: locationId, primary_location_name: locations.find(l => l.id === locationId)?.name ?? null }
        : sm
    ));
    // Invalidate cached schedule so next expand loads data for the new location
    setStaffShiftsMap(prev => { const { [staffMemberId]: _, ...rest } = prev; return rest; });
    setStaffScheduleEditMap(prev => { const { [staffMemberId]: _, ...rest } = prev; return rest; });
    // If details are currently expanded, reload immediately
    if (expandedStaffId === staffMemberId) {
      await loadStaffDetails(staffMemberId, true);
    }
  }

  async function loadStaffDetails(staffId: string, force = false) {
    if (!force && staffShiftsMap[staffId] !== undefined) return;
    const isOwnerMember = staffMembers.find(sm => sm.id === staffId)?.role === 'owner';
    const weeks = getScheduleWeeks();

    // For the owner: fetch company hours as fallback if not yet cached
    let locHours: DayHours[] | null = companyHoursCache;
    if (isOwnerMember && !locHours && primaryLocId) {
      const { data: hoursData } = await (supabase as any).rpc('get_opening_hours', { p_location_id: primaryLocId });
      if (Array.isArray(hoursData) && hoursData.length > 0) {
        locHours = parseOpeningHoursRows(hoursData as OpeningHoursRow[]);
        setCompanyHoursCache(locHours);
      }
    }

    const [shiftsRes, svcRes, permRes] = await Promise.all([
      (supabase as any).rpc('owner_get_staff_shifts_range', {
        p_staff_member_id: staffId,
        p_from_date: isoDateLocal(weeks[0]),
        p_to_date:   isoDateLocal(addDays(weeks[STAFF_SCHEDULE_WEEKS - 1], 6)),
      }),
      (supabase as any).rpc('get_staff_services', { p_staff_member_id: staffId }),
      supabase.from('staff_members').select('permissions').eq('id', staffId).single(),
    ]);
    const shifts: WeekShift[] = Array.isArray(shiftsRes.data) ? shiftsRes.data : [];
    setStaffShiftsMap((prev) => ({ ...prev, [staffId]: shifts }));
    const weekIdx = staffWeekIndexMap[staffId] ?? 0;
    const initSchedule = isOwnerMember && locHours
      ? shiftsToWeekScheduleOwner(weeks[weekIdx], shifts, locHours)
      : shiftsToWeekSchedule(weeks[weekIdx], shifts);
    setStaffScheduleEditMap((prev) => ({ ...prev, [staffId]: initSchedule }));
    setStaffServicesMap((prev) => ({ ...prev, [staffId]: (svcRes.data as string[]) ?? [] }));
    const rawPerms = (permRes.data as any)?.permissions ?? {};
    setStaffPermissionsMap((prev) => ({
      ...prev,
      [staffId]: {
        can_set_hours:            !!rawPerms.can_set_hours,
        can_create_bookings:      !!rawPerms.can_create_bookings,
        can_cancel_bookings:      !!rawPerms.can_cancel_bookings,
        can_block_time:           !!rawPerms.can_block_time,
        can_reschedule_bookings:  !!rawPerms.can_reschedule_bookings,
        can_complete_bookings:    !!rawPerms.can_complete_bookings,
      },
    }));
  }

  async function handleSaveStaffPermissions(staffId: string) {
    const perms = staffPermissionsMap[staffId];
    if (!perms) return;
    setPermSaving(staffId);
    const { data } = await (supabase as any).rpc('update_staff_permissions', {
      p_staff_member_id: staffId,
      p_permissions: perms,
    });
    setPermSaving(null);
    if (!(data as any)?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    toast.success(t('setup.staff.permissions.saved'));
  }

  async function handleSaveStaffHours(staffId: string): Promise<boolean> {
    const staffMember = staffMembers.find(sm => sm.id === staffId);
    const locId = staffMember?.primary_location_id ?? primaryLocId;
    if (!locId) return false;
    const schedule = staffScheduleEditMap[staffId];
    if (!schedule) return false;
    setStaffHoursSaving(staffId);
    const weeks = getScheduleWeeks();
    const weekIdx = staffWeekIndexMap[staffId] ?? 0;
    const weekStart = weeks[weekIdx];
    const days = [0,1,2,3,4,5,6].map(dow => {
      const day = schedule[dow];
      return {
        day_of_week: dow,
        start_time:  day.is_closed ? null : day.start_time,
        end_time:    day.is_closed ? null : day.end_time,
        is_off:      day.is_closed,
        off_reason:  day.is_closed ? day.off_reason : null,
        break_start: day.is_closed || !day.has_break ? null : day.break_start,
        break_end:   day.is_closed || !day.has_break ? null : day.break_end,
      };
    });
    const { data } = await (supabase as any).rpc('owner_save_week_schedule', {
      p_staff_member_id: staffId,
      p_location_id:     locId,
      p_week_start:      isoDateLocal(weekStart),
      p_days:            days,
    });
    setStaffHoursSaving(null);
    if ((data as any)?.ok) {
      toast.success(t('setup.staff.hours.saved'));
      // Reload shifts so inherited/explicit badges update
      const reloadWeeks = getScheduleWeeks();
      const { data: fresh } = await (supabase as any).rpc('owner_get_staff_shifts_range', {
        p_staff_member_id: staffId,
        p_from_date: isoDateLocal(reloadWeeks[0]),
        p_to_date:   isoDateLocal(addDays(reloadWeeks[STAFF_SCHEDULE_WEEKS - 1], 6)),
      });
      const freshShifts: WeekShift[] = Array.isArray(fresh) ? fresh : [];
      setStaffShiftsMap(prev => ({ ...prev, [staffId]: freshShifts }));
      const wIdx = staffWeekIndexMap[staffId] ?? 0;
      const isOwnerMember = staffMembers.find(sm => sm.id === staffId)?.role === 'owner';
      const refreshedSchedule = isOwnerMember && companyHoursCache
        ? shiftsToWeekScheduleOwner(reloadWeeks[wIdx], freshShifts, companyHoursCache)
        : shiftsToWeekSchedule(reloadWeeks[wIdx], freshShifts);
      setStaffScheduleEditMap(prev => ({ ...prev, [staffId]: refreshedSchedule }));
      return true;
    } else {
      toast.error(t('setup.error.saveFailed'));
      return false;
    }
  }

  async function handleCopyStaffWeek(staffId: string) {
    // Save current week first so the DB reflects the UI before copying
    const saved = await handleSaveStaffHours(staffId);
    if (!saved) return;

    const weeks = getScheduleWeeks();
    const weekIdx = staffWeekIndexMap[staffId] ?? 0;
    if (weekIdx >= weeks.length - 1) return;
    const fromWeek = weeks[weekIdx];
    const toWeek = weeks[weekIdx + 1];
    setStaffCopyingMap(m => ({ ...m, [staffId]: true }));
    const { data } = await (supabase as any).rpc('owner_copy_staff_week_shifts', {
      p_staff_member_id: staffId,
      p_from_week_start: isoDateLocal(fromWeek),
      p_to_week_start:   isoDateLocal(toWeek),
    });
    setStaffCopyingMap(m => ({ ...m, [staffId]: false }));
    if ((data as any)?.ok) {
      toast.success(t('schedule.copyWeekDone'));
      // Reload shifts so the copied week shows correct data
      const reloadWeeks = getScheduleWeeks();
      const { data: fresh } = await (supabase as any).rpc('owner_get_staff_shifts_range', {
        p_staff_member_id: staffId,
        p_from_date: isoDateLocal(reloadWeeks[0]),
        p_to_date:   isoDateLocal(addDays(reloadWeeks[reloadWeeks.length - 1], 6)),
      });
      const freshShifts: WeekShift[] = Array.isArray(fresh) ? fresh : [];
      setStaffShiftsMap(prev => ({ ...prev, [staffId]: freshShifts }));
      const isOwnerMember = staffMembers.find(sm => sm.id === staffId)?.role === 'owner';
      const nextSchedule = isOwnerMember && companyHoursCache
        ? shiftsToWeekScheduleOwner(toWeek, freshShifts, companyHoursCache)
        : shiftsToWeekSchedule(toWeek, freshShifts);
      setStaffScheduleEditMap(prev => ({ ...prev, [staffId]: nextSchedule }));
      setStaffWeekIndexMap(prev => ({ ...prev, [staffId]: weekIdx + 1 }));
    } else {
      toast.error(t('setup.error.saveFailed'));
    }
  }

  async function handleSaveStaffServices(staffId: string) {
    setStaffServicesSaving(staffId);
    const { data } = await (supabase as any).rpc('set_staff_services', {
      p_staff_member_id: staffId,
      p_service_ids: staffServicesMap[staffId] ?? [],
    });
    setStaffServicesSaving(null);
    const result = data as { ok: boolean } | null;
    if (!result?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    toast.success(t('setup.staff.services.saved'));
  }

  function toggleStaffService(staffId: string, svcId: string) {
    setStaffServicesMap((prev) => {
      const current = prev[staffId] ?? [];
      return { ...prev, [staffId]: current.includes(svcId) ? current.filter((s) => s !== svcId) : [...current, svcId] };
    });
  }

  function updateStaffDay(staffId: string, dow: number, patch: Partial<DaySchedule>) {
    setStaffScheduleEditMap(prev => ({
      ...prev,
      [staffId]: { ...(prev[staffId] ?? emptyWeekSchedule()), [dow]: { ...(prev[staffId]?.[dow] ?? DEFAULT_DAY_SCHEDULE), ...patch } },
    }));
  }

  function toggleStaffDayOff(staffId: string, dow: number) {
    const current = staffScheduleEditMap[staffId]?.[dow] ?? DEFAULT_DAY_SCHEDULE;
    updateStaffDay(staffId, dow, { is_closed: !current.is_closed, off_reason: 'day_off' });
  }

  function cycleStaffOffReason(staffId: string, dow: number) {
    const current = staffScheduleEditMap[staffId]?.[dow] ?? DEFAULT_DAY_SCHEDULE;
    const idx = OFF_REASON_CYCLE.indexOf(current.off_reason);
    const next = OFF_REASON_CYCLE[(idx + 1) % OFF_REASON_CYCLE.length];
    updateStaffDay(staffId, dow, { off_reason: next });
  }

  function toggleStaffBreak(staffId: string, dow: number) {
    const current = staffScheduleEditMap[staffId]?.[dow] ?? DEFAULT_DAY_SCHEDULE;
    updateStaffDay(staffId, dow, current.has_break
      ? { has_break: false }
      : { has_break: true, break_start: '12:00', break_end: '13:00' }
    );
  }

  function changeStaffWeek(staffId: string, delta: number) {
    const current = staffWeekIndexMap[staffId] ?? 0;
    const next = Math.max(0, Math.min(STAFF_SCHEDULE_WEEKS - 1, current + delta));
    if (next === current) return;
    setStaffWeekIndexMap(prev => ({ ...prev, [staffId]: next }));
    const weeks = getScheduleWeeks();
    const shifts = staffShiftsMap[staffId] ?? [];
    const isOwnerMember = staffMembers.find(sm => sm.id === staffId)?.role === 'owner';
    const newSchedule = isOwnerMember && companyHoursCache
      ? shiftsToWeekScheduleOwner(weeks[next], shifts, companyHoursCache)
      : shiftsToWeekSchedule(weeks[next], shifts);
    setStaffScheduleEditMap(prev => ({ ...prev, [staffId]: newSchedule }));
  }

  async function handleSaveServiceLocations(svcId: string) {
    setServiceLocSaving(svcId);
    const { data } = await (supabase as any).rpc('set_service_locations', {
      p_service_id: svcId,
      p_location_ids: serviceLocMap[svcId] ?? [],
    });
    setServiceLocSaving(null);
    const result = data as { ok: boolean } | null;
    if (!result?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    toast.success(t('setup.services.locations.saved'));
  }

  function toggleServiceLocation(svcId: string, locId: string) {
    setServiceLocMap((prev) => {
      const current = prev[svcId] ?? [];
      return { ...prev, [svcId]: current.includes(locId) ? current.filter((l) => l !== locId) : [...current, locId] };
    });
  }

  // ── Tabs — varies by bizCategory ───────────────────────────────────────────
  const TABS: { key: Tab; label: string }[] = (() => {
    const base: { key: Tab; label: string }[] = [
      { key: 'profile', label: t('setup.tab.profile') },
    ];
    const notifTab = { key: 'notifications' as Tab, label: t('setup.tab.notifications') };

    if (bizCategory === 'restaurant') {
      base.push(
        { key: 'tables',    label: t('restaurant.setup.tab') },
        { key: 'locations', label: t('setup.tab.locations') },
        { key: 'hours',     label: t('setup.tab.hours') },
        { key: 'staff',     label: t('setup.tab.staff') },
        notifTab,
        { key: 'rules',     label: t('setup.tab.rules') },
      );
    } else if (bizCategory === 'food_order') {
      base.push(
        { key: 'menu',      label: t('menu.setup.tab') },
        { key: 'delivery',  label: t('delivery.setup.tab') },
        { key: 'hours',     label: t('setup.tab.hours') },
        { key: 'staff',     label: t('setup.tab.staff') },
        notifTab,
      );
    } else if (bizCategory === 'tradespeople') {
      base.push(
        { key: 'trade_services', label: t('trade.setup.tab') },
        { key: 'locations',      label: t('setup.tab.locations') },
        { key: 'hours',          label: t('setup.tab.hours') },
        { key: 'staff',          label: t('setup.tab.staff') },
        notifTab,
        { key: 'rules',          label: t('setup.tab.rules') },
      );
    } else if (bizCategory === 'accommodation') {
      base.push(
        { key: 'acc_units', label: t('acc.setup.tab') },
        { key: 'acc_rules', label: t('acc.settings.tab') },
        { key: 'staff',     label: t('setup.tab.staff') },
        notifTab,
      );
    } else {
      // Default: appointment (frizeri, doktori...) or no category
      base.push(
        { key: 'services',  label: t('setup.tab.services') },
        { key: 'locations', label: t('setup.tab.locations') },
        { key: 'hours',     label: t('setup.tab.hours') },
        { key: 'staff',     label: t('setup.tab.staff') },
        notifTab,
        { key: 'rules',     label: t('setup.tab.rules') },
      );
    }
    return base;
  })();

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!authLoading && !hasAccess) {
    return (
      <ProtectedRoute>
        <BookingBetaBanner />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-6">

          <BusinessBookingNav active="setup" />

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-xl font-semibold flex-1">{t('setup.title')}</h1>
            {isBusinessActive && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t('setup.profile.active')}
              </span>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-border mb-6 gap-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => {
                  setActiveTab(key);
                  router.replace(`/booking/business/setup?tab=${key}`, { scroll: false });
                }}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab: Profile ─────────────────────────────────────────────── */}
          {activeTab === 'profile' && (
            <div className="flex flex-col gap-5">
              {/* Inactive profile banner */}
              {!profileLoading && !isBusinessActive && (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-2 flex-1">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{t('booking.reactivateProfile.inactiveBanner')}</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">{t('booking.reactivateProfile.inactiveBannerDesc')}</p>
                    <button
                      onClick={() => setReactivateProfileModal(true)}
                      className="self-start mt-1 px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors"
                    >
                      {t('booking.reactivateProfile.title')}
                    </button>
                  </div>
                </div>
              )}

              {profileLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Business type — read-only full card */}
                  {bizCategory && (() => {
                    const cat = BIZ_CATEGORIES.find(c => c.key === bizCategory);
                    if (!cat) return null;
                    return (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground">{t('setup.profile.bizType')}</label>
                        <div className="w-full text-left rounded-xl border border-primary bg-primary/5 ring-1 ring-primary p-3.5 cursor-default">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <span className="text-2xl leading-none mt-0.5">{cat.emoji}</span>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-semibold text-primary">
                                  {t(`setup.bizCategory.${cat.key}.name` as Parameters<typeof t>[0])}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {t(`setup.bizCategory.${cat.key}.desc` as Parameters<typeof t>[0])}
                                </span>
                                <span className="text-xs text-muted-foreground/70 mt-1">
                                  {t(`setup.bizCategory.${cat.key}.examples` as Parameters<typeof t>[0])}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Logo upload */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">{t('bookingSetup.profile.logo')}</label>
                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20 rounded-2xl border-2 border-dashed border-border bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
                        {avatarUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={avatarUrl} alt="logo" className="w-full h-full object-cover" />
                          : <Camera className="w-7 h-7 text-muted-foreground/50" />
                        }
                        {logoUploading && (
                          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={logoUploading}
                          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                        >
                          {logoUploading
                            ? t('bookingSetup.profile.logoUploading')
                            : avatarUrl
                              ? t('bookingSetup.profile.logoChange')
                              : t('bookingSetup.profile.logoUpload')
                          }
                        </button>
                        <p className="text-xs text-muted-foreground">{t('bookingSetup.profile.logoMax')}</p>
                        {avatarUrl && !logoUploading && (
                          <button
                            type="button"
                            onClick={handleLogoRemove}
                            className="text-xs text-destructive hover:text-destructive/80 transition-colors text-left"
                          >
                            {t('setup.profile.logoRemove')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {labelInput(t('setup.profile.name'),
                    <>
                      <input
                        type="text"
                        value={bizName}
                        onChange={(e) => setBizName(e.target.value)}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder={t('setup.profile.namePlaceholder')}
                      />
                      <p className="text-xs text-muted-foreground mt-1">{t('setup.profile.nameHelp')}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{t('setup.profile.nameNote')}</p>
                    </>
                  )}

                  <Button
                    onClick={handleSaveProfile}
                    disabled={profileSaving}
                    className="self-start"
                  >
                    {profileSaving ? t('setup.profile.saving') : t('setup.profile.save')}
                  </Button>

                  {/* Danger Zone — only shown when booking profile is active */}
                  {isBusinessActive && (
                    <div className="mt-6 pt-5 border-t border-destructive/20">
                      <h3 className="text-sm font-semibold text-destructive mb-1">{t('booking.deleteProfile.dangerZone')}</h3>
                      <p className="text-xs text-muted-foreground mb-3">{t('booking.deleteProfile.dangerZoneDesc')}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={openDeactivateProfileModal}
                          className="px-4 py-2 rounded-xl border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
                        >
                          {t('booking.deleteProfile.title')}
                        </button>
                        <button
                          onClick={openDeleteProfileModal}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive/10 border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t('booking.permanentDelete.button')}
                        </button>
                      </div>
                    </div>
                  )}

                </>

              )}
            </div>
          )}

          {/* ── Tab: Services ────────────────────────────────────────────── */}
          {activeTab === 'services' && (
            <div className="flex flex-col gap-4">
              {!isBusinessActive && (
                <p className="text-sm text-muted-foreground border border-border rounded-lg p-4 bg-accent/40">
                  {t('setup.profile.inactive')}
                </p>
              )}

              <div>
                <h2 className="font-semibold">{t('setup.services.tabIntro')}</h2>
                <p className="text-xs text-muted-foreground mt-1">{t('setup.services.tabIntroDesc')}</p>
              </div>

              {/* How-it-works guide — links to dedicated guide page */}
              <button
                type="button"
                onClick={() => router.push('/booking/business/guide?type=termini')}
                className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 flex items-center justify-between gap-2 text-left hover:border-blue-400 dark:hover:border-blue-600 transition-colors w-full"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                    {t('setup.services.guide.title')}
                  </span>
                </div>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium shrink-0">
                  {t('setup.services.guide.readMore')}
                </span>
              </button>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{t('setup.services.heading')}</span>
                {isBusinessActive && (
                  <Button size="sm" variant="outline" onClick={openAddSvc}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    {t('setup.services.add')}
                  </Button>
                )}
              </div>

              {/* Add / Edit form */}
              {showSvcForm && (
                <div className="border border-border rounded-xl p-4 flex flex-col gap-3 bg-card">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                      {editingSvc ? t('setup.services.edit') : t('setup.services.add')}
                    </span>
                    <button onClick={closeSvcForm} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Vrsta rezervacije — chips, samo pri dodavanju */}
                  {!editingSvc && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{t('setup.btype.label')}</label>
                      <div className="flex flex-wrap gap-1.5">
                        {BOOKING_TYPES.map((bt) => (
                          <button
                            key={bt}
                            type="button"
                            onClick={() => setSvcBookingType(bt)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              svcBookingType === bt
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground'
                            }`}
                          >
                            {t(`setup.btype.${bt}`)}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">{t('setup.btype.help')}</p>
                    </div>
                  )}

                  {labelInput(t('setup.services.name'),
                    <>
                      <input
                        type="text"
                        value={svcName}
                        onChange={(e) => setSvcName(e.target.value)}
                        placeholder={t((`setup.services.namePlaceholder.${svcBookingType}`) as Parameters<typeof t>[0])}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t((`setup.services.nameHelp.${svcBookingType}`) as Parameters<typeof t>[0])}
                      </p>
                    </>
                  )}

                  {labelInput(t('setup.services.desc'),
                    <>
                      <textarea
                        value={svcDesc}
                        onChange={(e) => setSvcDesc(e.target.value)}
                        rows={2}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      />
                      <p className="text-xs text-muted-foreground mt-0.5">{t('setup.services.descHelp')}</p>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {labelInput(t('setup.services.duration'),
                      <>
                        <input
                          type="number"
                          min="1"
                          value={svcDuration}
                          onChange={(e) => setSvcDuration(e.target.value)}
                          className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground mt-0.5">{t('setup.services.durationHelp')}</p>
                      </>
                    )}
                    {labelInput(t('setup.services.capacity'),
                      <>
                        <input
                          type="number"
                          min="1"
                          value={svcCapacity}
                          onChange={(e) => setSvcCapacity(e.target.value)}
                          className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground mt-0.5">{t('setup.services.capacityHelp')}</p>
                      </>
                    )}
                  </div>

                  {labelInput(t('setup.services.priceType'),
                    <>
                      <select
                        value={svcPriceType}
                        onChange={(e) => setSvcPriceType(e.target.value)}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {PRICE_TYPES.map((pt) => (
                          <option key={pt} value={pt}>{t(`setup.services.ptype.${pt}`)}</option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('setup.services.priceTypeHelp')}</p>
                    </>
                  )}

                  {(svcPriceType === 'fixed' || svcPriceType === 'from') && labelInput(t('setup.services.price'),
                    <>
                      <div className="flex rounded-lg overflow-hidden border border-border focus-within:ring-2 focus-within:ring-primary">
                        <select
                          value={svcCurrency}
                          onChange={(e) => setSvcCurrency(e.target.value)}
                          className="px-2 py-2 text-sm bg-muted border-r border-border focus:outline-none shrink-0 w-[72px]"
                        >
                          {CURRENCIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={svcPrice}
                          onChange={(e) => setSvcPrice(e.target.value)}
                          className="px-3 py-2 text-sm bg-background flex-1 focus:outline-none min-w-0"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('setup.services.priceHelp')}</p>
                    </>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={handleSaveSvc} disabled={svcSaving}>
                      {svcSaving ? t('setup.services.saving') : t('setup.services.save')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={closeSvcForm}>
                      {t('setup.services.cancel')}
                    </Button>
                  </div>
                </div>
              )}

              {servicesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : services.length === 0 && !showSvcForm ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t('setup.services.empty')}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {services.map((svc) => (
                    <div key={svc.id} className={`border border-border rounded-xl p-4 flex flex-col gap-2 ${!svc.is_active ? 'opacity-50' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{svc.name}</span>
                            {svc.post_id && (
                              <span className="text-xs bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                                {t('bookingSetup.service.fromPost')}
                              </span>
                            )}
                            {!svc.is_active && (
                              <span className="text-xs bg-accent text-muted-foreground px-2 py-0.5 rounded-full">
                                {t('setup.services.inactive')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {svc.duration_minutes} min
                            {svc.price !== null && ` · ${svc.price} ${svc.currency}`}
                            {svc.price_type === 'free' && ` · ${t('setup.services.ptype.free')}`}
                            {svc.price_type === 'negotiable' && ` · ${t('setup.services.ptype.negotiable')}`}
                          </p>
                          {svc.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{svc.description}</p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0 items-center">
                          {svc.post_id ? (
                            <>
                              <button
                                onClick={() => router.push(`/services/${svc.post_id}`)}
                                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent transition-colors"
                                title={t('setup.services.viewPage')}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => router.push(`/services/${svc.post_id}?edit=1`)}
                                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent transition-colors"
                                title={t('setup.services.edit')}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              {svc.is_active && user?.id && (
                                <>
                                  <button
                                    onClick={() => router.push(`/booking/${user!.id}/${svc.id}`)}
                                    className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent transition-colors"
                                    title={t('setup.services.viewPage')}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setShareSvcId(svc.id)}
                                    className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent transition-colors"
                                    title={t('booking.shareService')}
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => openEditSvc(svc)}
                                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent transition-colors"
                                title={t('setup.services.edit')}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleToggleSvc(svc)}
                            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent transition-colors text-xs font-medium"
                            title={svc.is_active ? t('setup.services.deactivate') : t('setup.services.activate')}
                          >
                            {svc.is_active ? t('setup.services.deactivate') : t('setup.services.activate')}
                          </button>
                          <button
                            onClick={() => openDeleteModal(svc)}
                            className="text-destructive/70 hover:text-destructive p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-xs font-medium"
                            title={t('setup.services.delete')}
                          >
                            {t('setup.services.delete')}
                          </button>
                        </div>
                      </div>
                      {/* Location assignments — only show when multiple locations exist */}
                      {locations.length > 1 && svc.is_active && (
                        <div className="pt-2 border-t border-border/50">
                          <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                            {t('setup.services.locations.title')}
                            <span className="ml-1 font-normal">— {t('setup.services.locations.hint')}</span>
                          </p>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {locations.filter((l) => l.is_active).map((loc) => {
                              const assigned = (serviceLocMap[svc.id] ?? []).includes(loc.id);
                              return (
                                <button
                                  key={loc.id}
                                  type="button"
                                  onClick={() => toggleServiceLocation(svc.id, loc.id)}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                                    assigned
                                      ? 'bg-primary/10 text-primary border-primary/30'
                                      : 'bg-background text-muted-foreground border-border hover:border-primary/40'
                                  }`}
                                >
                                  {loc.name}
                                </button>
                              );
                            })}
                          </div>
                          <button
                            onClick={() => handleSaveServiceLocations(svc.id)}
                            disabled={serviceLocSaving === svc.id}
                            className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50"
                          >
                            {serviceLocSaving === svc.id ? '...' : t('setup.services.locations.save')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}


            </div>
          )}

          {/* ── Tab: Hours ───────────────────────────────────────────────── */}
          {activeTab === 'hours' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{t('setup.hours.heading')}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('setup.hours.desc')}</p>
                </div>
              </div>

              {/* Location selector — only when business has multiple locations */}
              {locations.filter(l => l.is_active).length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {locations.filter(l => l.is_active).map(loc => (
                    <button
                      key={loc.id}
                      onClick={async () => {
                        if (loc.id === hoursLocId) return;
                        setHoursLocId(loc.id);
                        setHoursLoading(true);
                        await Promise.all([loadHours(loc.id), loadClosures(loc.id)]);
                      }}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        hoursLocId === loc.id
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                      }`}
                    >
                      <MapPin className="w-3 h-3 shrink-0" />
                      {loc.name}
                    </button>
                  ))}
                </div>
              )}

              {hoursLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : !hoursLocId ? (
                <p className="text-sm text-muted-foreground border border-border rounded-lg p-4 bg-accent/40">
                  {t('setup.profile.inactive')}
                </p>
              ) : (
                <>
                  <div className="flex flex-col divide-y divide-border border border-border rounded-xl overflow-hidden">
                    {[...hours].sort((a, b) => (a.day_of_week === 0 ? 7 : a.day_of_week) - (b.day_of_week === 0 ? 7 : b.day_of_week)).map((h) => (
                      <div key={h.day_of_week} className="px-4 py-3 flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <span className="w-24 text-sm font-medium shrink-0">
                            {t(`setup.hours.day.${h.day_of_week}` as Parameters<typeof t>[0])}
                          </span>
                          <button
                            onClick={() => toggleDay(h.day_of_week)}
                            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 ${
                              h.is_closed
                                ? 'bg-accent text-muted-foreground'
                                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            }`}
                          >
                            {h.is_closed ? t('setup.hours.closed') : t('setup.hours.open')}
                          </button>
                        </div>
                        {!h.is_closed && (() => {
                          const p0 = h.periods.find((p) => p.sort_order === 0);
                          const p1 = h.periods.find((p) => p.sort_order === 1);
                          const timeCls = "border border-border rounded-lg px-2 py-1 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary w-28";
                          return (
                            <div className="flex flex-col gap-1.5 pl-28">
                              {/* Main hours */}
                              <div className="flex items-center gap-2">
                                <TimePicker24h
                                  value={p0?.start_time ?? '09:00'}
                                  onChange={(v) => updatePeriod(h.day_of_week, 0, 'start_time', v)}
                                  className={timeCls}
                                />
                                <span className="text-muted-foreground text-xs">–</span>
                                <TimePicker24h
                                  value={p1 ? p1.end_time : (p0?.end_time ?? '17:00')}
                                  onChange={(v) => p1
                                    ? updatePeriod(h.day_of_week, 1, 'end_time', v)
                                    : updatePeriod(h.day_of_week, 0, 'end_time', v)
                                  }
                                  className={timeCls}
                                />
                              </div>
                              {/* Break */}
                              {p1 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground w-12 shrink-0">{t('setup.hours.break')}</span>
                                  <TimePicker24h
                                    value={p0?.end_time ?? '12:00'}
                                    onChange={(v) => updatePeriod(h.day_of_week, 0, 'end_time', v)}
                                    className={timeCls}
                                  />
                                  <span className="text-muted-foreground text-xs">–</span>
                                  <TimePicker24h
                                    value={p1.start_time}
                                    onChange={(v) => updatePeriod(h.day_of_week, 1, 'start_time', v)}
                                    className={timeCls}
                                  />
                                  <button
                                    onClick={() => removeBreak(h.day_of_week)}
                                    className="text-muted-foreground hover:text-destructive transition-colors flex items-center gap-0.5 text-xs ml-1"
                                  >
                                    <X className="w-3 h-3" />
                                    {t('setup.hours.removeBreak')}
                                  </button>
                                </div>
                              )}
                              {/* Add break */}
                              {!p1 && (
                                <button
                                  onClick={() => addBreak(h.day_of_week)}
                                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors mt-0.5 self-start"
                                >
                                  <Plus className="w-3 h-3" />
                                  {t('setup.hours.addBreak')}
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>

                  <Button onClick={handleSaveHours} disabled={hoursSaving} className="self-start">
                    {hoursSaving ? t('setup.hours.saving') : t('setup.hours.save')}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* ── Tab: Locations ───────────────────────────────────────────── */}
          {activeTab === 'locations' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{t('setup.locations.heading')}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('setup.locations.hint')}</p>
                </div>
                {isBusinessActive && (
                  <Button size="sm" variant="outline" onClick={openAddLoc}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    {t('setup.locations.add')}
                  </Button>
                )}
              </div>

              {/* Location form */}
              {showLocForm && (
                <div className="border border-border rounded-xl p-4 flex flex-col gap-3 bg-card">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                      {editingLoc ? t('setup.locations.edit') : t('setup.locations.add')}
                    </span>
                    <button onClick={closeLocForm} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {labelInput(t('setup.locations.name'),
                    <input type="text" value={locName} onChange={(e) => setLocName(e.target.value)}
                      className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {labelInput(t('setup.locations.city'),
                      <CityAutocomplete
                        value={locCity}
                        onChange={(city, placeData) => {
                          setLocCity(city);
                          if (placeData?.country) {
                            const matched = matchCountryValue(placeData.country);
                            if (matched) setLocCountry(matched);
                          }
                        }}
                        placeholder={t('setup.locations.city')}
                      />
                    )}
                    {labelInput(t('setup.locations.country'),
                      <select
                        value={locCountry}
                        onChange={(e) => setLocCountry(e.target.value)}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary w-full"
                      >
                        <option value=""></option>
                        {countries.map((c) => (
                          <option key={c.value} value={c.value}>
                            {language === 'sr' ? c.sr : language === 'de' ? c.de : c.en}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {labelInput(t('setup.locations.address'),
                    <input type="text" value={locAddress} onChange={(e) => setLocAddress(e.target.value)}
                      className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {labelInput(t('setup.locations.timezone'),
                      <TimezoneSelect
                        value={locTimezone}
                        onChange={setLocTimezone}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    )}
                    {labelInput(t('setup.locations.phone'),
                      <input type="text" value={locPhone} onChange={(e) => setLocPhone(e.target.value)}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={handleSaveLoc} disabled={locSaving}>
                      {locSaving ? t('setup.locations.saving') : t('setup.locations.save')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={closeLocForm}>
                      {t('setup.locations.cancel')}
                    </Button>
                  </div>
                </div>
              )}

              {locsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : locations.length === 0 && !showLocForm ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t('setup.locations.empty')}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {locations.map((loc) => (
                    <div key={loc.id} className={`border border-border rounded-xl p-4 flex items-start gap-3 ${!loc.is_active ? 'opacity-50' : ''}`}>
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{loc.name}</span>
                          {loc.is_primary && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              {t('setup.locations.primary')}
                            </span>
                          )}
                          {!loc.is_active && (
                            <span className="text-xs bg-accent text-muted-foreground px-2 py-0.5 rounded-full">
                              {t('setup.locations.inactive')}
                            </span>
                          )}
                        </div>
                        {(loc.city || loc.country) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {[loc.city, loc.country].filter(Boolean).join(', ')}
                          </p>
                        )}
                        {loc.address && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([loc.address, loc.city, loc.country].filter(Boolean).join(', '))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors"
                          >
                            {loc.address}
                          </a>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0 flex-col items-end">
                        <button
                          onClick={() => openEditLoc(loc)}
                          className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent transition-colors"
                          title={t('setup.locations.edit')}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {!loc.is_primary && loc.is_active && (
                          <button
                            onClick={() => handleSetPrimary(loc.id)}
                            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-accent transition-colors"
                          >
                            {t('setup.locations.setPrimary')}
                          </button>
                        )}
                        {loc.is_active && deactivatingLocId !== loc.id && (
                          <button
                            onClick={() => handleDeactivateLoc(loc.id)}
                            className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded-lg hover:bg-destructive/10 transition-colors"
                          >
                            {t('setup.locations.deactivate')}
                          </button>
                        )}
                        {deactivatingLocId === loc.id && (
                          <div className="flex flex-col items-end gap-1 mt-1">
                            <p className="text-[11px] text-destructive font-medium">Sigurno?</p>
                            <div className="flex gap-1">
                              <button
                                onClick={() => confirmDeactivateLoc(loc.id)}
                                className="text-[11px] px-2 py-0.5 rounded bg-destructive text-white font-medium"
                              >
                                Da
                              </button>
                              <button
                                onClick={() => setDeactivatingLocId(null)}
                                className="text-[11px] px-2 py-0.5 rounded bg-accent text-foreground"
                              >
                                Ne
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Notifications ──────────────────────────────────────── */}
          {activeTab === 'notifications' && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="font-semibold">{t('notifPrefs.title')}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t('notifPrefs.desc')}</p>
              </div>

              <div className="border border-border rounded-xl p-4 flex flex-col gap-3">
                {/* Push toggle */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm">{t('notifPrefs.push')}</p>
                    <p className="text-xs text-muted-foreground">{t('notifPrefs.pushDesc')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifPrefs(p => ({ ...p, push_enabled: !p.push_enabled }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 mt-0.5 ${
                      notifPrefs.push_enabled ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5 ${
                      notifPrefs.push_enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* Email toggle */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm">{t('notifPrefs.email')}</p>
                    <p className="text-xs text-muted-foreground">{t('notifPrefs.emailDesc')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifPrefs(p => ({ ...p, email_enabled: !p.email_enabled }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 mt-0.5 ${
                      notifPrefs.email_enabled ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5 ${
                      notifPrefs.email_enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* Master toggle hint */}
                <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 leading-snug">
                  {t('notifPrefs.masterHint')}
                </p>

                {/* Quiet hours toggle */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm">{t('notifPrefs.quiet')}</p>
                    <p className="text-xs text-muted-foreground">{t('notifPrefs.quietDesc')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifPrefs(p => ({ ...p, quiet_enabled: !p.quiet_enabled }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 mt-0.5 ${
                      notifPrefs.quiet_enabled ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5 ${
                      notifPrefs.quiet_enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {notifPrefs.quiet_enabled && (
                  <div className="flex gap-4 mt-1 pl-0.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-muted-foreground font-medium">{t('notifPrefs.quietFrom')}</label>
                      <TimePicker24h
                        value={notifPrefs.quiet_from}
                        onChange={v => setNotifPrefs(p => ({ ...p, quiet_from: v }))}
                        className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-muted-foreground font-medium">{t('notifPrefs.quietTo')}</label>
                      <TimePicker24h
                        value={notifPrefs.quiet_to}
                        onChange={v => setNotifPrefs(p => ({ ...p, quiet_to: v }))}
                        className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}

                {/* Booking event types */}
                <div className="border-t border-border pt-3 mt-1 flex flex-col gap-2">
                  <div>
                    <p className="text-xs font-semibold">{t('notifPrefs.events')}</p>
                    <p className="text-[11px] text-muted-foreground">{t('notifPrefs.eventsDesc')}</p>
                  </div>
                  {/* Booking events with separate in-app + email toggles */}
                  {(() => {
                    const hasNonOwnerActiveStaff = staffMembers.some(sm => sm.is_active && sm.role !== 'owner');
                    const rows = [
                      {
                        pushKey: 'notify_new_booking'   as const,
                        emailKey: 'notify_new_booking_email' as const,
                        label: t('notifPrefs.newBooking'),
                        desc: t('notifPrefs.newBookingDesc'),
                        pushDesc: 'Obavještenje u zvonu kad klijent direktno zakaže',
                        emailDesc: 'Email kad klijent direktno zakaže',
                        show: true,
                      },
                      {
                        pushKey: 'notify_staff_booking'  as const,
                        emailKey: 'notify_staff_booking_email' as const,
                        label: t('notifPrefs.staffBooking'),
                        desc: t('notifPrefs.staffBookingDesc'),
                        pushDesc: 'Obavještenje u zvonu kad klijent zakaže kod radnika',
                        emailDesc: 'Email kad klijent zakaže kod radnika',
                        show: staffLoading || hasNonOwnerActiveStaff,
                      },
                      {
                        pushKey: 'notify_staff_added_booking'       as const,
                        emailKey: 'notify_staff_added_booking_email' as const,
                        label: t('notifPrefs.staffAdded'),
                        desc: t('notifPrefs.staffAddedDesc'),
                        pushDesc: 'Obavještenje u zvonu kad radnik ručno doda termin',
                        emailDesc: 'Email kad radnik ručno doda termin',
                        show: staffLoading || hasNonOwnerActiveStaff,
                      },
                      {
                        pushKey: 'notify_cancellation'       as const,
                        emailKey: 'notify_cancellation_email' as const,
                        label: t('notifPrefs.cancellation'),
                        desc: t('notifPrefs.cancellationDesc'),
                        pushDesc: 'Obavještenje u zvonu kad klijent otkaže termin',
                        emailDesc: 'Email kad klijent otkaže termin',
                        show: true,
                      },
                      {
                        pushKey: 'notify_reschedule'       as const,
                        emailKey: 'notify_reschedule_email' as const,
                        label: t('notifPrefs.reschedule'),
                        desc: t('notifPrefs.rescheduleDesc'),
                        pushDesc: 'Obavještenje u zvonu kad radnik premjesti termin',
                        emailDesc: 'Email kad radnik premjesti termin',
                        show: staffLoading || hasNonOwnerActiveStaff,
                      },
                    ];
                    return rows.filter(r => r.show).map(({ pushKey, emailKey, label, desc, pushDesc, emailDesc }) => (
                    <div key={pushKey} className="space-y-2">
                      <div>
                        <p className="text-xs font-medium">{label}</p>
                        <p className="text-[11px] text-muted-foreground leading-tight">{desc}</p>
                      </div>
                      <div className="flex flex-col gap-1.5 pl-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5">
                            <Bell className="w-3 h-3 text-muted-foreground shrink-0" />
                            <div>
                              <p className="text-[11px] font-medium">In-app</p>
                              <p className="text-[10px] text-muted-foreground leading-tight">{pushDesc}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNotifPrefs(p => ({ ...p, [pushKey]: !p[pushKey] }))}
                            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${notifPrefs[pushKey] ? 'bg-primary' : 'bg-muted'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5 ${notifPrefs[pushKey] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                            <div>
                              <p className="text-[11px] font-medium">Email</p>
                              <p className="text-[10px] text-muted-foreground leading-tight">{emailDesc}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNotifPrefs(p => ({ ...p, [emailKey]: !p[emailKey] }))}
                            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${notifPrefs[emailKey] ? 'bg-primary' : 'bg-muted'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5 ${notifPrefs[emailKey] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ));
                  })()}

                </div>

                <Button
                  onClick={handleSaveNotifPrefs}
                  disabled={notifPrefsSaving}
                  variant="outline"
                  className="self-start mt-1"
                >
                  {notifPrefsSaving ? '...' : t('notifPrefs.save')}
                </Button>
              </div>
            </div>
          )}

          {/* ── Tab: Rules ───────────────────────────────────────────────── */}
          {activeTab === 'rules' && (
            <div className="flex flex-col gap-4">
              {!isBusinessActive && (
                <p className="text-sm text-muted-foreground border border-border rounded-lg p-4 bg-accent/40">
                  {t('setup.profile.inactive')}
                </p>
              )}
              <div>
                <h2 className="font-semibold">{t('setup.rules.heading')}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t('setup.rules.desc')}</p>
              </div>

              {rulesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Confirmation mode */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <label className="text-sm font-medium">{t('setup.rules.confirmation')}</label>
                      <button type="button" onClick={() => setActiveRuleInfo(activeRuleInfo === 'confirmation' ? null : 'confirmation')} className="text-muted-foreground/80 hover:text-primary transition-colors">
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {activeRuleInfo === 'confirmation' && (
                      <p className="text-xs text-muted-foreground leading-relaxed bg-muted/40 px-3 py-2 rounded-lg border border-border/50">
                        {rules.confirmation_mode === 'instant' ? t('setup.rules.confirmation.instant.desc') : t('setup.rules.confirmation.approval.desc')}
                      </p>
                    )}
                    <select
                      value={rules.confirmation_mode}
                      onChange={(e) => setRules((r) => ({ ...r, confirmation_mode: e.target.value as 'instant' | 'requires_approval' }))}
                      className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="instant">{t('setup.rules.confirmation.instant')}</option>
                      <option value="requires_approval">{t('setup.rules.confirmation.approval')}</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Max advance */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <label className="text-sm font-medium">{t('setup.rules.maxAdvance')}</label>
                        <button type="button" onClick={() => setActiveRuleInfo(activeRuleInfo === 'advance' ? null : 'advance')} className="text-muted-foreground/80 hover:text-primary transition-colors">
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {activeRuleInfo === 'advance' && (
                        <p className="text-xs text-muted-foreground leading-relaxed bg-muted/40 px-3 py-2 rounded-lg border border-border/50">
                          {t('setup.rules.maxAdvance.desc')}
                        </p>
                      )}
                      <select
                        value={rules.max_advance_days}
                        onChange={(e) => setRules((r) => ({ ...r, max_advance_days: Number(e.target.value) }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {[7, 14, 21, 30, 45, 60, 90, 180, 365].map((v) => (
                          <option key={v} value={v}>
                            {v === 180 ? t('setup.rules.months6') : v === 365 ? t('setup.rules.year1') : `${v} dana`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Min notice */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <label className="text-sm font-medium">{t('setup.rules.minNotice')}</label>
                        <button type="button" onClick={() => setActiveRuleInfo(activeRuleInfo === 'notice' ? null : 'notice')} className="text-muted-foreground/80 hover:text-primary transition-colors">
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {activeRuleInfo === 'notice' && (
                        <p className="text-xs text-muted-foreground leading-relaxed bg-muted/40 px-3 py-2 rounded-lg border border-border/50">
                          {t('setup.rules.minNotice.desc')}
                        </p>
                      )}
                      <select
                        value={rules.min_notice_minutes}
                        onChange={(e) => setRules((r) => ({ ...r, min_notice_minutes: Number(e.target.value) }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {[0, 30, 60, 120, 180, 240, 480, 720, 1440].map((v) => (
                          <option key={v} value={v}>{v === 0 ? '0' : v < 60 ? `${v} min` : v < 1440 ? `${v / 60}h` : '24h'}</option>
                        ))}
                      </select>
                    </div>
                    {/* Cancellation */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <label className="text-sm font-medium">{t('setup.rules.cancellation')}</label>
                        <button type="button" onClick={() => setActiveRuleInfo(activeRuleInfo === 'cancel' ? null : 'cancel')} className="text-muted-foreground/80 hover:text-primary transition-colors">
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {activeRuleInfo === 'cancel' && (
                        <p className="text-xs text-muted-foreground leading-relaxed bg-muted/40 px-3 py-2 rounded-lg border border-border/50">
                          {t('setup.rules.cancellation.desc')}
                        </p>
                      )}
                      <select
                        value={rules.cancellation_hours}
                        onChange={(e) => setRules((r) => ({ ...r, cancellation_hours: Number(e.target.value) }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {[0, 1, 2, 4, 8, 12, 24, 48, 72, 720, 2160].map((v) => (
                          <option key={v} value={v}>
                            {v === 0 ? '0' : v === 720 ? t('setup.rules.month1') : v === 2160 ? t('setup.rules.months3') : `${v}h`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveRules}
                    disabled={rulesSaving || !isBusinessActive}
                    className="self-start"
                  >
                    {rulesSaving ? t('setup.rules.saving') : t('setup.rules.save')}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* ── Tab: Staff ──────────────────────────────────────────────── */}
          {activeTab === 'staff' && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="font-semibold">{t('setup.staff.heading')}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {locations.filter(l => l.is_active).length > 1
                    ? t('setup.staff.descMultiLoc')
                    : t('setup.staff.desc')}
                </p>
              </div>

              {!isBusinessActive ? (
                <p className="text-sm text-muted-foreground border border-border rounded-lg p-4 bg-accent/40">
                  {t('setup.profile.inactive')}
                </p>
              ) : !primaryLocId ? (
                <p className="text-sm text-muted-foreground border border-border rounded-lg p-4 bg-accent/40">
                  {t('setup.staff.noLocation')}
                </p>
              ) : staffLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Add staff — search by name */}
                  <div className="flex flex-col gap-2">
                    {selectedStaffToAdd ? (
                      /* Selected user card */
                      <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-primary/30 bg-primary/5">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden text-sm font-bold text-primary">
                          {selectedStaffToAdd.avatar_url ? (
                            <img src={selectedStaffToAdd.avatar_url} alt={selectedStaffToAdd.name} className="w-full h-full object-cover" />
                          ) : (
                            selectedStaffToAdd.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{selectedStaffToAdd.name}</p>
                          {selectedStaffToAdd.city && (
                            <p className="text-xs text-muted-foreground">{selectedStaffToAdd.city}</p>
                          )}
                        </div>
                        <button
                          onClick={() => setSelectedStaffToAdd(null)}
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      /* Search input */
                      <div className="relative">
                        <input
                          type="text"
                          value={staffAddSearch}
                          onChange={(e) => setStaffAddSearch(e.target.value)}
                          placeholder={t('bookingSetup.staff.search.placeholder')}
                          className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary w-full"
                        />
                        {staffAddSearching && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    )}

                    {/* Search results */}
                    {staffAddResults.length > 0 && !selectedStaffToAdd && (
                      <div className="border border-border rounded-xl overflow-hidden">
                        {staffAddResults.map((u, i) => (
                          <button
                            key={u.id}
                            onClick={() => { setSelectedStaffToAdd(u); setStaffAddResults([]); setStaffAddSearch(''); }}
                            className={`flex items-center gap-3 p-3 hover:bg-muted/60 w-full text-left transition-colors ${i < staffAddResults.length - 1 ? 'border-b border-border/50' : ''}`}
                          >
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden text-xs font-bold">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt={u.name} className="w-full h-full object-cover" />
                              ) : (
                                u.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{u.name}</p>
                              {u.city && <p className="text-xs text-muted-foreground">{u.city}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {staffAddSearch.length >= 2 && staffAddResults.length === 0 && !staffAddSearching && !selectedStaffToAdd && (
                      <p className="text-xs text-muted-foreground">{t('bookingSetup.staff.search.noResults')}</p>
                    )}

                    {!selectedStaffToAdd && (
                      <p className="text-xs text-muted-foreground/70">
                        {t('bookingSetup.staff.search.mustHaveAccount')}
                      </p>
                    )}

                    {/* Role selector + Add button */}
                    {selectedStaffToAdd && (
                      <div className="flex items-end gap-2">
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs font-medium text-muted-foreground">{t('setup.staff.inviteRole')}</label>
                          <select
                            value={addingStaffRole}
                            onChange={(e) => setAddingStaffRole(e.target.value as 'manager' | 'worker')}
                            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="worker">{t('setup.staff.role.worker')}</option>
                            <option value="manager">{t('setup.staff.role.manager')}</option>
                          </select>
                        </div>
                        <Button onClick={handleAddStaffDirect} disabled={addingStaff}>
                          {addingStaff ? <Loader2 className="w-4 h-4 animate-spin" /> : t('setup.staff.add')}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Pending invitations */}
                  {staffInvitations.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {t('setup.staff.pending')}
                      </span>
                      {staffInvitations.map((inv) => (
                        <div key={inv.id} className="border border-dashed border-border rounded-xl px-4 py-3 flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium">{inv.email}</span>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t(`setup.staff.role.${inv.role}` as Parameters<typeof t>[0])}
                              {inv.location_name && ` · ${inv.location_name}`}
                            </p>
                          </div>
                          <button
                            onClick={() => handleCancelInvite(inv.id)}
                            disabled={cancellingInviteId === inv.id}
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                          >
                            {cancellingInviteId === inv.id ? '...' : t('setup.staff.cancelInvite')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Staff member list */}
                  {staffMembers.length === 0 && staffInvitations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">{t('setup.staff.empty')}</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {staffMembers.filter((sm) => sm.is_active).map((sm) => (
                        <div key={sm.id} className="border border-border rounded-xl overflow-hidden">
                          {/* Staff card header */}
                          <div className="px-4 py-3 flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{sm.name}</span>
                                <span className="text-[11px] bg-accent text-muted-foreground px-2 py-0.5 rounded-full">
                                  {t(`setup.staff.role.${sm.role}` as Parameters<typeof t>[0])}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{sm.email}</p>
                              {locations.length > 1 && (
                                <div className="flex items-center gap-1.5 mt-1">
                                  <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                                  <select
                                    value={sm.primary_location_id ?? locations[0]?.id ?? ''}
                                    disabled={savingLocStaffId === sm.id}
                                    onChange={(e) => handleSetStaffLocation(sm.id, e.target.value || null)}
                                    className="text-xs border border-border rounded-md px-1.5 py-0.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                                  >
                                    {locations.map(loc => (
                                      <option key={loc.id} value={loc.id}>{loc.name}{loc.city ? ` — ${loc.city}` : ''}</option>
                                    ))}
                                  </select>
                                  {savingLocStaffId === sm.id && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {sm.role !== 'owner' && sm.is_active && (
                                confirmingRevokeId === sm.id ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">{t('setup.staff.revokeConfirm')}</span>
                                    <button
                                      onClick={() => setConfirmingRevokeId(null)}
                                      className="text-xs px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors"
                                    >
                                      {t('common.cancel')}
                                    </button>
                                    <button
                                      onClick={() => handleRevokeStaff(sm.id)}
                                      disabled={revokingStaffId === sm.id}
                                      className="text-xs px-2 py-0.5 rounded bg-destructive text-white hover:bg-destructive/80 transition-colors disabled:opacity-50"
                                    >
                                      {revokingStaffId === sm.id ? '...' : t('common.confirm')}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmingRevokeId(sm.id)}
                                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    {t('setup.staff.revoke')}
                                  </button>
                                )
                              )}
                              {sm.is_active && (
                                <button
                                  onClick={() => {
                                    if (expandedStaffId === sm.id) {
                                      setExpandedStaffId(null);
                                    } else {
                                      setExpandedStaffId(sm.id);
                                      loadStaffDetails(sm.id);
                                    }
                                  }}
                                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                                >
                                  {expandedStaffId === sm.id ? '▲' : '▼'} {expandedStaffId === sm.id ? 'Sakrij' : 'Detalji'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Expanded: staff hours + services */}
                          {expandedStaffId === sm.id && (
                            <div className="border-t border-border bg-card/50 px-4 py-4 flex flex-col gap-4">
                              {/* Staff hours — week-by-week */}
                              <div>
                                <p className="text-xs font-semibold mb-1">{t('setup.staff.hours.title')}</p>
                                <p className="text-[11px] text-muted-foreground mb-2">{t('setup.staff.hours.hint')}</p>
                                {staffShiftsMap[sm.id] !== undefined ? (() => {
                                  const weeks = getScheduleWeeks();
                                  const weekIdx = staffWeekIndexMap[sm.id] ?? 0;
                                  const weekStart = weeks[weekIdx];
                                  const shifts = staffShiftsMap[sm.id] ?? [];
                                  const explicit = isWeekExplicit(weekStart, shifts);
                                  const schedule = staffScheduleEditMap[sm.id] ?? emptyWeekSchedule();
                                  const timeCls = "border border-border rounded px-2 py-0.5 text-xs bg-background focus:outline-none w-24";
                                  return (
                                    <>
                                      {/* Week navigator */}
                                      <div className="flex items-center gap-2 mb-2">
                                        <button
                                          onClick={() => changeStaffWeek(sm.id, -1)}
                                          disabled={weekIdx === 0}
                                          className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors"
                                        >
                                          <ChevronLeft className="w-3.5 h-3.5" />
                                        </button>
                                        <span className="text-xs font-medium min-w-[90px] text-center">{formatWeekRangeShort(weekStart)}</span>
                                        <button
                                          onClick={() => changeStaffWeek(sm.id, 1)}
                                          disabled={weekIdx === STAFF_SCHEDULE_WEEKS - 1}
                                          className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors"
                                        >
                                          <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                        {explicit
                                          ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{t('ownerStaffHours.explicit')}</span>
                                          : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground font-medium">{t('ownerStaffHours.inherited')}</span>
                                        }
                                      </div>
                                      {/* Days */}
                                      <div className="flex flex-col divide-y divide-border border border-border rounded-xl overflow-hidden mb-2">
                                        {[0,1,2,3,4,5,6].map(dow => {
                                          const day = schedule[dow];
                                          const offLabel = t(`shift.${day.off_reason === 'vacation' ? 'vacation' : day.off_reason === 'sick_leave' ? 'sickLeave' : 'dayOff'}` as Parameters<typeof t>[0]);
                                          return (
                                            <div key={dow} className="px-2 py-1.5 flex flex-col gap-1">
                                              <div className="flex items-center gap-1.5">
                                                <span className="w-16 text-[11px] font-medium shrink-0 text-muted-foreground">
                                                  {t(DOW_LABELS[dow] as Parameters<typeof t>[0])}
                                                </span>
                                                <button
                                                  onClick={() => toggleStaffDayOff(sm.id, dow)}
                                                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-colors shrink-0 ${
                                                    day.is_closed
                                                      ? 'bg-accent text-muted-foreground'
                                                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                  }`}
                                                >
                                                  {day.is_closed ? offLabel : t('shift.working')}
                                                </button>
                                                {day.is_closed && (
                                                  <button
                                                    onClick={() => cycleStaffOffReason(sm.id, dow)}
                                                    className="text-[9px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                                                  >
                                                    ↻
                                                  </button>
                                                )}
                                                {!day.is_closed && (
                                                  <div className="flex items-center gap-1 ml-auto">
                                                    <TimePicker24h value={day.start_time} className={timeCls}
                                                      onChange={v => updateStaffDay(sm.id, dow, { start_time: v })} />
                                                    <span className="text-muted-foreground text-[10px]">–</span>
                                                    <TimePicker24h value={day.end_time} className={timeCls}
                                                      onChange={v => updateStaffDay(sm.id, dow, { end_time: v })} />
                                                    <button
                                                      type="button"
                                                      onClick={() => toggleStaffBreak(sm.id, dow)}
                                                      className="text-[9px] text-muted-foreground hover:text-foreground transition-colors ml-1 shrink-0"
                                                    >
                                                      {day.has_break ? '−P' : '+P'}
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                              {!day.is_closed && day.has_break && (
                                                <div className="flex items-center gap-1 ml-16">
                                                  <span className="text-[9px] text-muted-foreground shrink-0">pauza</span>
                                                  <TimePicker24h value={day.break_start} className={timeCls}
                                                    onChange={v => updateStaffDay(sm.id, dow, { break_start: v })} />
                                                  <span className="text-muted-foreground text-[10px]">–</span>
                                                  <TimePicker24h value={day.break_end} className={timeCls}
                                                    onChange={v => updateStaffDay(sm.id, dow, { break_end: v })} />
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleSaveStaffHours(sm.id)}
                                          disabled={staffHoursSaving === sm.id}
                                          className="text-xs"
                                        >
                                          {staffHoursSaving === sm.id ? '...' : t('setup.staff.hours.save')}
                                        </Button>
                                        {(staffWeekIndexMap[sm.id] ?? 0) < STAFF_SCHEDULE_WEEKS - 1 && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleCopyStaffWeek(sm.id)}
                                            disabled={!!staffCopyingMap[sm.id]}
                                            className="text-xs flex items-center gap-1"
                                            title={t('schedule.copyWeek')}
                                          >
                                            <Copy className="w-3 h-3" />
                                            {staffCopyingMap[sm.id] ? '...' : t('schedule.copyWeek')}
                                          </Button>
                                        )}
                                      </div>
                                    </>
                                  );
                                })() : (
                                  <div className="flex justify-center py-2">
                                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                  </div>
                                )}
                              </div>

                              {/* Staff services */}
                              {services.filter((s) => s.is_active).length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold mb-1">{t('setup.staff.services.title')}</p>
                                  <p className="text-[11px] text-muted-foreground mb-2">{t('setup.staff.services.hint')}</p>
                                  <div className="flex flex-wrap gap-1.5 mb-2">
                                    {services.filter((s) => s.is_active).map((svc) => {
                                      const assigned = (staffServicesMap[sm.id] ?? []).includes(svc.id);
                                      return (
                                        <button
                                          key={svc.id}
                                          type="button"
                                          onClick={() => toggleStaffService(sm.id, svc.id)}
                                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                                            assigned
                                              ? 'bg-primary/10 text-primary border-primary/30'
                                              : 'bg-background text-muted-foreground border-border hover:border-primary/40'
                                          }`}
                                        >
                                          {svc.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSaveStaffServices(sm.id)}
                                    disabled={staffServicesSaving === sm.id}
                                    className="text-xs"
                                  >
                                    {staffServicesSaving === sm.id ? '...' : t('setup.staff.services.save')}
                                  </Button>
                                </div>
                              )}

                              {/* Staff permissions — not shown for owner */}
                              {sm.role !== 'owner' && staffPermissionsMap[sm.id] !== undefined && (
                                <div>
                                  <p className="text-xs font-semibold mb-1">{t('setup.staff.permissions.title')}</p>
                                  <p className="text-[11px] text-muted-foreground mb-3">{t('setup.staff.permissions.hint')}</p>
                                  <div className="flex flex-col gap-2 mb-3">
                                    {([
                                      { key: 'can_set_hours',           label: t('setup.staff.permissions.setHours') },
                                      { key: 'can_create_bookings',     label: t('setup.staff.permissions.createBookings') },
                                      { key: 'can_cancel_bookings',     label: t('setup.staff.permissions.cancelBookings') },
                                      { key: 'can_reschedule_bookings', label: t('setup.staff.permissions.rescheduleBookings') },
                                      { key: 'can_complete_bookings',   label: t('setup.staff.permissions.completeBookings') },
                                      { key: 'can_block_time',          label: t('setup.staff.permissions.blockTime') },
                                    ] as const).map(({ key, label }) => {
                                      const enabled = staffPermissionsMap[sm.id]?.[key] ?? false;
                                      return (
                                        <label key={key} className="flex items-center gap-3 cursor-pointer group">
                                          <button
                                            type="button"
                                            role="switch"
                                            aria-checked={enabled}
                                            onClick={() => setStaffPermissionsMap((prev) => ({
                                              ...prev,
                                              [sm.id]: { ...prev[sm.id], [key]: !enabled },
                                            }))}
                                            className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                                              enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                                            }`}
                                          >
                                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                              enabled ? 'translate-x-4' : 'translate-x-0'
                                            }`} />
                                          </button>
                                          <span className="text-xs text-foreground group-hover:text-primary transition-colors">{label}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSaveStaffPermissions(sm.id)}
                                    disabled={permSaving === sm.id}
                                    className="text-xs"
                                  >
                                    {permSaving === sm.id ? '...' : t('setup.staff.permissions.save')}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Tab: Restaurant Tables ────────────────────────────────────── */}
          {activeTab === 'tables' && activeProfileId && (
            <div className="flex flex-col gap-5">
              <RestaurantTablesTab businessId={activeProfileId} />
            </div>
          )}

          {/* ── Tab: Menu ─────────────────────────────────────────────────── */}
          {activeTab === 'menu' && activeProfileId && (
            <div className="flex flex-col gap-5">
              <MenuTab businessId={activeProfileId} />
            </div>
          )}

          {/* ── Tab: Delivery Settings ────────────────────────────────────── */}
          {activeTab === 'delivery' && activeProfileId && (
            <div className="flex flex-col gap-5">
              <DeliverySettingsTab businessId={activeProfileId} />
            </div>
          )}

          {/* ── Tab: Trade Services ───────────────────────────────────────── */}
          {activeTab === 'trade_services' && activeProfileId && (
            <div className="flex flex-col gap-5">
              <TradeServicesTab businessId={activeProfileId} />
            </div>
          )}

          {/* ── Tab: Accommodation Units ──────────────────────────────────── */}
          {activeTab === 'acc_units' && activeProfileId && (
            <div className="flex flex-col gap-5">
              <AccommodationUnitsTab businessId={activeProfileId} />
            </div>
          )}

          {/* ── Tab: Accommodation Rules ──────────────────────────────────── */}
          {activeTab === 'acc_rules' && activeProfileId && (
            <div className="flex flex-col gap-5">
              <AccommodationSettingsTab businessId={activeProfileId} />
            </div>
          )}

        </div>
      </div>
      {shareSvcId && activeProfileId && (
        <SharePostModal
          postId={shareSvcId}
          open={!!shareSvcId}
          onOpenChange={(open) => { if (!open) setShareSvcId(null); }}
          urlPath={`/booking/${activeProfileId}/${shareSvcId}`}
        />
      )}

      {/* ── Delete Service Modal ─────────────────────────────────────────────── */}
      {deleteModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!deleteModalLoading) setDeleteModal(null); }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto bg-background border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                  <h3 className="text-base font-semibold text-foreground">{t('setup.services.delete')}</h3>
                </div>
                <button
                  onClick={() => setDeleteModal(null)}
                  className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-sm font-medium text-foreground">{deleteModal.svcName}</p>

              {deleteModalLoading ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : deleteModalFutureCount !== null && deleteModalFutureCount > 0 ? (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">
                    {t('booking.delete.hasFutureBlock').replace('{count}', String(deleteModalFutureCount))}
                  </p>
                </div>
              ) : (
                <>
                  {deleteModal.postId && (
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-3 flex items-start gap-2">
                      <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-700 dark:text-amber-400">{t('booking.delete.postWillDeactivate')}</p>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">{t('booking.delete.serviceWarning')}</p>
                </>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setDeleteModal(null)}
                  className="flex-1 py-2 px-4 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  {t('common.cancel')}
                </button>
                {!(deleteModalFutureCount !== null && deleteModalFutureCount > 0) && !deleteModalLoading && (
                  <button
                    onClick={confirmDeleteModal}
                    className="flex-1 py-2 px-4 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
                  >
                    {t('setup.services.delete')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Reactivate Profile Modal ─────────────────────────────────────────── */}
      {reactivateProfileModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!reactivateProfileLoading) setReactivateProfileModal(false); }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto bg-background border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                  <h3 className="text-base font-semibold text-foreground">{t('booking.reactivateProfile.title')}</h3>
                </div>
                <button
                  onClick={() => setReactivateProfileModal(false)}
                  disabled={reactivateProfileLoading}
                  className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground">{t('booking.reactivateProfile.desc')}</p>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setReactivateProfileModal(false)}
                  disabled={reactivateProfileLoading}
                  className="flex-1 py-2 px-4 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleReactivateProfile}
                  disabled={reactivateProfileLoading}
                  className="flex-1 py-2 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {reactivateProfileLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {t('booking.reactivateProfile.confirm')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Deactivate Profile Modal ─────────────────────────────────────────── */}
      {deactivateProfileModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!deactivateProfileLoading) setDeactivateProfileModal(false); }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto bg-background border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                  <h3 className="text-base font-semibold text-foreground">{t('booking.deleteProfile.title')}</h3>
                </div>
                <button
                  onClick={() => setDeactivateProfileModal(false)}
                  className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
                  disabled={deactivateProfileLoading}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground">{t('booking.deleteProfile.desc')}</p>

              {deactivateProfileFutureCount === null ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : deactivateProfileFutureCount > 0 ? (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">
                    {t('booking.deleteProfile.hasFutureBlock').replace('{count}', String(deactivateProfileFutureCount))}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{t('booking.deleteProfile.warning')}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setDeactivateProfileModal(false)}
                  disabled={deactivateProfileLoading}
                  className="flex-1 py-2 px-4 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                {deactivateProfileFutureCount === 0 && (
                  <button
                    onClick={handleDeactivateProfile}
                    disabled={deactivateProfileLoading}
                    className="flex-1 py-2 px-4 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
                  >
                    {deactivateProfileLoading ? t('booking.deleteProfile.checking') : t('booking.deleteProfile.confirm')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Permanent Delete Profile Modal ──────────────────────────────────── */}
      {deleteProfileModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={closeDeleteProfileModal}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto bg-background border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">

              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-destructive shrink-0" />
                  <h3 className="text-base font-semibold text-foreground">{t('booking.permanentDelete.title')}</h3>
                </div>
                <button
                  onClick={closeDeleteProfileModal}
                  className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
                  disabled={deleteProfileLoading}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Step 1: Warning */}
              {deleteProfileStep === 1 && (
                <>
                  <p className="text-sm text-muted-foreground">{t('booking.permanentDelete.step1Desc')}</p>

                  <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 flex flex-col gap-2">
                    <p className="text-xs font-semibold text-destructive">{t('booking.permanentDelete.willDelete')}</p>
                    <ul className="flex flex-col gap-1">
                      {(['item1', 'item2', 'item3'] as const).map(key => (
                        <li key={key} className="flex items-start gap-1.5 text-xs text-destructive">
                          <span className="mt-0.5 shrink-0">•</span>
                          <span>{t(`booking.permanentDelete.${key}`)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <p className="text-xs text-muted-foreground italic">{t('booking.permanentDelete.postsNote')}</p>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={closeDeleteProfileModal}
                      className="flex-1 py-2 px-4 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={() => setDeleteProfileStep(2)}
                      className="flex-1 py-2 px-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
                    >
                      {t('booking.permanentDelete.continue')}
                    </button>
                  </div>
                </>
              )}

              {/* Step 2: Name confirmation (or has_bookings error) */}
              {deleteProfileStep === 2 && (
                <>
                  {deleteProfileHasBookings ? (
                    <>
                      <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <p className="text-sm text-destructive">
                          {t('booking.permanentDelete.hasBookings').replace('{count}', String(deleteProfileBookingCount))}
                        </p>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={closeDeleteProfileModal}
                          className="flex-1 py-2 px-4 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          onClick={() => { closeDeleteProfileModal(); openDeactivateProfileModal(); }}
                          className="flex-1 py-2 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                          {t('booking.permanentDelete.offerDeactivate')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">{t('booking.permanentDelete.step2Desc')}</p>
                      <p className="text-sm font-medium text-foreground">&ldquo;{bizName}&rdquo;</p>
                      <input
                        type="text"
                        value={deleteProfileConfirmName}
                        onChange={e => setDeleteProfileConfirmName(e.target.value)}
                        placeholder={bizName}
                        className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-destructive"
                        autoComplete="off"
                      />
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => { setDeleteProfileStep(1); setDeleteProfileConfirmName(''); }}
                          disabled={deleteProfileLoading}
                          className="flex-1 py-2 px-4 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                        >
                          {t('common.back')}
                        </button>
                        <button
                          onClick={handlePermanentDeleteProfile}
                          disabled={deleteProfileLoading || deleteProfileConfirmName !== bizName}
                          className="flex-1 py-2 px-4 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {deleteProfileLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          {deleteProfileLoading ? t('booking.permanentDelete.deleting') : t('booking.permanentDelete.confirm')}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

            </div>
          </div>
        </>
      )}
    </ProtectedRoute>
  );
}
