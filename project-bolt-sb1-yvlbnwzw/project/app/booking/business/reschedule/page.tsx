'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';

type Slot            = { slot_start: string; slot_end: string; available: boolean };
type StaffAbsenceRow = { date_from: string; date_to: string; reason: string };
type StaffShiftDay   = { is_off: boolean; off_reason: string | null };

function weekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - (day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function tzDateKey(isoOrDate: string | Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate);
}

function BusinessRescheduleContent() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = { sr: 'sr-RS', en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' }[language] ?? 'en-US';

  const bookingId  = searchParams.get('bookingId')  ?? '';
  const serviceId  = searchParams.get('serviceId')  ?? '';
  const staffId    = searchParams.get('staffId')    ?? '';
  const locationId = searchParams.get('locationId') ?? '';
  const businessId = searchParams.get('businessId') ?? '';
  const tz         = searchParams.get('tz')         ?? 'UTC';
  const role       = searchParams.get('role')       ?? 'owner'; // 'owner' | 'staff'

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [week, setWeek]             = useState<Date>(weekMonday(new Date()));
  const [selectedDay, setSelectedDay] = useState('');
  const [slotStart, setSlotStart]   = useState('');
  const [slots, setSlots]           = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [breaks, setBreaks]         = useState<Record<string, { break_start: string; break_end: string }>>({});
  const [staffAbsences, setStaffAbsences]   = useState<StaffAbsenceRow[]>([]);
  const [staffShiftDays, setStaffShiftDays] = useState<Record<string, StaffShiftDay>>({});
  const [confirming, setConfirming] = useState(false);

  // Fetch available slots for the week
  useEffect(() => {
    if (!businessId || !locationId || !serviceId || !staffId) return;
    setSlotsLoading(true);
    setSlots([]);
    setSlotStart('');
    (supabase as any).rpc('get_available_slots', {
      p_business_id:     businessId,
      p_location_id:     locationId,
      p_service_id:      serviceId,
      p_week_start:      toDateKey(week),
      p_staff_member_id: staffId,
    }).then(({ data }: { data: Slot[] | null }) => {
      setSlots(data || []);
      setSlotsLoading(false);
    });
  }, [businessId, locationId, serviceId, staffId, week]);

  // Fetch breaks for the week
  useEffect(() => {
    if (!staffId) { setBreaks({}); return; }
    (supabase as any).rpc('public_get_week_breaks', {
      p_staff_member_id: staffId,
      p_week_start:      toDateKey(week),
    }).then(({ data }: { data: { shift_date: string; break_start: string; break_end: string }[] | null }) => {
      const map: Record<string, { break_start: string; break_end: string }> = {};
      if (Array.isArray(data)) {
        data.forEach(b => { map[b.shift_date] = { break_start: b.break_start, break_end: b.break_end }; });
      }
      setBreaks(map);
    });
  }, [staffId, week]);

  // Fetch staff absences
  useEffect(() => {
    if (!staffId) { setStaffAbsences([]); return; }
    (supabase as any).rpc('public_get_staff_absences', { p_staff_member_id: staffId })
      .then(({ data }: { data: StaffAbsenceRow[] | null }) => setStaffAbsences(data ?? []));
  }, [staffId]);

  // Fetch shift schedule per week (for is_off / off_reason labels on day pills)
  useEffect(() => {
    if (!staffId) { setStaffShiftDays({}); return; }
    (supabase as any).rpc('get_staff_schedule_for_client', {
      p_staff_member_id: staffId,
      p_from_date: toDateKey(week),
      p_to_date: toDateKey(addDays(week, 6)),
    }).then(({ data }: { data: { schedule: { shift_date: string; is_off: boolean; off_reason: string | null }[] } | null }) => {
      const map: Record<string, StaffShiftDay> = {};
      if (data?.schedule && Array.isArray(data.schedule)) {
        data.schedule.forEach(d => { map[d.shift_date] = { is_off: d.is_off, off_reason: d.off_reason }; });
      }
      setStaffShiftDays(map);
    });
  }, [staffId, week]);

  // Auto-select first available day, preserve current if it still has slots
  useEffect(() => {
    if (slotsLoading) return;
    if (selectedDay) {
      const stillHasSlots = slots.some(s => s.available && tzDateKey(s.slot_start, tz) === selectedDay);
      if (stillHasSlots) return;
    }
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(week, i));
    for (const d of weekDays) {
      const key = tzDateKey(d, tz);
      if (slots.some(s => s.available && tzDateKey(s.slot_start, tz) === key)) {
        setSelectedDay(key); return;
      }
    }
    setSelectedDay('');
  }, [slots, slotsLoading, week, tz, selectedDay]);

  async function handleConfirm() {
    if (!bookingId || !slotStart) return;
    setConfirming(true);
    const rpcName = role === 'staff' ? 'staff_reschedule_booking' : 'owner_reschedule_booking';
    const { data, error } = await (supabase as any).rpc(rpcName, {
      p_booking_id:    bookingId,
      p_new_starts_at: slotStart,
    });
    setConfirming(false);
    if (error || data?.ok === false) {
      const key = data?.error === 'conflict'
        ? 'ownerBookings.rescheduleError.conflict'
        : 'ownerBookings.rescheduleError.tooSoon';
      toast.error(t(key as Parameters<typeof t>[0]));
      return;
    }
    toast.success(t('ownerBookings.rescheduled'));
    fetch('/api/booking/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'reschedule', booking_id: bookingId }),
    }).catch(() => {});
    router.push('/booking/business/bookings');
  }

  const slotsByDay: Record<string, Slot[]> = {};
  for (const s of slots) {
    if (!s.available) continue;
    const key = tzDateKey(s.slot_start, tz);
    if (!slotsByDay[key]) slotsByDay[key] = [];
    slotsByDay[key].push(s);
  }

  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const todayStr  = toDateKey(new Date());

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-6">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.push('/booking/business/bookings')}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              {t('ownerBookings.rescheduleModal.title')}
            </h1>
          </div>

          <div className="flex flex-col gap-5">

            {/* Week navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setWeek(w => addDays(w, -7)); setSlotStart(''); }}
                disabled={toDateKey(week) <= todayStr}
                className="p-2 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium text-foreground">
                {weekDays[0].toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                {' – '}
                {weekDays[6].toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
              </span>
              <button
                onClick={() => { setWeek(w => addDays(w, 7)); setSlotStart(''); }}
                className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Day pills + slot grid */}
            {slotsLoading ? (
              <div className="flex justify-center py-6">
                <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                  {weekDays.map((day) => {
                    const dayKey = tzDateKey(day, tz);
                    const count = (slotsByDay[dayKey] ?? []).length;
                    const isSelected = selectedDay === dayKey;
                    const hasSlots = count > 0;
                    const isPast = toDateKey(day) < todayStr;
                    const shortDay = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day);
                    let unavailLabel: string | null = null;
                    if (!hasSlots && !isPast && staffId) {
                      const dayAbsence = staffAbsences.find(a => a.date_from <= dayKey && a.date_to >= dayKey);
                      const dayShift = staffShiftDays[dayKey];
                      if (dayAbsence) {
                        unavailLabel = dayAbsence.reason === 'vacation' ? t('shift.vacation')
                          : dayAbsence.reason === 'sick_leave' ? t('shift.sickLeave')
                          : t('booking.staffUnavailable');
                      } else if (dayShift?.is_off) {
                        unavailLabel = dayShift.off_reason === 'vacation' ? t('shift.vacation')
                          : dayShift.off_reason === 'sick_leave' ? t('shift.sickLeave')
                          : t('shift.dayOff');
                      }
                    }
                    return (
                      <button
                        key={dayKey}
                        type="button"
                        onClick={() => { if (hasSlots) { setSelectedDay(dayKey); setSlotStart(''); } }}
                        disabled={!hasSlots}
                        className={`flex flex-col items-center shrink-0 w-14 py-2.5 rounded-xl border transition-colors ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : hasSlots
                              ? 'border-border hover:border-primary/60 hover:bg-accent'
                              : isPast
                                ? 'border-border/40 opacity-25 cursor-not-allowed'
                                : 'border-border opacity-35 cursor-not-allowed'
                        }`}
                      >
                        <span className={`text-[10px] font-medium uppercase tracking-wide ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                          {shortDay}
                        </span>
                        <span className="text-lg font-bold leading-tight mt-0.5">{day.getDate()}</span>
                        {hasSlots ? (
                          <span className={`text-[10px] font-medium mt-1 ${isSelected ? 'text-primary-foreground/70' : 'text-primary'}`}>
                            {count}
                          </span>
                        ) : unavailLabel ? (
                          <span className="text-[9px] text-orange-500 mt-1 leading-tight text-center">{unavailLabel}</span>
                        ) : (
                          <span className="text-[10px] mt-1 opacity-0">·</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Slot grid with break divider */}
                {!selectedDay || Object.keys(slotsByDay).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('ownerBookings.add.noSlots')}
                  </p>
                ) : selectedDay && slotsByDay[selectedDay]?.length > 0 ? (
                  (() => {
                    const daySlots = slotsByDay[selectedDay];
                    const dayBreak = breaks[selectedDay];
                    const fmt = (iso: string) => new Intl.DateTimeFormat('en-GB', {
                      hour: '2-digit', minute: '2-digit', timeZone: tz,
                    }).format(new Date(iso));
                    const breakStart = dayBreak?.break_start.slice(0, 5);
                    const breakEnd   = dayBreak?.break_end.slice(0, 5);
                    const before = dayBreak ? daySlots.filter(s => fmt(s.slot_start) < breakStart!) : daySlots;
                    const after  = dayBreak ? daySlots.filter(s => fmt(s.slot_start) >= breakEnd!)  : [];
                    const SlotBtn = ({ sl }: { sl: Slot }) => {
                      const timeStr = new Intl.DateTimeFormat(undefined, {
                        hour: '2-digit', minute: '2-digit', timeZone: tz,
                      }).format(new Date(sl.slot_start));
                      const isChosen = slotStart === sl.slot_start;
                      return (
                        <button
                          onClick={() => setSlotStart(sl.slot_start)}
                          className={`py-3 rounded-xl text-sm font-medium transition-colors ${
                            isChosen ? 'bg-primary text-primary-foreground' : 'bg-primary/10 hover:bg-primary/20 text-primary'
                          }`}
                        >
                          {timeStr}
                        </button>
                      );
                    };
                    return (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {before.map(sl => <SlotBtn key={sl.slot_start} sl={sl} />)}
                        {dayBreak && after.length > 0 && (
                          <div className="col-span-3 sm:col-span-4 flex items-center gap-2 py-1">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[11px] text-orange-500 font-medium whitespace-nowrap">
                              {t('schedule.break')} {breakStart}–{breakEnd}
                            </span>
                            <div className="flex-1 h-px bg-border" />
                          </div>
                        )}
                        {after.map(sl => <SlotBtn key={sl.slot_start} sl={sl} />)}
                      </div>
                    );
                  })()
                ) : selectedDay ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('ownerBookings.add.noSlots')}
                  </p>
                ) : null}
              </>
            )}

            <button
              onClick={handleConfirm}
              disabled={confirming || !slotStart}
              className="w-full py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 mt-1"
            >
              {confirming ? '...' : t('ownerBookings.rescheduleModal.confirm')}
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function BusinessReschedulePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BusinessRescheduleContent />
    </Suspense>
  );
}
