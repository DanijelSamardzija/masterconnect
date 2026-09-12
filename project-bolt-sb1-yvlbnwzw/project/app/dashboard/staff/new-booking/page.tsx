'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  price_type: string;
};

type Slot = { slot_start: string; slot_end: string; available: boolean };

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
  return d.toISOString().slice(0, 10);
}

export default function StaffNewBookingPage() {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const router = useRouter();
  const locale = { sr: 'sr-RS', en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' }[language] ?? 'en-US';

  const [hasPermission, setHasPermission] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState('');
  const [locationId, setLocationId] = useState('');

  const [serviceId, setServiceId] = useState('');
  const [week, setWeek] = useState<Date>(weekMonday(new Date()));
  const [selectedDay, setSelectedDay] = useState<string>(toDateKey(new Date()));
  const [slotStart, setSlotStart] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: sm } = await (supabase as any)
        .from('staff_members')
        .select('id, business_id, primary_location_id, permissions')
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

      // If no primary_location_id on staff member, fall back to business primary location
      if (sm.primary_location_id) {
        setLocationId(sm.primary_location_id);
      } else {
        const { data: loc } = await (supabase as any)
          .from('business_locations')
          .select('id')
          .eq('business_id', sm.business_id)
          .eq('is_active', true)
          .order('is_primary', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (loc) setLocationId(loc.id);
      }

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
    if (!businessId || !locationId || !serviceId) return;
    setSlotsLoading(true);
    setSlots([]);
    setSlotStart('');
    const { data } = await (supabase as any).rpc('get_available_slots', {
      p_business_id: businessId,
      p_location_id: locationId,
      p_service_id:  serviceId,
      p_week_start:  toDateKey(week),
    });
    setSlots(data || []);
    setSlotsLoading(false);
  }, [businessId, locationId, serviceId, week]);

  useEffect(() => {
    if (hasPermission && businessId && locationId && serviceId) fetchSlots();
  }, [hasPermission, businessId, locationId, serviceId, week, fetchSlots]);

  async function handleSubmit() {
    if (!serviceId || !slotStart || !guestName.trim()) return;
    setSubmitting(true);
    const { data } = await (supabase as any).rpc('staff_create_booking', {
      p_service_id:  serviceId,
      p_starts_at:   slotStart,
      p_notes:       notes.trim() || null,
      p_guest_name:  guestName.trim(),
      p_guest_phone: guestPhone.trim() || null,
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
    router.push('/dashboard/staff/bookings');
  }

  // Group available slots by day key
  const slotsByDay: Record<string, Slot[]> = {};
  for (const s of slots) {
    const key = s.slot_start.slice(0, 10);
    if (!slotsByDay[key]) slotsByDay[key] = [];
    if (s.available) slotsByDay[key].push(s);
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const DAY_NAMES = weekDays.map(d =>
    d.toLocaleDateString(locale, { weekday: 'short' }).replace(/\.$/, '')
  );

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-6">

          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.push('/dashboard/staff/bookings')}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
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
              <Plus className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t('staffBooking.noPermission')}</p>
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">{t('staffBooking.noServices')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">

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
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-semibold text-foreground">
                  {week.toLocaleDateString(locale, { day: 'numeric', month: 'long' })}
                  {' – '}
                  {addDays(week, 6).toLocaleDateString(locale, { day: 'numeric', month: 'long' })}
                </span>
                <button
                  onClick={() => { setWeek(w => addDays(w, 7)); setSlotStart(''); }}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Day tabs */}
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day, i) => {
                  const key = toDateKey(day);
                  const hasSlots = (slotsByDay[key]?.length || 0) > 0;
                  const isSelected = selectedDay === key;
                  const isToday = toDateKey(new Date()) === key;
                  return (
                    <button
                      key={key}
                      onClick={() => { setSelectedDay(key); setSlotStart(''); }}
                      disabled={!hasSlots && !isSelected}
                      className={`flex flex-col items-center py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
                        isSelected
                          ? 'bg-primary text-white'
                          : hasSlots
                          ? 'bg-muted text-foreground hover:bg-primary/10'
                          : 'bg-muted/40 text-muted-foreground cursor-default'
                      }`}
                    >
                      <span>{DAY_NAMES[i]}</span>
                      <span className={`text-xs font-bold ${isToday && !isSelected ? 'text-primary' : ''}`}>
                        {day.getDate()}
                      </span>
                      {hasSlots && !isSelected && (
                        <span className="w-1 h-1 rounded-full bg-primary mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Slot grid */}
              {slotsLoading ? (
                <div className="flex justify-center py-4">
                  <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : selectedDay && (slotsByDay[selectedDay]?.length || 0) === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  {t('staffBooking.noSlots')}
                </p>
              ) : selectedDay && slotsByDay[selectedDay] ? (
                <div className="grid grid-cols-4 gap-1.5">
                  {slotsByDay[selectedDay].map(sl => {
                    const timeStr = new Date(sl.slot_start).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
                    const isChosen = slotStart === sl.slot_start;
                    return (
                      <button
                        key={sl.slot_start}
                        onClick={() => setSlotStart(sl.slot_start)}
                        className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          isChosen
                            ? 'bg-primary text-white'
                            : 'bg-muted text-foreground hover:bg-primary/10'
                        }`}
                      >
                        {timeStr}
                      </button>
                    );
                  })}
                </div>
              ) : null}

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
