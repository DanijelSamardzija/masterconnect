'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { langToLocale } from '@/lib/utils/locale';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, DollarSign } from 'lucide-react';

type ScheduleDay = {
  shift_date: string;
  is_off: boolean;
  off_reason: string | null;
  start_time: string | null;
  end_time: string | null;
  break_start: string | null;
  break_end: string | null;
};

type StaffInfo = {
  id: string;
  name: string;
  avatar_url: string | null;
  role: string;
};

type ServiceItem = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  price_type: string;
  currency: string | null;
};

function getMondayLocal(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const dow = copy.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function StaffProfilePage() {
  const { businessId, staffId } = useParams<{ businessId: string; staffId: string }>();
  const router = useRouter();
  const { t, language } = useLanguage();
  const locale = langToLocale(language);

  const [staff, setStaff] = useState<StaffInfo | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [scheduleMap, setScheduleMap] = useState<Record<string, ScheduleDay>>({});
  const [maxDate, setMaxDate] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayLocal(new Date()));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId || !staffId) return;
    (async () => {
      setLoading(true);
      try {
        // Staff info
        const { data: smData } = await supabase
          .from('staff_members')
          .select('id, role, user_id')
          .eq('id', staffId)
          .eq('is_active', true)
          .maybeSingle();

        if (!smData) { setLoading(false); return; }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .eq('id', smData.user_id)
          .maybeSingle();

        setStaff({
          id: staffId,
          name: profileData?.name ?? '',
          avatar_url: profileData?.avatar_url ?? null,
          role: smData.role,
        });

        // Services for this staff member
        const { data: svcData } = await (supabase as any).rpc('get_staff_services', {
          p_staff_member_id: staffId,
        });

        // get_staff_services returns array of UUID strings directly
        const svcIds: string[] = Array.isArray(svcData) ? svcData as string[] : [];
        if (svcIds.length > 0) {
          const { data: svcDetails } = await (supabase as any)
            .from('service_catalog')
            .select('id, name, duration_minutes, price, price_type, currency')
            .in('id', svcIds)
            .eq('business_id', businessId)
            .eq('is_active', true)
            .order('name');
          setServices((svcDetails as ServiceItem[]) ?? []);
        } else {
          // If no explicit services mapped, fetch all business services (staff does everything)
          const { data: allSvc } = await (supabase as any)
            .from('service_catalog')
            .select('id, name, duration_minutes, price, price_type, currency')
            .eq('business_id', businessId)
            .eq('is_active', true)
            .order('name');
          setServices((allSvc as ServiceItem[]) ?? []);
        }

        // Schedule: fetch from today to 13 weeks ahead
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const fromDate = isoLocal(today);
        const toDate = isoLocal(addDays(today, 13 * 7));
        const { data: schedData } = await (supabase as any).rpc('get_staff_schedule_for_client', {
          p_staff_member_id: staffId,
          p_from_date: fromDate,
          p_to_date: toDate,
        });

        if (schedData) {
          const map: Record<string, ScheduleDay> = {};
          for (const row of (schedData.schedule as ScheduleDay[]) ?? []) {
            map[row.shift_date] = row;
          }
          setScheduleMap(map);
          setMaxDate(schedData.max_date ?? null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [businessId, staffId]);

  const canGoPrev = useCallback(() => {
    const today = getMondayLocal(new Date());
    return weekStart > today;
  }, [weekStart]);

  const canGoNext = useCallback(() => {
    if (!maxDate) return false;
    const nextWeek = addDays(weekStart, 7);
    return isoLocal(nextWeek) <= maxDate;
  }, [weekStart, maxDate]);

  function formatPrice(svc: ServiceItem): string {
    if (svc.price_type === 'negotiable') return t('booking.priceNegotiable');
    if (!svc.price || svc.price === 0) return t('booking.priceFree');
    return `${svc.price.toLocaleString()} ${svc.currency ?? ''}`.trim();
  }

  function offLabel(reason: string | null): string {
    if (reason === 'vacation') return t('shift.vacation');
    if (reason === 'sick_leave') return t('shift.sickLeave');
    return t('shift.dayOff');
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const DAY_SHORT = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground text-sm">{t('booking.notFound')}</p>
        <button onClick={() => router.back()} className="text-primary underline text-sm">
          {t('booking.backToServices')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Back */}
        <button
          onClick={() => router.push(`/booking/${businessId}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('booking.backToServices')}
        </button>

        {/* Staff card */}
        <div className="border border-border rounded-xl px-4 py-4 flex items-center gap-3">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarImage src={staff.avatar_url ?? undefined} alt={staff.name} />
            <AvatarFallback className="text-base font-semibold">
              {staff.name[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold text-sm">{staff.name}</div>
            <div className="text-xs text-muted-foreground capitalize">{staff.role === 'owner' ? t('setup.staff.owner') : t('setup.staff.worker')}</div>
          </div>
        </div>

        {/* Schedule */}
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
            <span className="text-sm font-medium">{t('staffProfile.schedule')}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeekStart(w => addDays(w, -7))}
                disabled={!canGoPrev()}
                className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground min-w-[110px] text-center">
                {weekStart.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                {' – '}
                {addDays(weekStart, 6).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <button
                onClick={() => setWeekStart(w => addDays(w, 7))}
                disabled={!canGoNext()}
                className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {maxDate === null ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t('staffProfile.noSchedule')}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {weekDays.map((day) => {
                const iso = isoLocal(day);
                const shift = scheduleMap[iso];
                const dayName = DAY_SHORT[day.getDay()];
                const dateStr = day.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
                const isToday = iso === isoLocal(new Date());
                const isPast = day < getMondayLocal(new Date()) && !isToday;
                const beyondMax = maxDate && iso > maxDate;

                return (
                  <div
                    key={iso}
                    className={`flex items-center justify-between px-4 py-3 ${isToday ? 'bg-primary/5' : ''} ${isPast || beyondMax ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-16 shrink-0">
                        <div className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                          {dayName}
                        </div>
                        <div className="text-xs text-muted-foreground">{dateStr}</div>
                      </div>

                      {!shift ? (
                        <span className="text-xs text-muted-foreground/60 italic">—</span>
                      ) : shift.is_off ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {offLabel(shift.off_reason)}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                            {shift.start_time?.slice(0, 5)} – {shift.end_time?.slice(0, 5)}
                          </span>
                          {shift.break_start && shift.break_end && (
                            <span className="text-[11px] text-orange-500">
                              ☕ {shift.break_start.slice(0, 5)}–{shift.break_end.slice(0, 5)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {shift && !shift.is_off && !isPast && !beyondMax && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shrink-0">
                        {t('shift.working')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Services */}
        {services.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <span className="text-sm font-medium">{t('staffProfile.services')}</span>
            </div>
            <div className="divide-y divide-border">
              {services.map((svc) => (
                <Link
                  key={svc.id}
                  href={`/booking/${businessId}/${svc.id}?staffId=${staffId}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-accent/30 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{svc.name}</div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {t('booking.duration').replace('{min}', String(svc.duration_minutes))}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm font-medium shrink-0">{formatPrice(svc)}</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
