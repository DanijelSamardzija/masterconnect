'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { useBookingAccess } from '@/lib/hooks/use-booking-access';
import { BookingBetaBanner } from '@/components/booking-beta-banner';
import { toast } from 'sonner';
import { ChevronRight, Plus, Pencil, X, CheckCircle2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Tab = 'profile' | 'services' | 'hours' | 'locations' | 'rules';

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number | null;
  price_type: string;
  capacity: number;
  booking_type: string;
  is_active: boolean;
};

type HourRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
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
  slot_interval_min: number;
};

type PostListing = {
  id: string;
  job_title: string | null;
  booking_enabled: boolean;
};

const BOOKING_TYPES = [
  'appointment_service',
  'restaurant',
  'accommodation',
  'event',
  'order',
  'tradespeople',
] as const;

const PRICE_TYPES = ['fixed', 'from', 'negotiable', 'free'] as const;

const DEFAULT_HOURS: HourRow[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  start_time: '09:00',
  end_time: '17:00',
  is_closed: i === 0 || i === 6, // Sunday + Saturday closed by default
}));

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
  const { t } = useLanguage();
  const router = useRouter();
  const { hasAccess, loading: authLoading } = useBookingAccess();

  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // ── Profile state ──────────────────────────────────────────────────────────
  const [bizName, setBizName] = useState('');
  const [timezone, setTimezone] = useState('Europe/Sarajevo');
  const [isBusinessActive, setIsBusinessActive] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);

  // ── Services state ─────────────────────────────────────────────────────────
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [showSvcForm, setShowSvcForm] = useState(false);
  const [editingSvc, setEditingSvc] = useState<ServiceRow | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcDuration, setSvcDuration] = useState('60');
  const [svcPrice, setSvcPrice] = useState('');
  const [svcPriceType, setSvcPriceType] = useState<string>('fixed');
  const [svcCapacity, setSvcCapacity] = useState('1');
  const [svcBookingType, setSvcBookingType] = useState<string>('appointment_service');
  const [svcSaving, setSvcSaving] = useState(false);

  // ── Booking Rules state ────────────────────────────────────────────────────
  const [rules, setRules] = useState<BookingRules>({
    confirmation_mode: 'instant',
    min_notice_minutes: 60,
    max_advance_days: 60,
    cancellation_hours: 24,
    slot_interval_min: 15,
  });
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);

  // ── Post listings state (F11B) ─────────────────────────────────────────────
  const [postListings, setPostListings] = useState<PostListing[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [togglingPost, setTogglingPost] = useState<string | null>(null);

  // ── Hours state ────────────────────────────────────────────────────────────
  const [primaryLocId, setPrimaryLocId] = useState<string | null>(null);
  const [hours, setHours] = useState<HourRow[]>(DEFAULT_HOURS);
  const [hoursLoading, setHoursLoading] = useState(false);
  const [hoursSaving, setHoursSaving] = useState(false);

  // ── Locations state ────────────────────────────────────────────────────────
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locsLoading, setLocsLoading] = useState(false);
  const [showLocForm, setShowLocForm] = useState(false);
  const [editingLoc, setEditingLoc] = useState<LocationRow | null>(null);
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locCity, setLocCity] = useState('');
  const [locCountry, setLocCountry] = useState('');
  const [locTimezone, setLocTimezone] = useState('Europe/Sarajevo');
  const [locPhone, setLocPhone] = useState('');
  const [locSaving, setLocSaving] = useState(false);

  // ── Load profile on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      setProfileLoading(true);
      const [profileRes, locRes] = await Promise.all([
        supabase.from('profiles').select('name, is_business').eq('id', user.id).single(),
        supabase.from('business_locations').select('timezone').eq('business_id', user.id).eq('is_primary', true).maybeSingle(),
      ]);
      if (profileRes.data) {
        setBizName(profileRes.data.name ?? '');
        setIsBusinessActive(profileRes.data.is_business ?? false);
      }
      // Load saved timezone from primary location; fall back to browser timezone for new users
      setTimezone(locRes.data?.timezone ?? getBrowserTimezone());
      setProfileLoading(false);
    })();
  }, [user]);

  // ── Load services ──────────────────────────────────────────────────────────
  const loadServices = useCallback(async () => {
    if (!user) return;
    setServicesLoading(true);
    const { data } = await supabase
      .from('service_catalog')
      .select('id, name, description, duration_minutes, price, price_type, capacity, booking_type, is_active')
      .eq('business_id', user.id)
      .order('created_at', { ascending: true });
    setServices((data as ServiceRow[]) ?? []);
    setServicesLoading(false);
  }, [user]);

  // ── Load locations + primary location id ──────────────────────────────────
  const loadLocations = useCallback(async () => {
    if (!user) return;
    setLocsLoading(true);
    const { data } = await supabase
      .from('business_locations')
      .select('id, name, address, city, country, timezone, phone, is_primary, is_active')
      .eq('business_id', user.id)
      .order('created_at', { ascending: true });
    const rows = (data as LocationRow[]) ?? [];
    setLocations(rows);
    const primary = rows.find((l) => l.is_primary && l.is_active);
    if (primary) setPrimaryLocId(primary.id);
    setLocsLoading(false);
  }, [user]);

  // ── Load opening hours ─────────────────────────────────────────────────────
  const loadHours = useCallback(async (locId: string) => {
    setHoursLoading(true);
    const { data, error } = await (supabase as any).rpc('get_opening_hours', {
      p_location_id: locId,
    });
    if (!error && Array.isArray(data)) {
      setHours(data as HourRow[]);
    }
    setHoursLoading(false);
  }, []);

  const loadRules = useCallback(async () => {
    if (!user) return;
    setRulesLoading(true);
    const { data } = await (supabase as any).rpc('get_booking_rules', { p_business_id: user.id });
    if (data) setRules(data as BookingRules);
    setRulesLoading(false);
  }, [user]);

  const loadPostListings = useCallback(async () => {
    if (!user) return;
    setPostsLoading(true);
    const { data } = await supabase
      .from('posts')
      .select('id, job_title, booking_enabled')
      .eq('user_id', user.id)
      .eq('post_type', 'service_listing')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setPostListings((data as PostListing[]) ?? []);
    setPostsLoading(false);
  }, [user]);

  // ── Tab switch loaders ─────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'services') { loadServices(); loadPostListings(); }
    if (activeTab === 'locations') loadLocations();
    if (activeTab === 'rules') loadRules();
    if (activeTab === 'hours') {
      loadLocations().then(async () => {
        // After locations loaded, primary will be set; we use a short poll workaround
        // by fetching directly since state may not have updated yet
        if (!user) return;
        const { data: locData } = await supabase
          .from('business_locations')
          .select('id')
          .eq('business_id', user.id)
          .eq('is_primary', true)
          .eq('is_active', true)
          .single();
        if (locData?.id) {
          setPrimaryLocId(locData.id);
          loadHours(locData.id);
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Profile save ───────────────────────────────────────────────────────────
  async function handleSaveProfile() {
    if (!user) return;
    if (!bizName.trim()) {
      toast.error(t('setup.error.nameRequired'));
      return;
    }
    setProfileSaving(true);
    const { data, error } = await (supabase as any).rpc('upsert_my_business_profile', {
      p_name: bizName.trim(),
      p_timezone: timezone.trim() || 'Europe/Sarajevo',
    });
    setProfileSaving(false);
    const result = data as { ok: boolean; error?: string; location_id?: string } | null;
    if (error || !result?.ok) {
      toast.error(t('setup.error.saveFailed'));
      return;
    }
    setIsBusinessActive(true);
    if (result.location_id) setPrimaryLocId(result.location_id);
    toast.success(t('setup.profile.saved'));
  }

  // ── Service form helpers ───────────────────────────────────────────────────
  function openAddSvc() {
    setEditingSvc(null);
    setSvcName(''); setSvcDesc(''); setSvcDuration('60');
    setSvcPrice(''); setSvcPriceType('fixed'); setSvcCapacity('1');
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
    setSvcCapacity(String(svc.capacity));
    setSvcBookingType(svc.booking_type);
    setShowSvcForm(true);
  }

  function closeSvcForm() {
    setShowSvcForm(false);
    setEditingSvc(null);
  }

  async function handleSaveSvc() {
    if (!user) return;
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
      });
      const result = data as { ok: boolean } | null;
      if (!result?.ok) { toast.error(t('setup.error.saveFailed')); setSvcSaving(false); return; }
    } else {
      const { data } = await (supabase as any).rpc('create_service', {
        p_business_id: user.id,
        p_name: svcName.trim(),
        p_description: svcDesc.trim() || null,
        p_duration_minutes: dur,
        p_price: price,
        p_price_type: svcPriceType,
        p_capacity: parseInt(svcCapacity, 10) || 1,
        p_booking_type: svcBookingType,
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

  // ── Booking Rules helpers ──────────────────────────────────────────────────
  async function handleSaveRules() {
    if (!user) return;
    setRulesSaving(true);
    const { data, error } = await (supabase as any).rpc('upsert_booking_rules', {
      p_confirmation_mode:  rules.confirmation_mode,
      p_min_notice_minutes: rules.min_notice_minutes,
      p_max_advance_days:   rules.max_advance_days,
      p_cancellation_hours: rules.cancellation_hours,
      p_slot_interval_min:  rules.slot_interval_min,
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
  function updateHour(day: number, field: keyof HourRow, value: string | boolean) {
    setHours((prev) =>
      prev.map((h) => (h.day_of_week === day ? { ...h, [field]: value } : h))
    );
  }

  async function handleSaveHours() {
    if (!primaryLocId) { toast.error(t('setup.error.saveFailed')); return; }
    setHoursSaving(true);
    for (const h of hours) {
      const { data } = await (supabase as any).rpc('upsert_opening_hours', {
        p_location_id: primaryLocId,
        p_day_of_week: h.day_of_week,
        p_open_time: h.start_time,
        p_close_time: h.end_time,
        p_is_closed: h.is_closed,
      });
      const result = data as { ok: boolean } | null;
      if (!result?.ok) {
        toast.error(t('setup.error.saveFailed'));
        setHoursSaving(false);
        return;
      }
    }
    setHoursSaving(false);
    toast.success(t('setup.hours.saved'));
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
    if (!user) return;
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
        p_business_id: user.id,
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
    const { data } = await (supabase as any).rpc('deactivate_location', {
      p_location_id: locId,
    });
    const result = data as { ok: boolean; error?: string } | null;
    if (!result?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    loadLocations();
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const TABS: { key: Tab; label: string }[] = [
    { key: 'profile',   label: t('setup.tab.profile') },
    { key: 'services',  label: t('setup.tab.services') },
    { key: 'hours',     label: t('setup.tab.hours') },
    { key: 'locations', label: t('setup.tab.locations') },
    { key: 'rules',     label: t('setup.tab.rules') },
  ];

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

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.push('/dashboard/business/bookings')}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <h1 className="text-xl font-semibold flex-1">{t('setup.title')}</h1>
            {isBusinessActive && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t('setup.profile.active')}
              </span>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-border mb-6 gap-0 overflow-x-auto">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
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
              <p className="text-sm text-muted-foreground">{t('setup.profile.desc')}</p>

              {profileLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
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

                  {labelInput(t('setup.profile.timezone'),
                    <TimezoneSelect
                      value={timezone}
                      onChange={setTimezone}
                      className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  )}

                  <Button
                    onClick={handleSaveProfile}
                    disabled={profileSaving}
                    className="self-start"
                  >
                    {profileSaving ? t('setup.profile.saving') : t('setup.profile.save')}
                  </Button>
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

                  {labelInput(t('setup.services.name'),
                    <>
                      <input
                        type="text"
                        value={svcName}
                        onChange={(e) => setSvcName(e.target.value)}
                        placeholder={t('setup.services.namePlaceholder')}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <p className="text-xs text-muted-foreground mt-0.5">{t('setup.services.nameHelp')}</p>
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

                  <div className="grid grid-cols-2 gap-3">
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
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={svcPrice}
                          onChange={(e) => setSvcPrice(e.target.value)}
                          className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground mt-0.5">{t('setup.services.priceHelp')}</p>
                      </>
                    )}
                  </div>

                  {!editingSvc && labelInput(t('setup.btype.label'),
                    <>
                      <select
                        value={svcBookingType}
                        onChange={(e) => setSvcBookingType(e.target.value)}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {BOOKING_TYPES.map((bt) => (
                          <option key={bt} value={bt}>{t(`setup.btype.${bt}`)}</option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('setup.btype.help')}</p>
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
                    <div key={svc.id} className={`border border-border rounded-xl p-4 flex items-start gap-3 ${!svc.is_active ? 'opacity-50' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{svc.name}</span>
                          {!svc.is_active && (
                            <span className="text-xs bg-accent text-muted-foreground px-2 py-0.5 rounded-full">
                              {t('setup.services.inactive')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {svc.duration_minutes} min
                          {svc.price !== null && ` · ${svc.price} €`}
                          {svc.price_type === 'free' && ` · ${t('setup.services.ptype.free')}`}
                          {svc.price_type === 'negotiable' && ` · ${t('setup.services.ptype.negotiable')}`}
                        </p>
                        {svc.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{svc.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => openEditSvc(svc)}
                          className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent transition-colors"
                          title={t('setup.services.edit')}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleSvc(svc)}
                          className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent transition-colors text-xs font-medium"
                          title={svc.is_active ? t('setup.services.deactivate') : t('setup.services.activate')}
                        >
                          {svc.is_active ? t('setup.services.deactivate') : t('setup.services.activate')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── F11B: Enable booking on service listings ─────────────── */}
              {isBusinessActive && (
                <div className="mt-4 pt-4 border-t border-border flex flex-col gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{t('setup.posts.heading')}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('setup.posts.desc')}</p>
                  </div>
                  {postsLoading ? (
                    <div className="flex justify-center py-4">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : postListings.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{t('setup.posts.empty')}</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {postListings.map((post) => (
                        <div key={post.id} className="flex items-center justify-between border border-border rounded-xl px-4 py-3">
                          <div className="flex-1 min-w-0 mr-3">
                            <span className="text-sm font-medium truncate block">{post.job_title || '—'}</span>
                            {post.booking_enabled && (
                              <span className="text-xs text-green-600 dark:text-green-400">{t('setup.posts.enabled')}</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleTogglePost(post)}
                            disabled={togglingPost === post.id}
                            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0 disabled:opacity-50 ${
                              post.booking_enabled
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-400'
                                : 'bg-accent text-muted-foreground hover:bg-primary/10 hover:text-primary'
                            }`}
                          >
                            {togglingPost === post.id
                              ? t('setup.posts.saving')
                              : post.booking_enabled
                                ? t('setup.posts.disable')
                                : t('setup.posts.enable')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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

              {!primaryLocId ? (
                <p className="text-sm text-muted-foreground border border-border rounded-lg p-4 bg-accent/40">
                  {t('setup.profile.inactive')}
                </p>
              ) : hoursLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex flex-col divide-y divide-border border border-border rounded-xl overflow-hidden">
                    {hours.map((h) => (
                      <div key={h.day_of_week} className="flex items-center gap-3 px-4 py-3">
                        <span className="w-24 text-sm font-medium shrink-0">
                          {t(`setup.hours.day.${h.day_of_week}`)}
                        </span>
                        <button
                          onClick={() => updateHour(h.day_of_week, 'is_closed', !h.is_closed)}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 ${
                            h.is_closed
                              ? 'bg-accent text-muted-foreground'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          }`}
                        >
                          {h.is_closed ? t('setup.hours.closed') : t('setup.hours.open')}
                        </button>
                        {!h.is_closed && (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="time"
                              value={h.start_time}
                              onChange={(e) => updateHour(h.day_of_week, 'start_time', e.target.value)}
                              className="border border-border rounded-lg px-2 py-1 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary w-28"
                            />
                            <span className="text-muted-foreground text-xs">–</span>
                            <input
                              type="time"
                              value={h.end_time}
                              onChange={(e) => updateHour(h.day_of_week, 'end_time', e.target.value)}
                              className="border border-border rounded-lg px-2 py-1 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary w-28"
                            />
                          </div>
                        )}
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
                <h2 className="font-semibold">{t('setup.locations.heading')}</h2>
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
                      <input type="text" value={locCity} onChange={(e) => setLocCity(e.target.value)}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                    )}
                    {labelInput(t('setup.locations.country'),
                      <input type="text" value={locCountry} onChange={(e) => setLocCountry(e.target.value)}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
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
                          <p className="text-xs text-muted-foreground">{loc.address}</p>
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
                        {loc.is_active && (
                          <button
                            onClick={() => handleDeactivateLoc(loc.id)}
                            className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded-lg hover:bg-destructive/10 transition-colors"
                          >
                            {t('setup.locations.deactivate')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                  {labelInput(t('setup.rules.confirmation'),
                    <select
                      value={rules.confirmation_mode}
                      onChange={(e) => setRules((r) => ({ ...r, confirmation_mode: e.target.value as 'instant' | 'requires_approval' }))}
                      className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="instant">{t('setup.rules.confirmation.instant')}</option>
                      <option value="requires_approval">{t('setup.rules.confirmation.approval')}</option>
                    </select>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {labelInput(t('setup.rules.slotInterval'),
                      <select
                        value={rules.slot_interval_min}
                        onChange={(e) => setRules((r) => ({ ...r, slot_interval_min: Number(e.target.value) }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {[10, 15, 20, 30, 45, 60, 90, 120].map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    )}
                    {labelInput(t('setup.rules.maxAdvance'),
                      <select
                        value={rules.max_advance_days}
                        onChange={(e) => setRules((r) => ({ ...r, max_advance_days: Number(e.target.value) }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {[7, 14, 21, 30, 45, 60].map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {labelInput(t('setup.rules.minNotice'),
                      <select
                        value={rules.min_notice_minutes}
                        onChange={(e) => setRules((r) => ({ ...r, min_notice_minutes: Number(e.target.value) }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {[0, 30, 60, 120, 180, 240, 480, 720, 1440].map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    )}
                    {labelInput(t('setup.rules.cancellation'),
                      <select
                        value={rules.cancellation_hours}
                        onChange={(e) => setRules((r) => ({ ...r, cancellation_hours: Number(e.target.value) }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {[0, 1, 2, 4, 8, 12, 24, 48, 72].map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    )}
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

        </div>
      </div>
    </ProtectedRoute>
  );
}
