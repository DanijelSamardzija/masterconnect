'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingAccess } from '@/lib/hooks/use-booking-access';
import { BookingBetaBanner } from '@/components/booking-beta-banner';
import { toast } from 'sonner';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Clock, Users,
  Check, Calendar, X
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

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function weekStart(d: Date): string {
  // Use local date components to avoid UTC/local timezone mismatch for UTC+ users.
  // toISOString() returns UTC date which can be one day behind the local date.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  const { t } = useLanguage();
  const { user } = useAuth();
  const { hasAccess, loading: authLoading } = useBookingAccess();

  const [business, setBusiness] = useState<Business | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedTimezone, setSelectedTimezone] = useState<string>('UTC');

  const [weekDate, setWeekDate] = useState<Date>(() => startOfDay(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null); // null = "any"
  const [loadingStaff, setLoadingStaff] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    if (!businessId || !serviceId) return;
    async function loadMeta() {
      setLoadingMeta(true);
      try {
        const [bizRes, svcRes, locRes] = await Promise.all([
          supabase.from('profiles').select('id, name').eq('id', businessId).eq('is_business', true).maybeSingle(),
          (supabase as any).from('service_catalog').select('id, name, description, duration_minutes, capacity, price, price_type, currency').eq('id', serviceId).eq('business_id', businessId).eq('is_active', true).maybeSingle(),
          supabase.from('business_locations').select('id, name, timezone, is_primary').eq('business_id', businessId).eq('is_active', true).order('is_primary', { ascending: false }),
        ]);
        setBusiness(bizRes.data ?? null);
        setService((svcRes.data as Service) ?? null);
        const locs = locRes.data ?? [];
        setLocations(locs);
        if (locs.length > 0) {
          const primary = locs.find((l: Location) => l.is_primary) ?? locs[0];
          setSelectedLocationId(primary.id);
          setSelectedTimezone(primary.timezone);
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
      setSelectedStaffId(null);
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
      const { data } = await (supabase as any).rpc('get_available_slots', {
        p_business_id: businessId,
        p_location_id: selectedLocationId,
        p_service_id: serviceId,
        p_week_start: ws,
        ...(selectedStaffId ? { p_staff_member_id: selectedStaffId } : {}),
      });
      setSlots((data as Slot[]) ?? []);
    } finally {
      setLoadingSlots(false);
    }
  }, [businessId, serviceId, selectedLocationId, selectedStaffId, weekDate]);

  useEffect(() => {
    if (!loadingMeta && selectedLocationId) {
      loadSlots();
      loadStaff(selectedLocationId);
    }
  }, [loadingMeta, selectedLocationId, weekDate, loadSlots, loadStaff]);

  function onLocationChange(locId: string) {
    const loc = locations.find((l) => l.id === locId);
    if (!loc) return;
    setSelectedLocationId(locId);
    setSelectedTimezone(loc.timezone);
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
    if (!hasAccess) { router.push('/login'); return; }
    setBooking(true);
    const { data } = await (supabase as any).rpc('create_booking', {
      p_business_id: businessId,
      p_location_id: selectedLocationId,
      p_service_id: serviceId,
      p_starts_at: selectedSlot.slot_start,
      p_party_size: partySize,
      p_notes: notes.trim() || null,
      ...(selectedStaffId ? { p_staff_member_id: selectedStaffId } : {}),
    });
    setBooking(false);
    const result = data as { ok: boolean; error?: string; status?: string } | null;
    if (!result?.ok) {
      toast.error(t(bookingErrorKey(result?.error ?? '') as Parameters<typeof t>[0]));
      return;
    }
    setBooked(true);
    setDialogOpen(false);
    const msg = result.status === 'confirmed' ? t('booking.successConfirmed') : t('booking.successPending');
    toast.success(msg);
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
        <Button variant="outline" onClick={() => router.push('/dashboard/bookings')}>
          {t('booking.myBookings')}
        </Button>
      </div>
    );
  }

  const todayStr = weekStart(startOfDay(new Date()));

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
          <p className="text-sm text-muted-foreground mt-0.5">{business.name}</p>
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
            <select
              value={selectedLocationId}
              onChange={(e) => onLocationChange(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Staff selection */}
        {!loadingStaff && staffOptions.length > 0 && (
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
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setWeekDate((d) => addDays(d, -7))}
            disabled={weekStart(weekDate) <= todayStr}
            className="p-2 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label={t('booking.prevWeek')}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium">
            {formatDate(weekDays[0])} – {formatDate(weekDays[6])}
          </span>
          <button
            onClick={() => setWeekDate((d) => addDays(d, 7))}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            aria-label={t('booking.nextWeek')}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {loadingSlots ? (
          <div className="text-center py-12 text-muted-foreground text-sm">{t('booking.loadingSlots')}</div>
        ) : slots.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">{t('booking.noSlotsThisWeek')}</div>
        ) : (
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
                  <div className={`text-center text-xs font-medium pb-1 ${isPast ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}>
                    <div>{dayLabel}</div>
                    <div>{day.getDate()}</div>
                  </div>
                  {daySlots
                    .filter((s) => s.available)
                    .map((s) => (
                      <button
                        key={s.slot_start}
                        onClick={() => {
                          if (!user) { router.push('/login'); return; }
                          if (!hasAccess) return;
                          setSelectedSlot(s);
                          setNotes('');
                          setPartySize(1);
                          setDialogOpen(true);
                        }}
                        disabled={!hasAccess && !authLoading}
                        className="text-xs py-1.5 px-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors text-center w-full disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {formatTime(s.slot_start, selectedTimezone)}
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                {' '}({formatDate(new Date(selectedSlot.slot_start))})
              </div>

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
                <Button className="flex-1" onClick={handleBook} disabled={booking}>
                  {booking ? t('booking.booking') : t('booking.book')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
