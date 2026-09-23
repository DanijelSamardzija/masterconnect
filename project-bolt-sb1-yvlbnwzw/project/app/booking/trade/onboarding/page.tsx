'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { TradeServicesTab } from '@/components/setup/TradeServicesTab';
import { TimePicker24h } from '@/components/ui/time-picker-24h';
import { CityAutocomplete } from '@/components/city-autocomplete';
import { countries } from '@/lib/countries';
import { compressImage } from '@/lib/utils/compress-image';
import { toast } from 'sonner';
import {
  Check,
  ChevronLeft,
  Loader2,
  X,
  Camera,
  Hammer,
  Building2,
  Users,
  Briefcase,
  Phone,
  Zap,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

type BusinessSubtype = 'solo' | 'company' | 'cooperative' | 'freelancer';

type DayHour = {
  day: number;
  open: boolean;
  from: string;
  to: string;
  open2: boolean;
  from2: string;
  to2: string;
};

type StaffResult = {
  id: string;
  name: string;
  avatar_url: string | null;
  city: string | null;
};

const STEP_KEYS = [
  'biztype',
  'profile',
  'contacts',
  'services',
  'location',
  'hours',
  'staff',
  'emergency',
  'done',
] as const;
type StepKey = (typeof STEP_KEYS)[number];

const STEP_COUNT = STEP_KEYS.length;

const DEFAULT_HOURS: DayHour[] = [
  { day: 1, open: true,  from: '07:00', to: '17:00', open2: false, from2: '12:00', to2: '13:00' },
  { day: 2, open: true,  from: '07:00', to: '17:00', open2: false, from2: '12:00', to2: '13:00' },
  { day: 3, open: true,  from: '07:00', to: '17:00', open2: false, from2: '12:00', to2: '13:00' },
  { day: 4, open: true,  from: '07:00', to: '17:00', open2: false, from2: '12:00', to2: '13:00' },
  { day: 5, open: true,  from: '07:00', to: '17:00', open2: false, from2: '12:00', to2: '13:00' },
  { day: 6, open: true,  from: '08:00', to: '14:00', open2: false, from2: '12:00', to2: '13:00' },
  { day: 0, open: false, from: '08:00', to: '14:00', open2: false, from2: '12:00', to2: '13:00' },
];

const TIMEZONE_OPTIONS = [
  { value: 'Europe/Sarajevo',     label: 'Sarajevo (Europe/Sarajevo)' },
  { value: 'Europe/Belgrade',     label: 'Beograd (Europe/Belgrade)' },
  { value: 'Europe/Zagreb',       label: 'Zagreb (Europe/Zagreb)' },
  { value: 'Europe/Ljubljana',    label: 'Ljubljana (Europe/Ljubljana)' },
  { value: 'Europe/Skopje',       label: 'Skoplje (Europe/Skopje)' },
  { value: 'Europe/Podgorica',    label: 'Podgorica (Europe/Podgorica)' },
  { value: 'Europe/Vienna',       label: 'Beč (Europe/Vienna)' },
  { value: 'Europe/Berlin',       label: 'Berlin (Europe/Berlin)' },
  { value: 'Europe/Zurich',       label: 'Cirih (Europe/Zurich)' },
  { value: 'Europe/Paris',        label: 'Pariz (Europe/Paris)' },
  { value: 'Europe/Rome',         label: 'Rim (Europe/Rome)' },
  { value: 'Europe/Madrid',       label: 'Madrid (Europe/Madrid)' },
  { value: 'Europe/London',       label: 'London (Europe/London)' },
  { value: 'Europe/Istanbul',     label: 'Istanbul (Europe/Istanbul)' },
  { value: 'Asia/Dubai',          label: 'Dubai (Asia/Dubai)' },
  { value: 'America/New_York',    label: 'New York (America/New_York)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (America/Los_Angeles)' },
];

const SUBTYPE_ICONS: Record<BusinessSubtype, React.ReactNode> = {
  solo:        <Hammer    className="w-5 h-5" />,
  company:     <Building2 className="w-5 h-5" />,
  cooperative: <Users     className="w-5 h-5" />,
  freelancer:  <Briefcase className="w-5 h-5" />,
};

// Default tradespeople worker permissions — purchase_price and financials off by default.
const DEFAULT_WORKER_PERMISSIONS = {
  can_create_manual_jobs:    true,
  can_view_client_records:   true,
  can_edit_client_records:   false,
  can_create_job_reports:    true,
  can_add_materials:         true,
  can_view_financials:       false,
  can_view_purchase_prices:  false,
  can_handle_emergency:      false,
  can_accept_emergency:      false,
};

function getBrowserTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Sarajevo'; }
  catch { return 'Europe/Sarajevo'; }
}

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

