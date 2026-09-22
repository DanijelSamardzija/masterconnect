'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, User } from 'lucide-react';

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  price_type: string;
};

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

export default function StaffNewBookingPage() {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const router = useRouter();
  const locale = { sr: 'sr-RS', en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' }[language] ?? 'en-US';

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [hasPermission, setHasPermission] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [staffName, setStaffName] = useState('');
  const [staffMemberId, setStaffMemberId] = useState('');

  const [serviceId, setServiceId] = useState('');
  const [week, setWeek] = useState<Date>(weekMonday(new Date()));
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [slotStart, setSlotStart] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [breaks, setBreaks]           = useState<Record<string, { break_start: string; break_end: string }>>({});
  const [staffAbsences, setStaffAbsences]   = useState<StaffAbsenceRow[]>([]);
  const [staffShiftDays, setStaffShiftDays] = useState<Record<string, StaffShiftDay>>({});

  const [guestName, setGuestName]   = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [notes, setNotes]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: sm } = await (supabase as any)
        .from('staff_members')
        .select('id, business_id, primary_location_id, permissions, user_id')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .in('role', ['worker', 'manager'])
        .limit(1)
        .maybeSingle();

      if (!sm || !sm.permissions?.can_create_bookings) {
        setLoading(false);
        return;
      }

      setHasPermission(true);
      setBusinessId(sm.business_id);
      setStaffMemberId(sm.id);
      setStaffName(profile.name ?? '');

      let locId = sm.primary_location_id;
      if (!locId) {
        const { data: loc } = await (supabase as any)
          .from('business_locations')
          .select('id, timezone')
          .eq('business_id', sm.business_id)
          .eq('is_active', true)
          .order('is_primary', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (loc) { locId = loc.id; setTimezone(loc.timezone ?? 'UTC'); }
      } else {
        const { data: loc } = await (supabase as any)
          .from('business_locations')
          .select('timezone')
          .eq('id', locId)
          .maybeSingle();
        if (loc?.timezone) setTimezone(loc.timezone);
      }
      if (locId) setLocationId(locId);

      const { data: svcs } = await (supabase as any)
        .from('service_catalog')
        .select('id, name, duration_minutes, price, price_type')
        .eq('business_id', sm.business_id)
        .eq('is_active', true)
        .order('name');

      const list = (svcs as Service[]) ?? [];
      setServices(list);
      if (list.length > 0) setServiceId(list[0].id);
      setLoading(false);
    })();
  }, [profile]);

  const fetchSlots = useCallback(async () => {
    if (!businessId || !locationId || !serviceId || !staffMemberId) return;
    setSlotsLoading(true);
    setSlots([]);
    setSlotStart('');
    const { data } = await (supabase as any).rpc('get_available_slots', {
      p_business_id:     businessId,
      p_location_id:     locationId,
      p_service_id:      serviceId,
      p_week_start:      toDateKey(week),
      p_staff_member_id: staffMemberId,
    });
    setSlots(data || []);
    setSlotsLoading(false);
  }, [businessId, locationId, serviceId, week, staffMemberId]);

  useEffect(() => {
    if (hasPermission && businessId && locationId && serviceId && staffMemberId) fetchSlots();
  }, [hasPermission, businessId, locationId, serviceId, week, staffMemberId, fetchSlots]);

  // Fetch breaks for the current week
  useEffect(() => {
    if (!staffMemberId) return;
    (supabase as any).rpc('public_get_week_breaks', {
      p_staff_member_id: staffMemberId,
      p_week_start:      toDateKey(week),
    }).then(({ data }: { data: { shift_date: string; break_start: string; break_end: string }[] | null }) => {
      const map: Record<string, { break_start: string; break_end: string }> = {};
      if (Array.isArray(data)) {
        data.forEach(b => { map[b.shift_date] = { break_start: b.break_start, break_end: b.break_end }; });
      }
      setBreaks(map);
    });
  }, [staffMemberId, week]);

  // Fetch staff absences (needed for day pill labels)
  useEffect(() => {
    if (!staffMemberId) { setStaffAbsences([]); return; }
    (supabase as any).rpc('public_get_staff_absences', { p_staff_member_id: staffMemberId })
      .then(({ data }: { data: StaffAbsenceRow[] | null }) => setStaffAbsences(data ?? []));
  }, [staffMemberId]);

  // Fetch staff shift schedule per week (for is_off / off_reason labels)
  useEffect(() => {
    if (!staffMemberId) { setStaffShiftDays({}); return; }
    (supabase as any).rpc('get_staff_schedule_for_client', {
      p_staff_member_id: staffMemberId,
      p_from_date: toDateKey(week),
      p_to_date: toDateKey(addDays(week, 6)),
    }).then(({ data }: { data: { schedule: { shift_date: string; is_off: boolean; off_reason: string | null }[] } | null }) => {
      const map: Record<string, StaffShiftDay> = {};
      if (data?.schedule && Array.isArray(data.schedule)) {
        data.schedule.forEach(d => { map[d.shift_date] = { is_off: d.is_off, off_reason: d.off_reason }; });
      }
      setStaffShiftDays(map);
    });
  }, [staffMemberId, week]);

  // Auto-select first available day, but keep current selection if it still has slots
  useEffect(() => {
    if (slotsLoading) return;
    const tz = timezone || 'UTC';
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
  }, [slots, slotsLoading, week, timezone, selectedDay]);

  async function handleSubmit() {
    if (!serviceId || !slotStart || !guestName.trim()) return;
    setSubmitting(true);
    const { data } = await (supabase as any).rpc('staff_create_booking', {
      p_service_id:  serviceId,
      p_starts_at:   slotStart,
      p_notes:       notes.trim()       || null,
      p_guest_name:  guestName.trim(),
      p_guest_phone: guestPhone.trim()  || null,
      p_guest_email: guestEmail.trim()  || null,
    });
    setSubmitting(false);
    if (!data?.ok) {
      const errKey = data?.error === 'staff_conflict'
        ? 'staffBooking.error.conflict'
        : data?.error === 'service_not_found'
        ? 'staffBooking.error.noService'
        : 'staffBooking.error.generic';
      toast.error(t(errKey as Parameters<typeof t>[0]));
      return;
    }
    toast.success(t('staffBooking.success'));
    if (data?.booking_id && guestEmail.trim()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        fetch('/api/booking/notify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ type: 'confirmation', booking_id: data.booking_id }),
        }).catch(() => {});
      });
    }
    router.push('/dashboard/staff/bookings');
  }

  // Group available slots by timezone-aware day key
  const tz = timezone || 'UTC';
  const slotsByDay: Record<string, Slot[]> = {};
  for (const s of slots) {
    if (!s.available) continue;
    const key = tzDateKey(s.slot_start, tz);
    if (!slotsByDay[key]) slotsByDay[key] = [];
    slotsByDay[key].push(s);
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const todayStr = toDateKey(new Date());

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-6">

          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.push('/dashboard/staff/bookings')}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">{t('staffBooking.title')}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{t('staffBooking.subtitle')}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !hasPermission ? (
            <div className="text-center py-12">
              <Plus className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t('staffBooking.noPermission')}</p>
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">{t('staffBooking.noServices')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">

              {/* Staff identity */}
              {staffName && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border/60">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{t('staffBooking.assignedTo')}</p>
                    <p className="text-sm font-medium text-foreground truncate">{staffName}</p>
                  </div>
                </div>
              )}

              {/* Service picker */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">{t('staffBooking.service')}</label>
                <div className="flex flex-col gap-2">
                  {services.map((svc) => (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => { setServiceId(svc.id); setSlotStart(''); }}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left ${
                        serviceId === svc.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-background hover:bg-accent'
                      }`}
                    >
                      <span className="text-sm font-medium">{svc.name}</span>
                      <span className="text-xs text-muted-foreground">{svc.duration_minutes} min</span>
                    </button>
                  ))}
                </div>
              </div>

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

              {/* Day selector — horizontal scroll pills matching client booking */}
              {slotsLoading ? (
                <div className="flex justify-center py-6">
                  <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                    {weekDays.map((day) => {
                      const dayKey = tzDateKey(day, tz);
                      const daySlots = slotsByDay[dayKey] ?? [];
                      const availableCount = daySlots.length;
                      const isSelected = selectedDay === dayKey;
                      const hasSlots = availableCount > 0;
                      const isPast = toDateKey(day) < todayStr;
                      const shortDay = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day);
                      let unavailLabel: string | null = null;
                      if (!hasSlots && !isPast) {
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
                              {availableCount}
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

                  {/* Slot grid */}
                  {!selectedDay || Object.keys(slotsByDay).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('staffBooking.noSlots')}
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
                      {t('staffBooking.noSlots')}
                    </p>
                  ) : null}
                </>
              )}

              {/* Guest details — shown after slot selected */}
              {slotStart && (
                <div className="space-y-2 border-t border-border pt-3">
                  <input
                    type="text"
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    placeholder={t('staffBooking.guestNamePlaceholder')}
                    required
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={e => setGuestPhone(e.target.value)}
                    placeholder={t('staffBooking.guestPhonePlaceholder')}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={e => setGuestEmail(e.target.value)}
                    placeholder={t('staffBooking.guestEmailPlaceholder')}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder={t('staffBooking.clientNotePlaceholder')}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting || !serviceId || !slotStart || !guestName.trim()}
                className="w-full py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 mt-1"
              >
                {submitting ? t('staffBooking.creating') : t('staffBooking.create')}
              </button>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
