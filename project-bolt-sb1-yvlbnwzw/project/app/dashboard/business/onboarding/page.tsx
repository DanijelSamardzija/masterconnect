'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink, ChevronLeft } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

type DayHour = { day: number; open: boolean; from: string; to: string; };

type Rules = {
  confirmation_mode: 'instant' | 'requires_approval';
  min_notice_minutes: number;
  max_advance_days: number;
  cancellation_hours: number;
  slot_interval_min: number;
};

const STEP_COUNT = 7;
const STEP_KEYS = ['profile', 'service', 'location', 'hours', 'staff', 'rules', 'done'] as const;
type StepKey = typeof STEP_KEYS[number];

// Default Mon-Sat open, Sun closed — suitable for salon/barber businesses
const DEFAULT_HOURS: DayHour[] = [
  { day: 1, open: true,  from: '09:00', to: '18:00' },
  { day: 2, open: true,  from: '09:00', to: '18:00' },
  { day: 3, open: true,  from: '09:00', to: '18:00' },
  { day: 4, open: true,  from: '09:00', to: '18:00' },
  { day: 5, open: true,  from: '09:00', to: '18:00' },
  { day: 6, open: true,  from: '09:00', to: '15:00' },
  { day: 0, open: false, from: '09:00', to: '14:00' },
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

  // Step 3 — Hours
  const [dayHours, setDayHours] = useState<DayHour[]>(DEFAULT_HOURS);

  // Step 4 — Staff
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'worker'>('worker');

  // Step 5 — Rules
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);

  // ── Load existing data ──────────────────────────────────────────────────

  const loadExisting = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // profiles.name is the business name (not full_name)
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();
    if (profile?.name) setBizName(profile.name);

    // First active service
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

    // First active location (primary first)
    const { data: locs } = await (supabase as any)
      .from('business_locations')
      .select('id, name, address, city')
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

      // Load hours via RPC (returns { day_of_week, start_time, end_time, is_closed, sort_order })
      const { data: hoursData } = await (supabase as any).rpc('get_opening_hours', {
        p_location_id: loc.id,
      });
      if (Array.isArray(hoursData) && hoursData.length > 0) {
        type HRow = { day_of_week: number; start_time: string; end_time: string; is_closed: boolean; sort_order: number; };
        // Keep only sort_order=0 rows (wizard uses single period per day)
        const primary = (hoursData as HRow[]).filter((r) => r.sort_order === 0);
        setDayHours(DEFAULT_HOURS.map((dh) => {
          const found = primary.find((r) => r.day_of_week === dh.day);
          if (!found) return dh;
          return { ...dh, open: !found.is_closed, from: found.start_time, to: found.end_time };
        }));
      }
    }

    // Rules
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
      // Fetch the ID of the service just created
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
    setSaving(true);
    if (locId) {
      const { data } = await (supabase as any).rpc('update_location', {
        p_location_id: locId, p_name: locName.trim(),
        p_address: locAddress.trim() || null, p_city: locCity.trim() || null,
        p_country: null, p_timezone: 'Europe/Sarajevo', p_phone: null,
      });
      if (!(data as any)?.ok) { toast.error(t('setup.error.saveFailed')); setSaving(false); return; }
    } else {
      const { data } = await (supabase as any).rpc('create_location', {
        p_business_id: user.id, p_name: locName.trim(),
        p_address: locAddress.trim() || null, p_city: locCity.trim() || null,
        p_country: null, p_timezone: 'Europe/Sarajevo', p_phone: null, p_is_primary: true,
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
      const { data } = await (supabase as any).rpc('upsert_opening_hours', {
        p_location_id: locId, p_day_of_week: dh.day,
        p_open_time: dh.from, p_close_time: dh.to,
        p_is_closed: !dh.open, p_sort_order: 0,
      });
      if (!(data as any)?.ok) { toast.error(t('setup.error.saveFailed')); setSaving(false); return; }
    }
    setSaving(false);
    advance();
  }

  async function saveStaff() {
    // Staff is optional — skip if email empty
    if (!user || !inviteEmail.trim()) { advance(); return; }
    setSaving(true);
    const { data } = await (supabase as any).rpc('send_staff_invitation', {
      p_business_id: user.id, p_email: inviteEmail.trim(),
      p_role: inviteRole, p_location_id: locId,
    });
    setSaving(false);
    if (!(data as any)?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    toast.success(t('setup.staff.invite.sent'));
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

  function toggleDay(day: number) {
    setDayHours((prev) => prev.map((dh) => dh.day === day ? { ...dh, open: !dh.open } : dh));
  }

  function updateDayTime(day: number, field: 'from' | 'to', value: string) {
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

  const bookingUrl = svcId && user && typeof window !== 'undefined'
    ? `${window.location.origin}/booking/${user.id}/${svcId}`
    : '';

  const isReady = !!bizName && !!svcId && !!locId;
  const currentKey: StepKey = STEP_KEYS[step];

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
                    className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                      className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                        className="w-full border border-border rounded-xl px-3 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-sm font-medium">{t('setup.services.priceType')}</label>
                      <select
                        value={svcPriceType}
                        onChange={(e) => setSvcPriceType(e.target.value)}
                        className="w-full border border-border rounded-xl px-3 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                          className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 w-24">
                        <label className="text-sm font-medium">{t('setup.services.currency')}</label>
                        <select
                          value={svcCurrency}
                          onChange={(e) => setSvcCurrency(e.target.value)}
                          className="w-full border border-border rounded-xl px-3 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                      className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">{t('setup.locations.address')}</label>
                    <input
                      type="text"
                      value={locAddress}
                      onChange={(e) => setLocAddress(e.target.value)}
                      placeholder="npr. Titova 15"
                      className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">{t('setup.locations.city')}</label>
                    <input
                      type="text"
                      value={locCity}
                      onChange={(e) => setLocCity(e.target.value)}
                      placeholder="npr. Sarajevo"
                      className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
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
                <div className="flex flex-col gap-1">
                  {dayHours.map((dh) => (
                    <div key={dh.day} className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
                      <button
                        type="button"
                        onClick={() => toggleDay(dh.day)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                          dh.open ? 'bg-primary border-primary' : 'border-border bg-background'
                        }`}
                      >
                        {dh.open && <Check className="w-3 h-3 text-primary-foreground" />}
                      </button>
                      <span className="text-sm w-28 shrink-0">
                        {t(`setup.hours.day.${dh.day}` as Parameters<typeof t>[0])}
                      </span>
                      {dh.open ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="time"
                            value={dh.from}
                            onChange={(e) => updateDayTime(dh.day, 'from', e.target.value)}
                            className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <span className="text-xs text-muted-foreground">–</span>
                          <input
                            type="time"
                            value={dh.to}
                            onChange={(e) => updateDayTime(dh.day, 'to', e.target.value)}
                            className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground flex-1">{t('setup.hours.closed')}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Staff */}
            {currentKey === 'staff' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold">{t('setup.tab.staff')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('bookingSetup.staff.desc')}</p>
                  <span className="inline-block mt-2 text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-full">
                    {t('bookingSetup.staff.free')}
                  </span>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">{t('setup.staff.inviteEmail')}</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="radnik@example.com"
                      className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">{t('setup.staff.inviteRole')}</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'manager' | 'worker')}
                      className="w-full border border-border rounded-xl px-3 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="worker">{t('setup.staff.role.worker')}</option>
                      <option value="manager">{t('setup.staff.role.manager')}</option>
                    </select>
                  </div>
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
                <div className="flex flex-col gap-4">
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
                          {mode === 'instant' ? t('setup.rules.confirmation.instant') : t('setup.rules.confirmation.approval')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs font-medium text-muted-foreground">{t('setup.rules.slotInterval')}</label>
                      <select
                        value={rules.slot_interval_min}
                        onChange={(e) => setRules((r) => ({ ...r, slot_interval_min: Number(e.target.value) }))}
                        className="border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {[15, 30, 45, 60].map((v) => <option key={v} value={v}>{v} min</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs font-medium text-muted-foreground">{t('setup.rules.cancellation')}</label>
                      <select
                        value={rules.cancellation_hours}
                        onChange={(e) => setRules((r) => ({ ...r, cancellation_hours: Number(e.target.value) }))}
                        className="border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {[1, 2, 4, 6, 12, 24, 48].map((v) => <option key={v} value={v}>{v}h</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs font-medium text-muted-foreground">{t('setup.rules.minNotice')}</label>
                      <select
                        value={rules.min_notice_minutes}
                        onChange={(e) => setRules((r) => ({ ...r, min_notice_minutes: Number(e.target.value) }))}
                        className="border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {[15, 30, 60, 120, 240, 480, 1440].map((v) => (
                          <option key={v} value={v}>
                            {v < 60 ? `${v} min` : v === 60 ? '1h' : v < 1440 ? `${v / 60}h` : '24h'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs font-medium text-muted-foreground">{t('setup.rules.maxAdvance')}</label>
                      <select
                        value={rules.max_advance_days}
                        onChange={(e) => setRules((r) => ({ ...r, max_advance_days: Number(e.target.value) }))}
                        className="border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {[7, 14, 30, 60, 90].map((v) => <option key={v} value={v}>{v} dana</option>)}
                      </select>
                    </div>
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

                {/* Setup checklist */}
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

                {/* Booking link */}
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

                {/* Actions */}
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
                {saving ? '...' : t('bookingSetup.saveAndContinue')}
              </button>
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  );
}
