'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink, ChevronLeft, Loader2, X, AlertTriangle } from 'lucide-react';
import { CityAutocomplete } from '@/components/city-autocomplete';

// ── Types ──────────────────────────────────────────────────────────────────

type DayHour = {
  day: number;
  open: boolean;
  from: string;
  to: string;
  open2: boolean;
  from2: string;
  to2: string;
};

type Rules = {
  confirmation_mode: 'instant' | 'requires_approval';
  min_notice_minutes: number;
  max_advance_days: number;
  cancellation_hours: number;
  slot_interval_min: number;
};

type StaffResult = {
  id: string;
  name: string;
  avatar_url: string | null;
  city: string | null;
};

type Closure = {
  id: string;
  reason: string;
  note: string | null;
  date_from: string;
  date_to: string;
  is_past: boolean;
};

const STEP_COUNT = 7;
const STEP_KEYS = ['profile', 'service', 'location', 'hours', 'staff', 'rules', 'done'] as const;
type StepKey = typeof STEP_KEYS[number];

const DEFAULT_HOURS: DayHour[] = [
  { day: 1, open: true,  from: '09:00', to: '18:00', open2: false, from2: '13:00', to2: '17:00' },
  { day: 2, open: true,  from: '09:00', to: '18:00', open2: false, from2: '13:00', to2: '17:00' },
  { day: 3, open: true,  from: '09:00', to: '18:00', open2: false, from2: '13:00', to2: '17:00' },
  { day: 4, open: true,  from: '09:00', to: '18:00', open2: false, from2: '13:00', to2: '17:00' },
  { day: 5, open: true,  from: '09:00', to: '18:00', open2: false, from2: '13:00', to2: '17:00' },
  { day: 6, open: true,  from: '09:00', to: '15:00', open2: false, from2: '13:00', to2: '15:00' },
  { day: 0, open: false, from: '09:00', to: '14:00', open2: false, from2: '13:00', to2: '17:00' },
];

const DEFAULT_RULES: Rules = {
  confirmation_mode: 'instant',
  min_notice_minutes: 60,
  max_advance_days: 30,
  cancellation_hours: 24,
  slot_interval_min: 30,
};

const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180];

// ── Component ─────────────────────────────────────────────────────────────

