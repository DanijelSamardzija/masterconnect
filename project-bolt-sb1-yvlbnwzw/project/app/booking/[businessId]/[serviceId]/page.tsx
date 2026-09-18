'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { langToLocale } from '@/lib/utils/locale';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingAccess } from '@/lib/hooks/use-booking-access';
import { saveGuestIntent } from '@/lib/guest-intent';
import { BookingBetaBanner } from '@/components/booking-beta-banner';
import { toast } from 'sonner';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Clock, Users,
  Check, Calendar, X, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Slot = {
  slot_start: string;
  slot_end: string;
  available: boolean;
  capacity_remaining: number;
};

type Location = {
  id: string;
  name: string;
  timezone: string;
  is_primary: boolean;
  city: string | null;
  country: string | null;
  address: string | null;
  phone: string | null;
};

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  capacity: number;
  price: number | null;
  price_type: string;
  currency: string | null;
};

type Business = {
  id: string;
  name: string;
};

type StaffOption = {
  staff_member_id: string;
  user_id: string;
  name: string;
  role: string;
  location_name: string | null;
};

type OpeningHourRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
  sort_order: number;
};

type ClosureRow = {
  reason: string;
  note: string | null;
  date_from: string;
  date_to: string;
};

type StaffAbsenceRow = {
  reason: string;
  note: string | null;
  date_from: string;
  date_to: string;
};

type StaffShiftDay = {
  is_off: boolean;
  off_reason: string | null;
};

type StaffPickerOption = {
  staff_member_id: string;
  name: string;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function formatTime(isoStr: string, tz: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  }).format(new Date(isoStr));
}

function formatDate(d: Date, locale: string): string {
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function weekStart(d: Date): string {
  // Use local date components to avoid UTC/local timezone mismatch for UTC+ users.
  // toISOString() returns UTC date which can be one day behind the local date.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function slotLocalHHMM(isoStr: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(isoStr));
}

function getCalendarRows(month: Date): (Date | null)[][] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1);
  const lastDay = new Date(year, m + 1, 0);
  const startDow = firstDay.getDay();
  const startOffset = startDow === 0 ? 6 : startDow - 1;
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function bookingErrorKey(errorCode: string): string {
  const map: Record<string, string> = {
    capacity_full: 'booking.error.capacityFull',
    too_soon: 'booking.error.tooSoon',
    too_far: 'booking.error.tooFar',
    outside_opening_hours: 'booking.error.outsideHours',
    staff_conflict: 'booking.error.conflict',
    resource_conflict: 'booking.error.conflict',
    time_block_conflict: 'booking.error.conflict',
  };
  return map[errorCode] ?? 'booking.error.generic';
}