// ── Component ──────────────────────────────────────────────────────────────

export default function TradeOnboardingPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { reloadWithPreferred } = useBookingProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = searchParams.get('profileId');

  const resolvedProfileId = profileId ?? user?.id ?? '';

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Step 0 — Business subtype
  const [bizSubtype, setBizSubtype] = useState<BusinessSubtype>('company');

  // Step 1 — Profile
  const [bizName, setBizName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Step 2 — Contacts
  const [contactPhone, setContactPhone] = useState('');
  const [contactPhone2, setContactPhone2] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Step 4 — Location
  const [locId, setLocId] = useState<string | null>(null);
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locCity, setLocCity] = useState('');
  const [locCountry, setLocCountry] = useState('');
  const [locTimezone, setLocTimezone] = useState(getBrowserTimezone());

  // Step 5 — Hours
  const [dayHours, setDayHours] = useState<DayHour[]>(DEFAULT_HOURS);

  // Step 6 — Staff
  const [staffSearch, setStaffSearch] = useState('');
  const [staffResults, setStaffResults] = useState<StaffResult[]>([]);
  const [staffSearching, setStaffSearching] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffResult | null>(null);
  const [staffAdded, setStaffAdded] = useState(false);

  // Step 7 — Emergency
  const [emergencyEnabled, setEmergencyEnabled] = useState(false);

  // ── Staff search ────────────────────────────────────────────────────────

  useEffect(() => {
    if (staffSearch.length < 2) { setStaffResults([]); return; }
    const timer = setTimeout(async () => {
      setStaffSearching(true);
      const { data } = await (supabase as any).rpc('search_profiles', {
        p_search: staffSearch,
        p_limit: 6,
      });
      setStaffSearching(false);
      if (Array.isArray(data)) {
        setStaffResults((data as any[]).filter((u) => u.id !== user?.id));
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [staffSearch, user?.id]);

  // ── Load existing data ──────────────────────────────────────────────────

  const loadExisting = useCallback(async () => {
    if (!user || !resolvedProfileId) { setLoading(false); return; }
    setLoading(true);

    const { data: bp } = await (supabase as any)
      .from('booking_profiles')
      .select('name, avatar_url, business_subtype, contact_channels, emergency_enabled')
      .eq('id', resolvedProfileId)
      .maybeSingle();

    if (bp) {
      if (bp.name)              setBizName(bp.name);
      if (bp.avatar_url)        setAvatarUrl(bp.avatar_url);
      if (bp.business_subtype)  setBizSubtype(bp.business_subtype as BusinessSubtype);
      if (bp.emergency_enabled) setEmergencyEnabled(true);
      const ch = bp.contact_channels ?? {};
      if (ch.phone)  setContactPhone(ch.phone);
      if (ch.phone2) setContactPhone2(ch.phone2);
      if (ch.email)  setContactEmail(ch.email);
    }

    const { data: locs } = await (supabase as any)
      .from('business_locations')
      .select('id, name, address, city, country, timezone')
      .eq('business_id', resolvedProfileId)
      .eq('is_active', true)
      .order('is_primary', { ascending: false })
      .limit(1);
    const loc = locs?.[0];
    if (loc) {
      setLocId(loc.id);
      setLocName(loc.name);
      setLocAddress(loc.address ?? '');
      setLocCity(loc.city ?? '');
      setLocCountry(loc.country ?? '');
      setLocTimezone(loc.timezone || getBrowserTimezone());

      const { data: hoursData } = await (supabase as any).rpc('get_opening_hours', {
        p_location_id: loc.id,
      });
      if (Array.isArray(hoursData) && hoursData.length > 0) {
        type HRow = { day_of_week: number; start_time: string; end_time: string; is_closed: boolean; sort_order: number };
        const rows = hoursData as HRow[];
        const primary   = rows.filter((r) => r.sort_order === 0);
        const secondary = rows.filter((r) => r.sort_order === 1);
        setDayHours(DEFAULT_HOURS.map((dh) => {
          const p = primary.find((r) => r.day_of_week === dh.day);
          const s = secondary.find((r) => r.day_of_week === dh.day);
          return {
            ...dh,
            ...(p ? { open: !p.is_closed, from: p.start_time, to: p.end_time } : {}),
            ...(s ? { open2: true, from2: s.start_time, to2: s.end_time } : {}),
          };
        }));
      }
    }

    setLoading(false);
  }, [user, resolvedProfileId]);

  useEffect(() => { loadExisting(); }, [loadExisting]);

  // Auto-fill location name from business name when entering the location step
  useEffect(() => {
    if (currentKey === 'location' && !locName && bizName) {
      setLocName(bizName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Navigation ──────────────────────────────────────────────────────────

  const currentKey: StepKey = STEP_KEYS[step];
  function advance() { setStep((s) => Math.min(s + 1, STEP_COUNT - 1)); }
  function back()    { setStep((s) => Math.max(s - 1, 0)); }

  // ── Save handlers ───────────────────────────────────────────────────────

  async function saveBiztypeAndProfile() {
    if (!bizName.trim()) { toast.error(t('setup.error.nameRequired')); return; }
    setSaving(true);
    const channels: Record<string, string> = {};
    if (contactPhone.trim())  channels.phone  = contactPhone.trim();
    if (contactPhone2.trim()) channels.phone2 = contactPhone2.trim();
    if (contactEmail.trim())  channels.email  = contactEmail.trim();

    const { data } = await (supabase as any).rpc('upsert_trade_profile', {
      p_name:               bizName.trim(),
      p_business_subtype:   bizSubtype,
      p_timezone:           locTimezone || 'Europe/Sarajevo',
      p_contact_channels:   channels,
      p_emergency_enabled:  emergencyEnabled,
      ...(profileId ? { p_booking_profile_id: profileId } : {}),
    });
    setSaving(false);
    if (!(data as any)?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    if ((data as any)?.location_id && !locId) setLocId((data as any).location_id);
    advance();
  }

  async function saveContacts() {
    setSaving(true);
    const channels: Record<string, string> = {};
    if (contactPhone.trim())  channels.phone  = contactPhone.trim();
    if (contactPhone2.trim()) channels.phone2 = contactPhone2.trim();
    if (contactEmail.trim())  channels.email  = contactEmail.trim();

    await (supabase as any)
      .from('booking_profiles')
      .update({ contact_channels: channels })
      .eq('id', resolvedProfileId);
    setSaving(false);
    advance();
  }

  async function saveLocation() {
    if (!locName.trim() || !locCity.trim() || !locCountry.trim()) {
      toast.error(t('setup.error.nameRequired'));
      return;
    }
    setSaving(true);
    if (locId) {
      const { data } = await (supabase as any).rpc('update_location', {
        p_location_id: locId, p_name: locName.trim(),
        p_address: locAddress.trim() || null, p_city: locCity.trim(),
        p_country: locCountry.trim(),
        p_timezone: locTimezone || 'Europe/Sarajevo',
        p_phone: contactPhone.trim() || null,
      });
      if (!(data as any)?.ok) { toast.error(t('setup.error.saveFailed')); setSaving(false); return; }
    } else {
      const { data } = await (supabase as any).rpc('create_location', {
        p_business_id: resolvedProfileId, p_name: locName.trim(),
        p_address: locAddress.trim() || null, p_city: locCity.trim(),
        p_country: locCountry.trim(),
        p_timezone: locTimezone || 'Europe/Sarajevo',
        p_phone: contactPhone.trim() || null,
        p_is_primary: true,
      });
      if (!(data as any)?.ok) { toast.error(t('setup.error.saveFailed')); setSaving(false); return; }
      const { data: row } = await (supabase as any)
        .from('business_locations').select('id')
        .eq('business_id', resolvedProfileId).order('created_at', { ascending: false }).limit(1).single();
      if (row?.id) setLocId(row.id);
    }
    setSaving(false);
    advance();
  }

  async function saveHours() {
    if (!locId) { toast.error(t('setup.error.saveFailed')); return; }
    setSaving(true);
    for (const dh of dayHours) {
      const { data: r1 } = await (supabase as any).rpc('upsert_opening_hours', {
        p_location_id: locId, p_day_of_week: dh.day,
        p_open_time: dh.from, p_close_time: dh.to,
        p_is_closed: !dh.open, p_sort_order: 0,
      });
      if (!(r1 as any)?.ok) { toast.error(t('setup.error.saveFailed')); setSaving(false); return; }
      if (dh.open && dh.open2) {
        await (supabase as any).rpc('upsert_opening_hours', {
          p_location_id: locId, p_day_of_week: dh.day,
          p_open_time: dh.from2, p_close_time: dh.to2,
          p_is_closed: false, p_sort_order: 1,
        });
      } else {
        await (supabase as any).rpc('delete_opening_hour_period', {
          p_location_id: locId, p_day_of_week: dh.day, p_sort_order: 1,
        });
      }
    }
    setSaving(false);
    advance();
  }

  async function saveStaff() {
    if (!selectedStaff || staffAdded) { advance(); return; }
    setSaving(true);
    const { data } = await (supabase as any).rpc('add_staff_direct', {
      p_user_id: selectedStaff.id,
      p_role: 'worker',
      p_location_id: locId,
      ...(profileId ? { p_business_id: profileId } : {}),
    });
    if (!(data as any)?.ok) { toast.error(t('setup.error.saveFailed')); setSaving(false); return; }
    // Set default tradespeople permissions for the new worker
    if ((data as any)?.staff_id || (data as any)?.ok) {
      await (supabase as any)
        .from('staff_members')
        .update({ permissions: DEFAULT_WORKER_PERMISSIONS })
        .eq('business_id', resolvedProfileId)
        .eq('user_id', selectedStaff.id);
    }
    setSaving(false);
    setStaffAdded(true);
    advance();
  }

  async function saveEmergency() {
    setSaving(true);
    await (supabase as any)
      .from('booking_profiles')
      .update({ emergency_enabled: emergencyEnabled })
      .eq('id', resolvedProfileId);
    setSaving(false);
    advance();
  }

  async function finishOnboarding() {
    setSaving(true);
    await (supabase as any)
      .from('booking_profiles')
      .update({ onboarding_done: true })
      .eq('id', resolvedProfileId);
    await reloadWithPreferred(resolvedProfileId);
    setSaving(false);
    router.push(`/booking/trade/${resolvedProfileId}`);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !resolvedProfileId || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(t('bookingSetup.profile.logoMax')); return; }
    setUploadingAvatar(true);
    try {
      const compressed = await compressImage(file, 400);
      const fileName = `${user.id}/booking-profiles/${resolvedProfileId}/${Date.now()}.jpg`;
      if (avatarUrl) {
        const oldPath = avatarUrl.split('/avatars/')[1];
        if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
      }
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressed, { upsert: true, contentType: 'image/jpeg' });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await (supabase as any)
        .from('booking_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', resolvedProfileId);
      setAvatarUrl(publicUrl);
    } catch {
      toast.error(t('setup.error.saveFailed'));
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  }

  function handleStepSave() {
    if (currentKey === 'biztype')   saveBiztypeAndProfile();
    if (currentKey === 'profile')   saveBiztypeAndProfile();
    if (currentKey === 'contacts')  saveContacts();
    if (currentKey === 'services')  advance();
    if (currentKey === 'location')  saveLocation();
    if (currentKey === 'hours')     saveHours();
    if (currentKey === 'staff')     saveStaff();
    if (currentKey === 'emergency') saveEmergency();
  }

  function toggleDay(day: number) {
    setDayHours((prev) => prev.map((dh) =>
      dh.day === day ? { ...dh, open: !dh.open, open2: !dh.open ? dh.open2 : false } : dh
    ));
  }

  function toggleSecondPeriod(day: number) {
    setDayHours((prev) => prev.map((dh) => {
      if (dh.day !== day) return dh;
      if (dh.open2) return { ...dh, open2: false, to: dh.to2 };
      return { ...dh, open2: true, to2: dh.to, to: '12:00', from2: '13:00' };
    }));
  }

  function updateDayTime(day: number, field: 'from' | 'to', value: string) {
    setDayHours((prev) => prev.map((dh) => dh.day === day ? { ...dh, [field]: value } : dh));
  }

  function updateDayTime2(day: number, field: 'from2' | 'to2', value: string) {
    setDayHours((prev) => prev.map((dh) => dh.day === day ? { ...dh, [field]: value } : dh));
  }

  // ── Styles ──────────────────────────────────────────────────────────────

  const inputCls  = 'w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30';
  const selectCls = 'w-full border border-border rounded-xl px-3 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30';
  const timeCls   = 'border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-[88px]';

  // ── Loading ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </ProtectedRoute>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto px-4 py-8">

          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight">{t('trade.onboarding.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('trade.onboarding.step')} {step + 1} {t('trade.onboarding.step.of')} {STEP_COUNT}
            </p>
          </div>

          {/* Progress bar */}
          <div className="relative h-1.5 bg-muted rounded-full mb-8 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-500"
              style={{ width: `${((step + 1) / STEP_COUNT) * 100}%` }}
            />
          </div>

          {/* ── Step card ─────────────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">

            {/* Step 0: Business type */}
            {currentKey === 'biztype' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold">{t('trade.onboarding.biztype.heading')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('trade.onboarding.biztype.desc')}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(['solo', 'company', 'cooperative', 'freelancer'] as BusinessSubtype[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setBizSubtype(type)}
                      className={`flex flex-col items-start gap-2 p-4 rounded-2xl border-2 transition-colors text-left ${
                        bizSubtype === type
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <span className={`p-2 rounded-xl ${bizSubtype === type ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        {SUBTYPE_ICONS[type]}
                      </span>
                      <div>
                        <p className={`text-sm font-semibold ${bizSubtype === type ? 'text-primary' : 'text-foreground'}`}>
                          {t(`trade.onboarding.biztype.${type}` as Parameters<typeof t>[0])}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t(`trade.onboarding.biztype.${type}.desc` as Parameters<typeof t>[0])}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 1: Profile */}
            {currentKey === 'profile' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold">{t('trade.onboarding.profile.heading')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('trade.onboarding.profile.desc')}</p>
                </div>

                {/* Logo upload */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">{t('bookingSetup.profile.logo')}</label>
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 rounded-2xl border-2 border-dashed border-border bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl} alt="logo" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-7 h-7 text-muted-foreground/50" />
                      )}
                      {uploadingAvatar && (
                        <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="text-sm font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                      >
                        {uploadingAvatar
                          ? t('bookingSetup.profile.logoUploading')
                          : avatarUrl
                            ? t('bookingSetup.profile.logoChange')
                            : t('bookingSetup.profile.logoUpload')}
                      </button>
                      <p className="text-xs text-muted-foreground">{t('bookingSetup.profile.logoMax')}</p>
                    </div>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">{t('setup.profile.name')} *</label>
                  <input
                    type="text"
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    placeholder={t('setup.profile.namePlaceholder')}
                    className={inputCls}
                  />
                  <p className="text-xs text-muted-foreground">{t('setup.profile.nameHelp')}</p>
                </div>
              </div>
            )}

            {/* Step 2: Contacts */}
            {currentKey === 'contacts' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold">{t('trade.onboarding.contacts.heading')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('trade.onboarding.contacts.desc')}</p>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">{t('trade.onboarding.contacts.phone')}</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="+387 61 000 000" className={`${inputCls} pl-9`} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">{t('trade.onboarding.contacts.phone2')}</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input type="tel" value={contactPhone2} onChange={(e) => setContactPhone2(e.target.value)}
                        placeholder="+387 33 000 000" className={`${inputCls} pl-9`} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">{t('trade.onboarding.contacts.email')}</label>
                    <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="firma@example.com" className={inputCls} />
                  </div>
                  <p className="text-xs text-muted-foreground">{t('trade.onboarding.contacts.hint')}</p>
                </div>
              </div>
            )}

            {/* Step 3: Services — reuse TradeServicesTab */}
            {currentKey === 'services' && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{t('trade.onboarding.services.heading')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('trade.onboarding.services.desc')}</p>
                </div>
                {resolvedProfileId && (
                  <TradeServicesTab businessId={resolvedProfileId} hideTitle />
                )}
              </div>
            )}

            {/* Step 4: Location */}
            {currentKey === 'location' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold">{t('trade.onboarding.location.heading')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('trade.onboarding.location.desc')}</p>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">{t('setup.locations.name')} *</label>
                    <input type="text" value={locName} onChange={(e) => setLocName(e.target.value)}
                      placeholder="npr. Radionica Centar" className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">{t('setup.locations.address')}</label>
                    <input type="text" value={locAddress} onChange={(e) => setLocAddress(e.target.value)}
                      placeholder="npr. Titova 15" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium">{t('setup.locations.city')} *</label>
                      <CityAutocomplete
                        value={locCity}
                        onChange={(city, placeData) => {
                          setLocCity(city);
                          if (placeData?.country) {
                            const matched = matchCountryValue(placeData.country);
                            if (matched) setLocCountry(matched);
                          }
                        }}
                        placeholder="npr. Sarajevo"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium">{t('setup.locations.country')}</label>
                      <select value={locCountry} onChange={(e) => setLocCountry(e.target.value)} className={inputCls}>
                        <option value=""></option>
                        {countries.map((c) => (
                          <option key={c.value} value={c.value}>
                            {language === 'sr' ? c.sr : language === 'de' ? c.de : c.en}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">{t('setup.locations.timezone')}</label>
                    <div className="rounded-xl overflow-hidden border border-border focus-within:ring-2 focus-within:ring-primary">
                      <select value={locTimezone} onChange={(e) => setLocTimezone(e.target.value)}
                        className="w-full px-3 py-3 text-sm bg-background focus:outline-none">
                        {TIMEZONE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Hours */}
            {currentKey === 'hours' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold">{t('trade.onboarding.hours.heading')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('trade.onboarding.hours.desc')}</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  {dayHours.map((dh) => (
                    <div
                      key={dh.day}
                      className={`flex gap-3 py-2.5 border-b border-border/40 last:border-0 ${dh.open && dh.open2 ? 'items-start' : 'items-center'}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleDay(dh.day)}
                        className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                          dh.open ? 'bg-primary border-primary' : 'border-border bg-background'
                        }`}
                      >
                        {dh.open && <Check className="w-3 h-3 text-primary-foreground" />}
                      </button>
                      <span className="text-sm w-24 shrink-0 mt-0.5">
                        {t(`setup.hours.day.${dh.day}` as Parameters<typeof t>[0])}
                      </span>
                      {dh.open ? (
                        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <TimePicker24h
                              value={dh.from}
                              onChange={(v) => updateDayTime(dh.day, 'from', v)}
                              className={timeCls}
                            />
                            <span className="text-xs text-muted-foreground">–</span>
                            <TimePicker24h
                              value={dh.open2 ? dh.to2 : dh.to}
                              onChange={(v) => dh.open2
                                ? updateDayTime2(dh.day, 'to2', v)
                                : updateDayTime(dh.day, 'to', v)
                              }
                              className={timeCls}
                            />
                            {!dh.open2 && (
                              <button
                                type="button"
                                onClick={() => toggleSecondPeriod(dh.day)}
                                className="text-[11px] font-medium text-primary/70 hover:text-primary transition-colors px-1.5 py-0.5 rounded border border-primary/20 hover:border-primary/50"
                              >
                                + {t('bookingSetup.hours.addSecondPeriod')}
                              </button>
                            )}
                          </div>
                          {dh.open2 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] text-muted-foreground w-12 shrink-0">{t('bookingSetup.hours.break')}</span>
                              <TimePicker24h value={dh.to} onChange={(v) => updateDayTime(dh.day, 'to', v)} className={timeCls} />
                              <span className="text-xs text-muted-foreground">–</span>
                              <TimePicker24h value={dh.from2} onChange={(v) => updateDayTime2(dh.day, 'from2', v)} className={timeCls} />
                              <button
                                type="button"
                                onClick={() => toggleSecondPeriod(dh.day)}
                                className="text-[11px] font-medium text-destructive/60 hover:text-destructive transition-colors flex items-center gap-0.5"
                              >
                                <X className="w-3 h-3" />
                                {t('bookingSetup.hours.removeSecondPeriod')}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground flex-1">{t('setup.hours.closed')}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 6: Staff */}
            {currentKey === 'staff' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold">{t('trade.onboarding.staff.heading')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('trade.onboarding.staff.desc')}</p>
                </div>
                <div className="flex flex-col gap-4">
                  {selectedStaff ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-primary/30 bg-primary/5">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden text-sm font-bold text-primary">
                        {selectedStaff.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={selectedStaff.avatar_url} alt={selectedStaff.name} className="w-full h-full object-cover" />
                        ) : (
                          selectedStaff.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{selectedStaff.name}</p>
                        {selectedStaff.city && <p className="text-xs text-muted-foreground">{selectedStaff.city}</p>}
                      </div>
                      {staffAdded ? (
                        <span className="text-xs font-medium text-green-600 dark:text-green-400 shrink-0">
                          {t('bookingSetup.staff.search.added')}
                        </span>
                      ) : (
                        <button
                          onClick={() => { setSelectedStaff(null); setStaffAdded(false); }}
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={staffSearch}
                          onChange={(e) => setStaffSearch(e.target.value)}
                          placeholder={t('bookingSetup.staff.search.placeholder')}
                          className={inputCls}
                        />
                        {staffSearching && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      {staffResults.length > 0 && (
                        <div className="border border-border rounded-xl overflow-hidden">
                          {staffResults.map((u, i) => (
                            <button
                              key={u.id}
                              onClick={() => { setSelectedStaff(u); setStaffResults([]); setStaffSearch(''); }}
                              className={`flex items-center gap-3 p-3 hover:bg-muted/60 w-full text-left transition-colors ${i < staffResults.length - 1 ? 'border-b border-border/50' : ''}`}
                            >
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden text-xs font-bold">
                                {u.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
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
                      {staffSearch.length >= 2 && staffResults.length === 0 && !staffSearching && (
                        <p className="text-xs text-muted-foreground">{t('bookingSetup.staff.search.noResults')}</p>
                      )}
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {t('bookingSetup.staff.search.mustHaveAccount')}
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t('bookingSetup.staff.skipHint')}</p>
              </div>
            )}

            {/* Step 7: Emergency */}
            {currentKey === 'emergency' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold">{t('trade.onboarding.emergency.heading')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('trade.onboarding.emergency.desc')}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setEmergencyEnabled((v) => !v)}
                  className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-colors text-left w-full ${
                    emergencyEnabled
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <span className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${emergencyEnabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    <Zap className="w-5 h-5" />
                  </span>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${emergencyEnabled ? 'text-primary' : 'text-foreground'}`}>
                      {t('trade.onboarding.emergency.enable')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {emergencyEnabled
                        ? t('trade.onboarding.emergency.enableDesc')
                        : t('trade.onboarding.emergency.disabled')}
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    emergencyEnabled ? 'border-primary bg-primary' : 'border-border'
                  }`}>
                    {emergencyEnabled && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                </button>
              </div>
            )}

            {/* Step 8: Done */}
            {currentKey === 'done' && (
              <div className="flex flex-col gap-5">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h2 className="text-xl font-bold text-green-700 dark:text-green-400">
                    {t('trade.onboarding.done.heading')}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('trade.onboarding.done.desc')}
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={finishOnboarding}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 text-sm font-medium bg-primary text-primary-foreground rounded-xl py-3 hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {t('trade.onboarding.done.dashboard')}
                  </button>
                  <button
                    onClick={() => router.push('/booking/requests')}
                    className="w-full text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl py-3 transition-colors"
                  >
                    {t('trade.onboarding.done.requests')}
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* ── Navigation ──────────────────────────────────────────────── */}
          {currentKey !== 'done' && (
            <div className="flex items-center gap-3 mt-6">
              {step > 0 && (
                <button
                  onClick={back}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors py-2 px-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t('trade.onboarding.back')}
                </button>
              )}
              <div className="flex-1" />
              {(currentKey === 'services' || currentKey === 'staff') && (
                <button
                  onClick={advance}
                  disabled={saving}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2"
                >
                  {t('trade.onboarding.skip')}
                </button>
              )}
              <button
                onClick={handleStepSave}
                disabled={saving}
                className="px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : currentKey === 'emergency'
                    ? t('trade.onboarding.finish')
                    : t('trade.onboarding.save')}
              </button>
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  );
}