export default function BookingSetupWizardPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Step 0 — Profile
  const [bizName, setBizName] = useState('');

  // Step 1 — Service
  const [svcId, setSvcId] = useState<string | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcDuration, setSvcDuration] = useState(60);
  const [svcPrice, setSvcPrice] = useState('');
  const [svcPriceType, setSvcPriceType] = useState('fixed');
  const [svcCurrency, setSvcCurrency] = useState('BAM');

  // Step 2 — Location
  const [locId, setLocId] = useState<string | null>(null);
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locCity, setLocCity] = useState('');
  const [locCountry, setLocCountry] = useState('');

  // Step 3 — Hours
  const [dayHours, setDayHours] = useState<DayHour[]>(DEFAULT_HOURS);

  // Step 4 — Staff (search)
  const [staffSearch, setStaffSearch] = useState('');
  const [staffResults, setStaffResults] = useState<StaffResult[]>([]);
  const [staffSearching, setStaffSearching] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffResult | null>(null);
  const [staffRole, setStaffRole] = useState<'manager' | 'worker'>('worker');
  const [staffAdded, setStaffAdded] = useState(false);

  // Step 3 — Closures (within Hours step)
  const [closures, setClosures] = useState<Closure[]>([]);
  const [newClosureFrom, setNewClosureFrom] = useState('');
  const [newClosureTo, setNewClosureTo] = useState('');
  const [newClosureReason, setNewClosureReason] = useState('vacation');
  const [newClosureNote, setNewClosureNote] = useState('');
  const [closureSaving, setClosureSaving] = useState(false);
  const [closureForceData, setClosureForceData] = useState<{
    from: string; to: string; reason: string; note: string; count: number;
  } | null>(null);

  // Step 5 — Rules
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);

  // ── Staff search debounce ───────────────────────────────────────────────

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
    if (!user) return;
    setLoading(true);

    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();
    if (profile?.name) setBizName(profile.name);

    const { data: svcs } = await (supabase as any)
      .from('service_catalog')
      .select('id, name, description, duration_minutes, price, price_type, currency')
      .eq('business_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1);
    const svc = svcs?.[0];
    if (svc) {
      setSvcId(svc.id);
      setSvcName(svc.name);
      setSvcDesc(svc.description ?? '');
      setSvcDuration(svc.duration_minutes);
      setSvcPrice(svc.price != null ? String(svc.price) : '');
      setSvcPriceType(svc.price_type);
      setSvcCurrency(svc.currency || 'BAM');
    }

    const { data: locs } = await (supabase as any)
      .from('business_locations')
      .select('id, name, address, city, country')
      .eq('business_id', user.id)
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

      const { data: closuresData } = await (supabase as any).rpc('get_business_closures', {
        p_location_id: loc.id,
      });
      if (Array.isArray(closuresData)) setClosures(closuresData as Closure[]);

      const { data: hoursData } = await (supabase as any).rpc('get_opening_hours', {
        p_location_id: loc.id,
      });
      if (Array.isArray(hoursData) && hoursData.length > 0) {
        type HRow = {
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_closed: boolean;
          sort_order: number;
        };
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

    const { data: rulesData } = await (supabase as any)
      .from('booking_rules')
      .select('confirmation_mode, min_notice_minutes, max_advance_days, cancellation_hours, slot_interval_min')
      .eq('business_id', user.id)
      .maybeSingle();
    if (rulesData) setRules(rulesData as Rules);

    setLoading(false);
  }, [user]);

  useEffect(() => { loadExisting(); }, [loadExisting]);

  // ── Save handlers ───────────────────────────────────────────────────────

  function advance() { setStep((s) => Math.min(s + 1, STEP_COUNT - 1)); }
  function back()    { setStep((s) => Math.max(s - 1, 0)); }

  async function saveProfile() {
    if (!bizName.trim()) { toast.error(t('setup.error.nameRequired')); return; }
    setSaving(true);
    const { data } = await (supabase as any).rpc('upsert_my_business_profile', {
      p_name: bizName.trim(),
      p_timezone: 'Europe/Sarajevo',
    });
    setSaving(false);
    if (!(data as any)?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    advance();
  }

  async function saveService() {
    if (!user || !svcName.trim()) { toast.error(t('setup.error.nameRequired')); return; }
    if (svcDuration <= 0) { toast.error(t('setup.error.saveFailed')); return; }
    setSaving(true);
    const price = svcPrice !== '' ? parseFloat(svcPrice) : null;
    if (svcId) {
      const { data } = await (supabase as any).rpc('update_service', {
        p_service_id: svcId, p_name: svcName.trim(),
        p_description: svcDesc.trim() || null, p_duration_minutes: svcDuration,
        p_price: price, p_price_type: svcPriceType, p_capacity: 1, p_currency: svcCurrency,
      });
      if (!(data as any)?.ok) { toast.error(t('setup.error.saveFailed')); setSaving(false); return; }
    } else {
      const { data } = await (supabase as any).rpc('create_service', {
        p_business_id: user.id, p_name: svcName.trim(),
        p_description: svcDesc.trim() || null, p_duration_minutes: svcDuration,
        p_price: price, p_price_type: svcPriceType,
        p_capacity: 1, p_booking_type: 'appointment_service', p_currency: svcCurrency,
      });
      if (!(data as any)?.ok) { toast.error(t('setup.error.saveFailed')); setSaving(false); return; }
      const { data: row } = await (supabase as any)
        .from('service_catalog').select('id')
        .eq('business_id', user.id).order('created_at', { ascending: false }).limit(1).single();
      if (row?.id) setSvcId(row.id);
    }
    setSaving(false);
    advance();
  }

  async function saveLocation() {
    if (!user || !locName.trim()) { toast.error(t('setup.error.nameRequired')); return; }
    if (!locCity.trim() || !locCountry.trim()) { toast.error(t('setup.error.nameRequired')); return; }
    setSaving(true);
    if (locId) {
      const { data } = await (supabase as any).rpc('update_location', {
        p_location_id: locId, p_name: locName.trim(),
        p_address: locAddress.trim() || null, p_city: locCity.trim(),
        p_country: locCountry.trim(), p_timezone: 'Europe/Sarajevo', p_phone: null,
      });
      if (!(data as any)?.ok) { toast.error(t('setup.error.saveFailed')); setSaving(false); return; }
    } else {
      const { data } = await (supabase as any).rpc('create_location', {
        p_business_id: user.id, p_name: locName.trim(),
        p_address: locAddress.trim() || null, p_city: locCity.trim(),
        p_country: locCountry.trim(), p_timezone: 'Europe/Sarajevo', p_phone: null, p_is_primary: true,
      });
      if (!(data as any)?.ok) { toast.error(t('setup.error.saveFailed')); setSaving(false); return; }
      const { data: row } = await (supabase as any)
        .from('business_locations').select('id')
        .eq('business_id', user.id).order('created_at', { ascending: false }).limit(1).single();
      if (row?.id) setLocId(row.id);
    }
    setSaving(false);
    advance();
  }

  async function saveHours() {
    if (!locId) { toast.error(t('setup.error.saveFailed')); return; }
    setSaving(true);
    for (const dh of dayHours) {
      // Primary period (sort_order = 0)
      const { data: r1 } = await (supabase as any).rpc('upsert_opening_hours', {
        p_location_id: locId, p_day_of_week: dh.day,
        p_open_time: dh.from, p_close_time: dh.to,
        p_is_closed: !dh.open, p_sort_order: 0,
      });
      if (!(r1 as any)?.ok) { toast.error(t('setup.error.saveFailed')); setSaving(false); return; }

      // Secondary period (sort_order = 1) — upsert if enabled, delete otherwise
      if (dh.open && dh.open2) {
        const { data: r2 } = await (supabase as any).rpc('upsert_opening_hours', {
          p_location_id: locId, p_day_of_week: dh.day,
          p_open_time: dh.from2, p_close_time: dh.to2,
          p_is_closed: false, p_sort_order: 1,
        });
        if (!(r2 as any)?.ok) { toast.error(t('setup.error.saveFailed')); setSaving(false); return; }
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
      p_role: staffRole,
      p_location_id: locId,
    });
    setSaving(false);
    if (!(data as any)?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    setStaffAdded(true);
    advance();
  }

  async function saveRules() {
    setSaving(true);
    const { data } = await (supabase as any).rpc('upsert_booking_rules', {
      p_confirmation_mode:  rules.confirmation_mode,
      p_min_notice_minutes: rules.min_notice_minutes,
      p_max_advance_days:   rules.max_advance_days,
      p_cancellation_hours: rules.cancellation_hours,
      p_slot_interval_min:  rules.slot_interval_min,
    });
    setSaving(false);
    if (!(data as any)?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    advance();
  }

  async function addClosure(force = false) {
    if (!locId || !newClosureFrom || !newClosureTo) {
      toast.error(t('setup.error.saveFailed'));
      return;
    }
    setClosureSaving(true);
    const { data } = await (supabase as any).rpc('create_business_closure', {
      p_location_id: locId,
      p_date_from: newClosureFrom,
      p_date_to: newClosureTo,
      p_reason: newClosureReason,
      p_note: newClosureNote.trim() || null,
      p_force: force,
    });
    setClosureSaving(false);
    const res = data as { ok?: boolean; closure_id?: string; booking_count?: number; warning?: string } | null;
    if (!res?.ok) {
      if (res?.warning === 'has_bookings' && res.booking_count) {
        setClosureForceData({
          from: newClosureFrom,
          to: newClosureTo,
          reason: newClosureReason,
          note: newClosureNote.trim(),
          count: res.booking_count,
        });
        return;
      }
      toast.error(t('setup.error.saveFailed'));
      return;
    }
    setClosureForceData(null);
    setNewClosureFrom('');
    setNewClosureTo('');
    setNewClosureReason('vacation');
    setNewClosureNote('');
    const { data: updated } = await (supabase as any).rpc('get_business_closures', { p_location_id: locId });
    if (Array.isArray(updated)) setClosures(updated as Closure[]);
  }

  async function deleteClosure(id: string) {
    const { data } = await (supabase as any).rpc('delete_business_closure', { p_closure_id: id });
    if (!(data as any)?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    setClosures((prev) => prev.filter((c) => c.id !== id));
  }

  function toggleDay(day: number) {
    setDayHours((prev) => prev.map((dh) =>
      dh.day === day ? { ...dh, open: !dh.open, open2: !dh.open ? dh.open2 : false } : dh
    ));
  }

  function toggleSecondPeriod(day: number) {
    setDayHours((prev) => prev.map((dh) =>
      dh.day === day ? { ...dh, open2: !dh.open2 } : dh
    ));
  }

  function updateDayTime(day: number, field: 'from' | 'to', value: string) {
    setDayHours((prev) => prev.map((dh) => dh.day === day ? { ...dh, [field]: value } : dh));
  }

  function updateDayTime2(day: number, field: 'from2' | 'to2', value: string) {
    setDayHours((prev) => prev.map((dh) => dh.day === day ? { ...dh, [field]: value } : dh));
  }

  async function copyLink() {
    if (!bookingUrl) return;
    await navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleStepSave() {
    if (currentKey === 'profile')  saveProfile();
    if (currentKey === 'service')  saveService();
    if (currentKey === 'location') saveLocation();
    if (currentKey === 'hours')    saveHours();
    if (currentKey === 'staff')    saveStaff();
    if (currentKey === 'rules')    saveRules();
  }

  const [bookingUrl, setBookingUrl] = useState('');
  useEffect(() => {
    if (svcId && user) {
      setBookingUrl(`${window.location.origin}/booking/${user.id}/${svcId}`);
    } else {
      setBookingUrl('');
    }
  }, [svcId, user]);

  const isReady = !!bizName && !!svcId && !!locId;
  const currentKey: StepKey = STEP_KEYS[step];

  const inputCls = 'w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30';
  const selectCls = 'w-full border border-border rounded-xl px-3 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30';
  const timeCls = 'border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-[88px]';

  // ── Loading state ───────────────────────────────────────────────────────

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
            <h1 className="text-2xl font-bold tracking-tight">{t('bookingSetup.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('bookingSetup.step')} {step + 1} {t('bookingSetup.step.of')} {STEP_COUNT}
              {currentKey !== 'done' && (
                <span className="font-medium text-foreground">
                  {' '}· {t(`setup.tab.${currentKey === 'service' ? 'services' : currentKey === 'location' ? 'locations' : currentKey}` as Parameters<typeof t>[0])}
                </span>
              )}
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

            {/* Step 0: Profile */}
            {currentKey === 'profile' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold">{t('setup.profile.heading')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('bookingSetup.profile.desc')}</p>
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

            {/* Step 1: Service */}
            {currentKey === 'service' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold">{t('bookingSetup.service.heading')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('bookingSetup.service.desc')}</p>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">{t('setup.services.name')} *</label>
                    <input
                      type="text"
                      value={svcName}
                      onChange={(e) => setSvcName(e.target.value)}
                      placeholder={t('setup.services.namePlaceholder.appointment_service')}
                      className={inputCls}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">{t('setup.services.desc')}</label>
                    <textarea
                      value={svcDesc}
                      onChange={(e) => setSvcDesc(e.target.value)}
                      rows={2}
                      className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-sm font-medium">{t('setup.services.duration')} *</label>
                      <select
                        value={svcDuration}
                        onChange={(e) => setSvcDuration(Number(e.target.value))}
                        className={selectCls}
                      >
                        {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-sm font-medium">{t('setup.services.priceType')}</label>
                      <select
                        value={svcPriceType}
                        onChange={(e) => setSvcPriceType(e.target.value)}
                        className={selectCls}
                      >
                        <option value="fixed">{t('setup.services.ptype.fixed')}</option>
                        <option value="from">{t('setup.services.ptype.from')}</option>
                        <option value="free">{t('setup.services.ptype.free')}</option>
                        <option value="negotiable">{t('setup.services.ptype.negotiable')}</option>
                      </select>
                    </div>
                  </div>
                  {svcPriceType !== 'free' && svcPriceType !== 'negotiable' && (
                    <div className="flex gap-3">
                      <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-sm font-medium">{t('setup.services.price')}</label>
                        <input
                          type="number"
                          value={svcPrice}
                          onChange={(e) => setSvcPrice(e.target.value)}
                          min="0"
                          placeholder="0"
                          className={inputCls}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 w-24">
                        <label className="text-sm font-medium">{t('setup.services.currency')}</label>
                        <select
                          value={svcCurrency}
                          onChange={(e) => setSvcCurrency(e.target.value)}
                          className={selectCls}
                        >
                          <option>BAM</option>
                          <option>EUR</option>
                          <option>RSD</option>
                          <option>USD</option>
                          <option>CHF</option>
                          <option>GBP</option>
                          <option>HRK</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Location */}
            {currentKey === 'location' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold">{t('bookingSetup.location.heading')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('bookingSetup.location.desc')}</p>
                  <span className="inline-block mt-2 text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-full">
                    {t('bookingSetup.location.free')}
                  </span>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">{t('setup.locations.name')} *</label>
                    <input
                      type="text"
                      value={locName}
                      onChange={(e) => setLocName(e.target.value)}
                      placeholder="npr. Salon Ana – Centar"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">{t('setup.locations.address')}</label>
                    <input
                      type="text"
                      value={locAddress}
                      onChange={(e) => setLocAddress(e.target.value)}
                      placeholder="npr. Titova 15"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">{t('setup.locations.city')} *</label>
                    <CityAutocomplete
                      value={locCity}
                      onChange={(city, placeData) => {
                        setLocCity(city);
                        if (placeData?.country) setLocCountry(placeData.country);
                      }}
                      placeholder="npr. Sarajevo"
                      required
                    />
                  </div>
                  {locCountry && (
                    <div className="flex items-center gap-1.5 -mt-1">
                      <span className="text-xs text-muted-foreground">{t('setup.locations.country')}:</span>
                      <span className="text-xs font-medium">{locCountry}</span>
                      <button
                        type="button"
                        onClick={() => setLocCountry('')}
                        className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {!locCountry && locCity && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium">{t('setup.locations.country')} *</label>
                      <input
                        type="text"
                        value={locCountry}
                        onChange={(e) => setLocCountry(e.target.value)}
                        placeholder="npr. Bosna i Hercegovina"
                        className={inputCls}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Hours */}
            {currentKey === 'hours' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold">{t('setup.hours.heading')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('bookingSetup.hours.desc')}</p>
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
                          {/* Primary period */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <input
                              type="time"
                              value={dh.from}
                              onChange={(e) => updateDayTime(dh.day, 'from', e.target.value)}
                              className={timeCls}
                            />
                            <span className="text-xs text-muted-foreground">–</span>
                            <input
                              type="time"
                              value={dh.to}
                              onChange={(e) => updateDayTime(dh.day, 'to', e.target.value)}
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
                          {/* Secondary period */}
                          {dh.open2 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <input
                                type="time"
                                value={dh.from2}
                                onChange={(e) => updateDayTime2(dh.day, 'from2', e.target.value)}
                                className={timeCls}
                              />
                              <span className="text-xs text-muted-foreground">–</span>
                              <input
                                type="time"
                                value={dh.to2}
                                onChange={(e) => updateDayTime2(dh.day, 'to2', e.target.value)}
                                className={timeCls}
                              />
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

                {/* Closures section */}
                {locId && (
                  <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
                    <div>
                      <h3 className="text-sm font-semibold">{t('bookingSetup.hours.closures.heading')}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('bookingSetup.hours.closures.desc')}</p>
                    </div>

                    {/* Existing closures */}
                    {closures.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {closures.map((c) => (
                          <div
                            key={c.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${
                              c.is_past ? 'border-border/30 bg-muted/30 text-muted-foreground' : 'border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800'
                            }`}
                          >
                            <span className="flex-1 min-w-0">
                              <span className="font-medium">
                                {t(`bookingSetup.hours.closures.reason.${c.reason}` as Parameters<typeof t>[0]) || c.reason}
                              </span>
                              <span className="text-muted-foreground ml-1.5">
                                {c.date_from} – {c.date_to}
                              </span>
                              {c.note && <span className="block text-muted-foreground/70 truncate">{c.note}</span>}
                            </span>
                            {!c.is_past && (
                              <button
                                type="button"
                                onClick={() => deleteClosure(c.id)}
                                className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/60">{t('bookingSetup.hours.closures.empty')}</p>
                    )}

                    {/* Force-confirm warning */}
                    {closureForceData && (
                      <div className="flex flex-col gap-2 p-3 rounded-xl border border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-700">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-orange-800 dark:text-orange-300 leading-relaxed">
                            {t('bookingSetup.hours.closures.confirmWarning').replace('{n}', String(closureForceData.count))}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setClosureForceData(null)}
                            className="flex-1 text-xs py-1.5 px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {t('bookingSetup.back')}
                          </button>
                          <button
                            type="button"
                            onClick={() => addClosure(true)}
                            disabled={closureSaving}
                            className="flex-1 text-xs py-1.5 px-3 rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors disabled:opacity-50"
                          >
                            {closureSaving ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : t('bookingSetup.hours.closures.confirmForce')}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Add new closure form */}
                    {!closureForceData && (
                      <div className="flex flex-col gap-2 p-3 rounded-xl border border-border/60 bg-muted/20">
                        <div className="flex gap-2">
                          <div className="flex flex-col gap-1 flex-1">
                            <label className="text-[11px] font-medium text-muted-foreground">{t('bookingSetup.hours.closures.dateFrom')}</label>
                            <input
                              type="date"
                              value={newClosureFrom}
                              onChange={(e) => setNewClosureFrom(e.target.value)}
                              className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                          <div className="flex flex-col gap-1 flex-1">
                            <label className="text-[11px] font-medium text-muted-foreground">{t('bookingSetup.hours.closures.dateTo')}</label>
                            <input
                              type="date"
                              value={newClosureTo}
                              onChange={(e) => setNewClosureTo(e.target.value)}
                              min={newClosureFrom}
                              className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <select
                            value={newClosureReason}
                            onChange={(e) => setNewClosureReason(e.target.value)}
                            className="flex-1 border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                          >
                            <option value="vacation">{t('bookingSetup.hours.closures.reason.vacation')}</option>
                            <option value="holiday">{t('bookingSetup.hours.closures.reason.holiday')}</option>
                            <option value="temporary">{t('bookingSetup.hours.closures.reason.temporary')}</option>
                            <option value="other">{t('bookingSetup.hours.closures.reason.other')}</option>
                          </select>
                          <input
                            type="text"
                            value={newClosureNote}
                            onChange={(e) => setNewClosureNote(e.target.value)}
                            placeholder={t('bookingSetup.hours.closures.note')}
                            className="flex-1 border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => addClosure(false)}
                          disabled={closureSaving || !newClosureFrom || !newClosureTo}
                          className="self-start flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {closureSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          {t('bookingSetup.hours.closures.add')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Staff */}
            {currentKey === 'staff' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold">{t('bookingSetup.staff.search.heading')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('bookingSetup.staff.desc')}</p>
                  <span className="inline-block mt-2 text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-full">
                    {t('bookingSetup.staff.free')}
                  </span>
                </div>

                <div className="flex flex-col gap-4">
                  {selectedStaff ? (
                    /* Selected user card */
                    <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-primary/30 bg-primary/5">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden text-sm font-bold text-primary">
                        {selectedStaff.avatar_url ? (
                          <img src={selectedStaff.avatar_url} alt={selectedStaff.name} className="w-full h-full object-cover" />
                        ) : (
                          selectedStaff.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{selectedStaff.name}</p>
                        {selectedStaff.city && (
                          <p className="text-xs text-muted-foreground">{selectedStaff.city}</p>
                        )}
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
                    /* Search input */
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

                      {/* Search results */}
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

                  {/* Role selector — show when a user is selected and not yet added */}
                  {selectedStaff && !staffAdded && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium">{t('setup.staff.inviteRole')}</label>
                      <select
                        value={staffRole}
                        onChange={(e) => setStaffRole(e.target.value as 'manager' | 'worker')}
                        className={selectCls}
                      >
                        <option value="worker">{t('setup.staff.role.worker')}</option>
                        <option value="manager">{t('setup.staff.role.manager')}</option>
                      </select>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">{t('bookingSetup.staff.skipHint')}</p>
              </div>
            )}

            {/* Step 5: Rules */}
            {currentKey === 'rules' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold">{t('setup.rules.heading')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('bookingSetup.rules.desc')}</p>
                </div>
                <div className="flex flex-col gap-5">

                  {/* Confirmation mode */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">{t('setup.rules.confirmation')}</label>
                    <div className="flex gap-2">
                      {(['instant', 'requires_approval'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setRules((r) => ({ ...r, confirmation_mode: mode }))}
                          className={`flex-1 text-sm py-2.5 px-3 rounded-xl border-2 transition-colors ${
                            rules.confirmation_mode === mode
                              ? 'border-primary bg-primary/5 text-primary font-medium'
                              : 'border-border text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          {mode === 'instant'
                            ? t('setup.rules.confirmation.instant')
                            : t('setup.rules.confirmation.approval')}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {rules.confirmation_mode === 'instant'
                        ? t('setup.rules.confirmation.instant.desc')
                        : t('setup.rules.confirmation.approval.desc')}
                    </p>
                  </div>

                  {/* Slot interval */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">{t('setup.rules.slotInterval')}</label>
                    <select
                      value={rules.slot_interval_min}
                      onChange={(e) => setRules((r) => ({ ...r, slot_interval_min: Number(e.target.value) }))}
                      className={selectCls}
                    >
                      {[15, 30, 45, 60].map((v) => <option key={v} value={v}>{v} min</option>)}
                    </select>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t('setup.rules.slotInterval.desc')}
                    </p>
                  </div>

                  {/* Cancellation + Min notice */}
                  <div className="flex gap-3">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs font-medium text-muted-foreground">{t('setup.rules.cancellation')}</label>
                      <select
                        value={rules.cancellation_hours}
                        onChange={(e) => setRules((r) => ({ ...r, cancellation_hours: Number(e.target.value) }))}
                        className={selectCls}
                      >
                        {[1, 2, 4, 6, 12, 24, 48].map((v) => <option key={v} value={v}>{v}h</option>)}
                      </select>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {t('setup.rules.cancellation.desc')}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs font-medium text-muted-foreground">{t('setup.rules.minNotice')}</label>
                      <select
                        value={rules.min_notice_minutes}
                        onChange={(e) => setRules((r) => ({ ...r, min_notice_minutes: Number(e.target.value) }))}
                        className={selectCls}
                      >
                        {[15, 30, 60, 120, 240, 480, 1440].map((v) => (
                          <option key={v} value={v}>
                            {v < 60 ? `${v} min` : v === 60 ? '1h' : v < 1440 ? `${v / 60}h` : '24h'}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {t('setup.rules.minNotice.desc')}
                      </p>
                    </div>
                  </div>

                  {/* Max advance */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">{t('setup.rules.maxAdvance')}</label>
                    <select
                      value={rules.max_advance_days}
                      onChange={(e) => setRules((r) => ({ ...r, max_advance_days: Number(e.target.value) }))}
                      className={selectCls}
                    >
                      {[7, 14, 30, 60, 90].map((v) => <option key={v} value={v}>{v} dana</option>)}
                    </select>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t('setup.rules.maxAdvance.desc')}
                    </p>
                  </div>

                </div>
              </div>
            )}

            {/* Step 6: Done */}
            {currentKey === 'done' && (
              <div className="flex flex-col gap-5">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h2 className="text-xl font-bold">{t('bookingSetup.activate.heading')}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{t('bookingSetup.activate.desc')}</p>
                </div>

                <div className="flex flex-col gap-2">
                  {[
                    { label: t('setup.tab.profile'),   done: !!bizName },
                    { label: t('setup.tab.services'),  done: !!svcId },
                    { label: t('setup.tab.locations'), done: !!locId },
                    { label: t('setup.tab.hours'),     done: dayHours.some((d) => d.open) },
                    { label: t('setup.tab.rules'),     done: true },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 text-sm">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                        item.done ? 'bg-green-500' : 'bg-muted'
                      }`}>
                        <Check className={`w-3 h-3 ${item.done ? 'text-white' : 'text-muted-foreground'}`} />
                      </div>
                      <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                    </div>
                  ))}
                </div>

                {isReady && bookingUrl && (
                  <div className="bg-muted/50 border border-border rounded-xl p-4 flex flex-col gap-2">
                    <p className="text-xs font-medium text-muted-foreground">{t('bookingSetup.activate.link')}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-foreground flex-1 break-all">{bookingUrl}</span>
                      <button
                        onClick={copyLink}
                        className="shrink-0 flex items-center gap-1 text-xs text-primary font-medium hover:text-primary/80 transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? t('bookingSetup.activate.copied') : t('bookingSetup.activate.copy')}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => router.push('/dashboard/business/setup')}
                    className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl py-3 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t('bookingSetup.activate.goToSetup')}
                  </button>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="w-full text-sm font-medium bg-primary text-primary-foreground rounded-xl py-3 hover:opacity-90 transition-opacity"
                  >
                    {t('bookingSetup.activate.dashboard')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Navigation ────────────────────────────────────────────── */}
          {currentKey !== 'done' && (
            <div className="flex items-center gap-3 mt-6">
              {step > 0 && (
                <button
                  onClick={back}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t('bookingSetup.back')}
                </button>
              )}
              <div className="flex-1" />
              {currentKey === 'staff' && (
                <button
                  onClick={advance}
                  disabled={saving}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2"
                >
                  {t('bookingSetup.skip')}
                </button>
              )}
              <button
                onClick={handleStepSave}
                disabled={saving}
                className="px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('bookingSetup.saveAndContinue')}
              </button>
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  );
}