export default function BookingSlotPickerPage() {
  const { businessId, serviceId } = useParams<{ businessId: string; serviceId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedStaffId = searchParams.get('staffId');
  const { t, language } = useLanguage();
  const locale = langToLocale(language);
  const { user } = useAuth();
  const { hasAccess, loading: authLoading } = useBookingAccess();

  const [business, setBusiness] = useState<Business | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedTimezone, setSelectedTimezone] = useState<string>('UTC');

  const [weekDate, setWeekDate] = useState<Date>(() => getMonday(startOfDay(new Date())));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [openingHours, setOpeningHours] = useState<OpeningHourRow[]>([]);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [closures, setClosures] = useState<ClosureRow[]>([]);
  const [staffAbsences, setStaffAbsences] = useState<StaffAbsenceRow[]>([]);

  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(preselectedStaffId ?? null);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [breaks, setBreaks] = useState<Record<string, { break_start: string; break_end: string }>>({});
  const [staffShiftDays, setStaffShiftDays] = useState<Record<string, StaffShiftDay>>({});

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);

  const [maxAdvanceDays, setMaxAdvanceDays] = useState(60);
  const [bookingStaffId, setBookingStaffId] = useState<string | null>(null);
  const [staffPickerOpen, setStaffPickerOpen] = useState(false);
  const [staffPickerSlot, setStaffPickerSlot] = useState<Slot | null>(null);
  const [staffPickerOptions, setStaffPickerOptions] = useState<StaffPickerOption[]>([]);
  const [loadingStaffPicker, setLoadingStaffPicker] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfDay(new Date()));

  useEffect(() => {
    if (!businessId || !serviceId) return;
    async function loadMeta() {
      setLoadingMeta(true);
      try {
        const [bizRes, svcRes, locRes, rulesRes] = await Promise.all([
          supabase.from('profiles').select('id, name').eq('id', businessId).eq('is_business', true).maybeSingle(),
          (supabase as any).from('service_catalog').select('id, name, description, duration_minutes, capacity, price, price_type, currency').eq('id', serviceId).eq('business_id', businessId).eq('is_active', true).maybeSingle(),
          supabase.from('business_locations').select('id, name, timezone, is_primary, city, country, address, phone').eq('business_id', businessId).eq('is_active', true).order('is_primary', { ascending: false }),
          (supabase as any).from('booking_rules').select('max_advance_days').eq('business_id', businessId).maybeSingle(),
        ]);
        setBusiness(bizRes.data ?? null);
        setService((svcRes.data as Service) ?? null);
        if (rulesRes.data?.max_advance_days) setMaxAdvanceDays(rulesRes.data.max_advance_days);
        const locs = locRes.data ?? [];
        setLocations(locs);
        if (locs.length > 0) {
          const primary = locs.find((l: Location) => l.is_primary) ?? locs[0];
          setSelectedLocationId(primary.id);
          setSelectedTimezone(primary.timezone);
          const hoursRes = await (supabase as any).rpc('get_opening_hours', { p_location_id: primary.id });
          setOpeningHours((hoursRes.data as OpeningHourRow[]) ?? []);
          const closuresRes = await (supabase as any).rpc('public_get_business_closures', { p_location_id: primary.id });
          setClosures((closuresRes.data as ClosureRow[]) ?? []);
        }
      } finally {
        setLoadingMeta(false);
      }
    }
    loadMeta();
  }, [businessId, serviceId]);

  const loadStaff = useCallback(async (locId: string) => {
    if (!serviceId) return;
    setLoadingStaff(true);
    try {
      const { data } = await (supabase as any).rpc('get_staff_for_service', {
        p_service_id: serviceId,
        p_location_id: locId,
      });
      const members = (data as StaffOption[]) ?? [];
      setStaffOptions(members);
      // Auto-select the only staff member so "Bilo koji radnik" never shows for a solo worker
      setSelectedStaffId(members.length === 1 ? members[0].staff_member_id : null);
    } finally {
      setLoadingStaff(false);
    }
  }, [serviceId]);

  const loadSlots = useCallback(async () => {
    if (!selectedLocationId || !businessId || !serviceId) return;
    setLoadingSlots(true);
    setSlots([]);
    try {
      const ws = weekStart(weekDate);
      let data: Slot[] | null = null;
      if (selectedStaffId) {
        const res = await (supabase as any).rpc('get_available_slots', {
          p_business_id: businessId,
          p_location_id: selectedLocationId,
          p_service_id: serviceId,
          p_week_start: ws,
          p_staff_member_id: selectedStaffId,
        });
        data = res.data;
      } else {
        const res = await (supabase as any).rpc('get_available_slots_any_staff', {
          p_business_id: businessId,
          p_location_id: selectedLocationId,
          p_service_id: serviceId,
          p_week_start: ws,
        });
        data = res.data;
      }
      setSlots((data as Slot[]) ?? []);
    } finally {
      setLoadingSlots(false);
    }
  }, [businessId, serviceId, selectedLocationId, selectedStaffId, weekDate]);

  // Load staff only when location changes (not when week/staff changes)
  useEffect(() => {
    if (!loadingMeta && selectedLocationId) {
      loadStaff(selectedLocationId);
    }
  }, [loadingMeta, selectedLocationId, loadStaff]);

  // Load slots when week or selected staff changes
  useEffect(() => {
    if (!loadingMeta && selectedLocationId) {
      loadSlots();
    }
  }, [loadingMeta, selectedLocationId, weekDate, loadSlots]);

  useEffect(() => {
    if (!selectedStaffId) { setStaffAbsences([]); return; }
    (supabase as any).rpc('public_get_staff_absences', { p_staff_member_id: selectedStaffId })
      .then(({ data }: { data: StaffAbsenceRow[] | null }) => setStaffAbsences(data ?? []));
  }, [selectedStaffId]);

  useEffect(() => {
    if (!selectedStaffId) { setStaffShiftDays({}); return; }
    const ws = weekStart(weekDate);
    const we = weekStart(addDays(weekDate, 6));
    (supabase as any).rpc('get_staff_schedule_for_client', {
      p_staff_member_id: selectedStaffId,
      p_from_date: ws,
      p_to_date: we,
    }).then(({ data }: { data: { schedule: { shift_date: string; is_off: boolean; off_reason: string | null }[] } | null }) => {
      const map: Record<string, StaffShiftDay> = {};
      if (data?.schedule && Array.isArray(data.schedule)) {
        data.schedule.forEach(d => { map[d.shift_date] = { is_off: d.is_off, off_reason: d.off_reason }; });
      }
      setStaffShiftDays(map);
    });
  }, [selectedStaffId, weekDate]);

  useEffect(() => {
    if (!selectedStaffId) { setBreaks({}); return; }
    const ws = weekStart(weekDate);
    (supabase as any).rpc('public_get_week_breaks', {
      p_staff_member_id: selectedStaffId,
      p_week_start: ws,
    }).then(({ data }: { data: { shift_date: string; break_start: string; break_end: string }[] | null }) => {
      const map: Record<string, { break_start: string; break_end: string }> = {};
      if (Array.isArray(data)) {
        data.forEach(b => { map[b.shift_date] = { break_start: b.break_start, break_end: b.break_end }; });
      }
      setBreaks(map);
    });
  }, [selectedStaffId, weekDate]);

  function onLocationChange(locId: string) {
    const loc = locations.find((l) => l.id === locId);
    if (!loc) return;
    setSelectedLocationId(locId);
    setSelectedTimezone(loc.timezone);
    (supabase as any).rpc('get_opening_hours', { p_location_id: locId })
      .then(({ data }: { data: OpeningHourRow[] | null }) => setOpeningHours(data ?? []));
    (supabase as any).rpc('public_get_business_closures', { p_location_id: locId })
      .then(({ data }: { data: ClosureRow[] | null }) => setClosures(data ?? []));
  }

  const slotsByDay: Record<string, Slot[]> = {};
  for (const slot of slots) {
    const dayKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: selectedTimezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(slot.slot_start));
    if (!slotsByDay[dayKey]) slotsByDay[dayKey] = [];
    slotsByDay[dayKey].push(slot);
  }

  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => addDays(weekDate, i));

  async function handleBook() {
    if (!selectedSlot || !user) return;
    if (!hasAccess) { saveGuestIntent({ action: 'book', returnTo: `/booking/${businessId}/${serviceId}` }); router.push(`/login?redirect=${encodeURIComponent(`/booking/${businessId}/${serviceId}`)}`); return; }
    setBooking(true);
    const staffForBooking = bookingStaffId ?? selectedStaffId;
    const { data } = await (supabase as any).rpc('create_booking', {
      p_business_id: businessId,
      p_location_id: selectedLocationId,
      p_service_id: serviceId,
      p_starts_at: selectedSlot.slot_start,
      p_party_size: partySize,
      p_notes: notes.trim() || null,
      ...(staffForBooking ? { p_staff_member_id: staffForBooking } : {}),
    });
    setBooking(false);
    const result = data as { ok: boolean; error?: string; status?: string; booking_id?: string } | null;
    if (!result?.ok) {
      toast.error(t(bookingErrorKey(result?.error ?? '') as Parameters<typeof t>[0]));
      return;
    }
    if (phone.trim()) {
      await (supabase as any).from('profiles').update({ phone: phone.trim() }).eq('id', user.id);
    }
    setBooked(true);
    setBookingStaffId(null);
    setDialogOpen(false);
    const msg = result.status === 'confirmed' ? t('booking.successConfirmed') : t('booking.successPending');
    toast.success(msg);
    if (result.booking_id) {
      fetch('/api/booking/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'confirmation', booking_id: result.booking_id }),
      }).catch(() => {});
    }
  }

  async function handleSlotClick(slot: Slot) {
    if (!user) {
      saveGuestIntent({ action: 'book', returnTo: `/booking/${businessId}/${serviceId}` });
      router.push(`/login?redirect=${encodeURIComponent(`/booking/${businessId}/${serviceId}`)}`);
      return;
    }
    if (!hasAccess) return;
    if (selectedStaffId === null && staffOptions.length > 0) {
      setStaffPickerSlot(slot);
      setStaffPickerOptions([]);
      setLoadingStaffPicker(true);
      setStaffPickerOpen(true);
      try {
        const { data } = await (supabase as any).rpc('get_staff_available_for_slot', {
          p_business_id: businessId,
          p_location_id: selectedLocationId,
          p_service_id: serviceId,
          p_slot_start: slot.slot_start,
          p_slot_end: slot.slot_end,
          p_week_start: weekStart(weekDate),
        });
        setStaffPickerOptions((data as StaffPickerOption[]) ?? []);
      } finally {
        setLoadingStaffPicker(false);
      }
    } else {
      setSelectedSlot(slot);
      setBookingStaffId(null);
      setPhone('');
      setNotes('');
      setPartySize(1);
      setDialogOpen(true);
    }
  }

  function handlePickStaff(staffMemberId: string) {
    setBookingStaffId(staffMemberId);
    setStaffPickerOpen(false);
    if (staffPickerSlot) {
      setSelectedSlot(staffPickerSlot);
      setPhone('');
      setNotes('');
      setPartySize(1);
      setDialogOpen(true);
    }
  }

  if (loadingMeta) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!business || !service) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">{t('booking.notFound')}</p>
        <button onClick={() => router.back()} className="text-primary underline text-sm">
          {t('booking.backToSetup')}
        </button>
      </div>
    );
  }

  if (booked) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-6">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">{t('booking.successConfirmed')}</h2>
          <p className="text-muted-foreground text-sm">{service.name} — {business.name}</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/booking/my')}>
          {t('booking.myBookings')}
        </Button>
      </div>
    );
  }

  const todayStr = weekStart(getMonday(startOfDay(new Date())));
  const maxWeekMonday = getMonday(addDays(startOfDay(new Date()), maxAdvanceDays));
  const isLastWeek = weekStart(weekDate) >= weekStart(maxWeekMonday);
  const selectedLocation = locations.find(l => l.id === selectedLocationId) ?? locations[0] ?? null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('booking.backToSetup')}
        </button>

        <div className="mb-6">
          <h1 className="text-xl font-semibold">{service.name}</h1>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">{business.name}</p>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {t('booking.duration').replace('{min}', String(service.duration_minutes))}
            </span>
            {service.price && service.price > 0 && service.price_type !== 'negotiable' && (
              <span className="font-medium text-foreground">
                {service.price} {service.currency ?? ''}
              </span>
            )}
            {service.price_type === 'negotiable' && (
              <span>{t('booking.priceNegotiable')}</span>
            )}
          </div>

          {/* Working hours collapsible */}
          {openingHours.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setHoursOpen(o => !o)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{t('setup.hours.heading')}</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${hoursOpen ? 'rotate-90' : ''}`} />
              </button>
              {hoursOpen && (
                <div className="mt-2 border border-border rounded-xl overflow-hidden bg-card">
                  {[1,2,3,4,5,6,0].map(dow => {
                    const periods = openingHours.filter(h => h.day_of_week === dow && !h.is_closed);
                    const isClosed = periods.length === 0;
                    return (
                      <div key={dow} className="flex items-center px-3 py-2 border-b border-border last:border-0">
                        <span className="w-28 text-xs font-medium text-foreground shrink-0">
                          {t(`setup.hours.day.${dow}` as Parameters<typeof t>[0])}
                        </span>
                        {isClosed ? (
                          <span className="text-xs text-muted-foreground">{t('setup.hours.closed')}</span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {periods.map((p, i) => (
                              <span key={i} className="flex items-center gap-1.5 text-xs text-foreground">
                                {i > 0 && <span className="text-muted-foreground">·</span>}
                                {p.start_time.slice(0, 5)} – {p.end_time.slice(0, 5)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Upcoming / active closures */}
          {closures.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {closures.map((c, i) => {
                const today = new Date().toISOString().slice(0, 10);
                const isActive = c.date_from <= today && c.date_to >= today;
                const reasonKey = `setup.closures.reason.${c.reason}` as Parameters<typeof t>[0];
                const reasonLabel = ['vacation','holiday','renovation','other','sick_leave'].includes(c.reason)
                  ? t(reasonKey) : c.reason;
                const fromDate = new Date(c.date_from + 'T00:00:00');
                const toDate = new Date(c.date_to + 'T00:00:00');
                const fromStr = fromDate.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
                const toStr = toDate.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
                const dateRange = c.date_from === c.date_to ? fromStr : `${fromStr} – ${toStr}`;
                return (
                  <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${
                    isActive
                      ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800'
                      : 'bg-muted/40 border border-border'
                  }`}>
                    <Calendar className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isActive ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} />
                    <div>
                      <span className={`font-medium ${isActive ? 'text-amber-800 dark:text-amber-300' : 'text-foreground'}`}>
                        {reasonLabel}
                      </span>
                      <span className={`mx-1 ${isActive ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>·</span>
                      <span className={isActive ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}>
                        {dateRange}
                      </span>
                      {c.note && (
                        <p className={`mt-0.5 ${isActive ? 'text-amber-700/80 dark:text-amber-400/80' : 'text-muted-foreground/80'}`}>
                          {c.note}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Beta notice — shown when user doesn't have access yet */}
        {!authLoading && !hasAccess && (
          <div className="mb-5 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300">{t('booking.beta.inlineNote')}</p>
          </div>
        )}

        {locations.length > 1 && (
          <div className="mb-5">
            <label className="block text-sm font-medium mb-1.5">{t('booking.location')}</label>
            <div className="flex flex-col gap-2">
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => onLocationChange(loc.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                    selectedLocationId === loc.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="text-sm font-medium">{loc.name}</p>
                  {(loc.address || loc.city) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[loc.address, loc.city, loc.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Staff selection — hidden when solo (auto-selected above) */}
        {!loadingStaff && staffOptions.length > 1 && (
          <div className="mb-5">
            <label className="block text-sm font-medium mb-2">{t('booking.staff.heading')}</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedStaffId(null)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  selectedStaffId === null
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground'
                }`}
              >
                {t('booking.staff.any')}
              </button>
              {staffOptions.map((s) => (
                <button
                  key={s.staff_member_id}
                  type="button"
                  onClick={() => setSelectedStaffId(s.staff_member_id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selectedStaffId === s.staff_member_id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground'
                  }`}
                >
                  {s.name}
                  {locations.length > 1 && s.location_name && (
                    <span className={`ml-1 text-[11px] font-normal ${selectedStaffId === s.staff_member_id ? 'text-primary-foreground/70' : 'text-muted-foreground/70'}`}>
                      ({s.location_name})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-1">
          <button
            onClick={() => setWeekDate((d) => addDays(d, -7))}
            disabled={weekStart(weekDate) <= todayStr}
            className="p-2 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label={t('booking.prevWeek')}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setCalendarMonth(new Date(weekDate)); setCalendarOpen(o => !o); }}
            className="flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-accent"
          >
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(weekDays[0], locale)} – {formatDate(weekDays[6], locale)}
          </button>
          <button
            onClick={() => setWeekDate((d) => addDays(d, 7))}
            disabled={isLastWeek}
            className="p-2 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label={t('booking.nextWeek')}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {calendarOpen && (
          <div className="mb-3 border border-border rounded-xl p-3 bg-background shadow-lg relative z-10">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setCalendarMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d; })}
                className="p-1.5 hover:bg-accent rounded-md transition-colors text-muted-foreground"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium">
                {calendarMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => setCalendarMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d; })}
                className="p-1.5 hover:bg-accent rounded-md transition-colors text-muted-foreground"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {['M','T','W','T','F','S','S'].map((d, i) => (
                <div key={i} className="text-center text-[10px] text-muted-foreground font-medium py-0.5">{d}</div>
              ))}
            </div>
            {getCalendarRows(calendarMonth).map((row, rowIdx) => (
              <div key={rowIdx} className="grid grid-cols-7 gap-0.5">
                {row.map((day, dayIdx) => {
                  if (!day) return <div key={dayIdx} className="py-1" />;
                  const today2 = startOfDay(new Date());
                  const isPast = day < today2;
                  const isTooFar = day > addDays(today2, maxAdvanceDays);
                  const disabled = isPast || isTooFar;
                  const dayMonday = getMonday(new Date(day.getTime()));
                  const isInSelectedWeek = weekStart(dayMonday) === weekStart(weekDate);
                  const isTodayDay = day.toDateString() === today2.toDateString();
                  return (
                    <button
                      key={dayIdx}
                      disabled={disabled}
                      onClick={() => { setWeekDate(getMonday(new Date(day.getTime()))); setCalendarOpen(false); }}
                      className={`text-center text-xs py-1 rounded transition-colors ${
                        disabled
                          ? 'text-muted-foreground/30 cursor-not-allowed'
                          : isInSelectedWeek
                            ? 'bg-primary text-primary-foreground font-medium'
                            : isTodayDay
                              ? 'bg-primary/15 text-primary font-medium hover:bg-primary/25'
                              : 'hover:bg-accent'
                      }`}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {loadingSlots ? (
          <div className="text-center py-12 text-muted-foreground text-sm">{t('booking.loadingSlots')}</div>
        ) : slots.length === 0 ? (
          (() => {
            const weekFirstDay = weekStart(weekDays[0]);
            const weekLastDay = weekStart(weekDays[6]);
            const weekAbsence = selectedStaffId
              ? staffAbsences.find(a => a.date_from <= weekLastDay && a.date_to >= weekFirstDay)
              : undefined;
            const staffName = weekAbsence
              ? staffOptions.find(s => s.staff_member_id === selectedStaffId)?.name
              : undefined;
            const absenceReasonKey = weekAbsence
              ? (`setup.closures.reason.${weekAbsence.reason}` as Parameters<typeof t>[0])
              : undefined;
            const absenceLabel = weekAbsence && absenceReasonKey && ['vacation','sick_leave','holiday','renovation','other'].includes(weekAbsence.reason)
              ? t(absenceReasonKey) : weekAbsence?.reason;
            return weekAbsence ? (
              <div className="text-center py-10 px-4">
                <p className="text-sm text-muted-foreground">
                  {staffName && <span className="font-medium text-foreground">{staffName}</span>}
                  {staffName && ' · '}
                  <span>{absenceLabel}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {weekAbsence.date_from} – {weekAbsence.date_to}
                </p>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm">{t('booking.noSlotsThisWeek')}</div>
            );
          })()
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3 text-center leading-snug">
              {t('booking.slotsInfo')}
            </p>
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => {
              const dayKey = new Intl.DateTimeFormat('en-CA', {
                timeZone: selectedTimezone,
                year: 'numeric', month: '2-digit', day: '2-digit',
              }).format(day);
              const daySlots = slotsByDay[dayKey] ?? [];
              const dayLabel = DAYS[day.getDay()];
              const isPast = weekStart(day) < todayStr;
              return (
                <div key={dayKey} className="flex flex-col gap-1">
                  <div className={`text-center text-xs font-medium pb-1 ${isPast ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                    <div>{dayLabel}</div>
                    <div>{day.getDate()}</div>
                  </div>
                  {(() => {
                    const dayBreak = breaks[dayKey];
                    const available = daySlots.filter(s => {
                      if (!s.available) return false;
                      if (!dayBreak) return true;
                      const sStart = slotLocalHHMM(s.slot_start, selectedTimezone);
                      const sEnd = slotLocalHHMM(s.slot_end, selectedTimezone);
                      return !(sStart < dayBreak.break_end.slice(0, 5) && sEnd > dayBreak.break_start.slice(0, 5));
                    });
                    const dayAbsence = selectedStaffId
                      ? staffAbsences.find(a => a.date_from <= dayKey && a.date_to >= dayKey)
                      : undefined;
                    const dayShift = selectedStaffId ? staffShiftDays[dayKey] : undefined;
                    if (available.length === 0 && (dayShift?.is_off || dayAbsence)) {
                      let rLabel: string;
                      if (dayShift?.is_off) {
                        rLabel = dayShift.off_reason === 'vacation'
                          ? t('shift.vacation')
                          : dayShift.off_reason === 'sick_leave'
                          ? t('shift.sickLeave')
                          : t('shift.dayOff');
                      } else if (dayAbsence) {
                        const rKey = `setup.closures.reason.${dayAbsence.reason}` as Parameters<typeof t>[0];
                        rLabel = ['vacation','sick_leave','holiday','renovation','other'].includes(dayAbsence.reason)
                          ? t(rKey) : dayAbsence.reason;
                      } else {
                        rLabel = '';
                      }
                      return [
                        <div key="absence" className="text-[9px] text-center text-muted-foreground leading-tight px-0.5 py-1 rounded bg-muted/50">
                          {rLabel}
                        </div>
                      ];
                    }
                    let breakInserted = false;
                    return available.map((s) => {
                      const items: React.ReactNode[] = [];
                      if (dayBreak && !breakInserted) {
                        const slotHHMM = slotLocalHHMM(s.slot_start, selectedTimezone);
                        if (slotHHMM >= dayBreak.break_end.slice(0, 5)) {
                          breakInserted = true;
                          items.push(
                            <div key="pausa" className="text-center text-[9px] text-orange-500 font-medium py-0.5 px-1 bg-orange-50 dark:bg-orange-950/20 rounded border border-orange-200 dark:border-orange-800/40">
                              {t('schedule.break')}<br />{dayBreak.break_start.slice(0, 5)}–{dayBreak.break_end.slice(0, 5)}
                            </div>
                          );
                        }
                      }
                      items.push(
                        <button
                          key={s.slot_start}
                          onClick={() => handleSlotClick(s)}
                          disabled={!hasAccess && !authLoading}
                          className="text-xs py-1.5 px-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors text-center w-full disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {formatTime(s.slot_start, selectedTimezone)}
                        </button>
                      );
                      return items;
                    });
                  })()}
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setBookingStaffId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('booking.confirm')}</DialogTitle>
          </DialogHeader>
          {selectedSlot && (
            <div className="flex flex-col gap-4">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{service.name}</span>
                {' '}{t('booking.slotAt')}{' '}
                <span className="font-medium text-foreground">
                  {formatTime(selectedSlot.slot_start, selectedTimezone)}
                </span>
                {' '}({formatDate(new Date(selectedSlot.slot_start), locale)})
              </div>
              {selectedLocation && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{[selectedLocation.name, [selectedLocation.address, selectedLocation.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</span>
                </div>
              )}

              {service.capacity > 1 && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t('booking.partySize')}</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                      className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-accent transition-colors text-sm"
                    >−</button>
                    <span className="w-8 text-center font-medium text-sm">{partySize}</span>
                    <button
                      onClick={() => setPartySize((n) => Math.min(selectedSlot.capacity_remaining, n + 1))}
                      className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-accent transition-colors text-sm"
                    >+</button>
                    <span className="text-xs text-muted-foreground ml-1">
                      / {selectedSlot.capacity_remaining}
                      {' '}<Users className="inline w-3 h-3" />
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5">{t('booking.phone')}</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('booking.phonePlaceholder')}
                  required
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">{t('booking.notes')}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('booking.notesPlaceholder')}
                  rows={3}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                  <X className="w-4 h-4 mr-1" /> {t('block.cancel')}
                </Button>
                <Button className="flex-1" onClick={handleBook} disabled={booking || !phone.trim()}>
                  {booking ? t('booking.booking') : t('booking.book')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={staffPickerOpen} onOpenChange={setStaffPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('booking.pickStaff.title')}</DialogTitle>
          </DialogHeader>
          {staffPickerSlot && (
            <p className="text-sm text-muted-foreground -mt-1 mb-1">
              {formatTime(staffPickerSlot.slot_start, selectedTimezone)}
              {' '}({formatDate(new Date(staffPickerSlot.slot_start), locale)})
            </p>
          )}
          {loadingStaffPicker ? (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : staffPickerOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('booking.pickStaff.noStaff')}</p>
          ) : (
            <div className="flex flex-col gap-2 py-1">
              {staffPickerOptions.map((s) => (
                <button
                  key={s.staff_member_id}
                  onClick={() => handlePickStaff(s.staff_member_id)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors text-sm font-medium"
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
