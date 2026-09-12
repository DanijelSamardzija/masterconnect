'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { ChevronRight, Clock, X } from 'lucide-react';

type DaySchedule = {
  is_closed:   boolean;
  start_time:  string;
  end_time:    string;
  has_break:   boolean;
  break_start: string;
  break_end:   string;
};

const DEFAULT_DAY: DaySchedule = {
  is_closed:   false,
  start_time:  '09:00',
  end_time:    '17:00',
  has_break:   false,
  break_start: '12:00',
  break_end:   '13:00',
};

const DOW_KEYS = [
  'setup.hours.day.1',
  'setup.hours.day.2',
  'setup.hours.day.3',
  'setup.hours.day.4',
  'setup.hours.day.5',
  'setup.hours.day.6',
  'setup.hours.day.0',
] as const;

const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];

const MONTH_KEYS = [
  'staffHours.month.0',
  'staffHours.month.1',
  'staffHours.month.2',
  'staffHours.month.3',
  'staffHours.month.4',
  'staffHours.month.5',
  'staffHours.month.6',
  'staffHours.month.7',
  'staffHours.month.8',
  'staffHours.month.9',
  'staffHours.month.10',
  'staffHours.month.11',
  'staffHours.month.12',
] as const;

function emptySchedule(): Record<number, DaySchedule> {
  return Object.fromEntries(DOW_ORDER.map((d) => [d, { ...DEFAULT_DAY }]));
}

function parseHours(hours: any[]): Record<number, DaySchedule> {
  const byDay: Record<number, Record<number, { start_time: string; end_time: string; is_closed: boolean }>> = {};
  for (const row of hours) {
    const dow = row.day_of_week;
    if (!byDay[dow]) byDay[dow] = {};
    byDay[dow][row.sort_order] = {
      is_closed:  row.is_closed,
      start_time: row.start_time?.slice(0, 5) ?? '09:00',
      end_time:   row.end_time?.slice(0, 5)   ?? '17:00',
    };
  }
  const loaded: Record<number, DaySchedule> = emptySchedule();
  for (const dow of DOW_ORDER) {
    const p0 = byDay[dow]?.[0];
    const p1 = byDay[dow]?.[1];
    if (!p0) continue;
    if (p1) {
      loaded[dow] = {
        is_closed:   p0.is_closed,
        start_time:  p0.start_time,
        break_start: p0.end_time,
        break_end:   p1.start_time,
        end_time:    p1.end_time,
        has_break:   true,
      };
    } else {
      loaded[dow] = {
        is_closed:   p0.is_closed,
        start_time:  p0.start_time,
        end_time:    p0.end_time,
        has_break:   false,
        break_start: '12:00',
        break_end:   '13:00',
      };
    }
  }
  return loaded;
}

export default function StaffHoursPage() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [staffMemberId, setStaffMemberId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [schedule, setSchedule] = useState<Record<number, DaySchedule>>(emptySchedule());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: sm } = await (supabase as any)
        .from('staff_members')
        .select('id, primary_location_id, permissions')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .in('role', ['worker', 'manager'])
        .limit(1)
        .maybeSingle();

      if (!sm) { setLoading(false); return; }

      setStaffMemberId(sm.id);
      const perm = !!sm.permissions?.can_set_hours;
      setHasPermission(perm);

      const locId = sm.primary_location_id;
      if (!locId) { setLoading(false); return; }
      setLocationId(locId);

      if (!perm) { setLoading(false); return; }

      await loadHours(sm.id, locId, 0);
      setLoading(false);
    })();
  }, [profile]);

  async function loadHours(smId: string, locId: string, month: number) {
    const { data: hours } = await (supabase as any).rpc('get_staff_opening_hours', {
      p_staff_member_id: smId,
      p_location_id: locId,
      p_month: month,
    });
    if (Array.isArray(hours) && hours.length > 0) {
      setSchedule(parseHours(hours));
    } else {
      setSchedule(emptySchedule());
    }
  }

  async function handleMonthChange(month: number) {
    setSelectedMonth(month);
    if (staffMemberId && locationId) {
      await loadHours(staffMemberId, locationId, month);
    }
  }

  async function handleSave() {
    if (!locationId) return;
    setSaving(true);
    let anyError = false;

    for (const dow of DOW_ORDER) {
      const day = schedule[dow];

      if (day.has_break && !day.is_closed) {
        const r0 = await (supabase as any).rpc('set_my_staff_hours', {
          p_location_id: locationId,
          p_day_of_week: dow,
          p_open_time:   day.start_time,
          p_close_time:  day.break_start,
          p_is_closed:   false,
          p_sort_order:  0,
          p_month:       selectedMonth,
        });
        if (!r0.data?.ok) anyError = true;
        const r1 = await (supabase as any).rpc('set_my_staff_hours', {
          p_location_id: locationId,
          p_day_of_week: dow,
          p_open_time:   day.break_end,
          p_close_time:  day.end_time,
          p_is_closed:   false,
          p_sort_order:  1,
          p_month:       selectedMonth,
        });
        if (!r1.data?.ok) anyError = true;
      } else {
        const r0 = await (supabase as any).rpc('set_my_staff_hours', {
          p_location_id: locationId,
          p_day_of_week: dow,
          p_open_time:   day.start_time,
          p_close_time:  day.end_time,
          p_is_closed:   day.is_closed,
          p_sort_order:  0,
          p_month:       selectedMonth,
        });
        if (!r0.data?.ok) anyError = true;
        await (supabase as any).rpc('delete_my_staff_hour_period', {
          p_location_id: locationId,
          p_day_of_week: dow,
          p_sort_order:  1,
          p_month:       selectedMonth,
        });
      }
    }

    setSaving(false);
    if (anyError) {
      toast.error(t('staffHours.saveError'));
    } else {
      toast.success(t('staffHours.saved'));
    }
  }

  function updateDay(dow: number, patch: Partial<DaySchedule>) {
    setSchedule((prev) => ({ ...prev, [dow]: { ...prev[dow], ...patch } }));
  }

  function toggleBreak(dow: number) {
    setSchedule((prev) => {
      const day = prev[dow];
      if (day.has_break) {
        return { ...prev, [dow]: { ...day, has_break: false } };
      } else {
        return { ...prev, [dow]: { ...day, has_break: true, break_start: '12:00', break_end: '13:00' } };
      }
    });
  }

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
              <h1 className="text-xl font-semibold">{t('staffHours.title')}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{t('staffHours.subtitle')}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !hasPermission ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t('staffHours.noPermission')}</p>
            </div>
          ) : !locationId ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">{t('staffHours.noLocation')}</p>
            </div>
          ) : (
            <>
              {/* Month selector */}
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2">{t('staffHours.selectMonth')}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {MONTH_KEYS.map((key, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleMonthChange(idx)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        selectedMonth === idx
                          ? 'bg-primary text-white'
                          : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
                {selectedMonth > 0 && (
                  <p className="text-[11px] text-primary mt-1.5">
                    {t('staffHours.monthOverrideNote')}
                  </p>
                )}
              </div>

              <div className="border border-border rounded-xl overflow-hidden mb-5">
                {DOW_ORDER.map((dow, idx) => {
                  const day = schedule[dow];
                  const labelKey = DOW_KEYS[idx];
                  const timeCls = "border border-border rounded-lg px-2 py-1 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary w-28";
                  return (
                    <div
                      key={dow}
                      className={`flex flex-col gap-2 p-4 ${idx > 0 ? 'border-t border-border' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium w-28">{t(labelKey)}</span>
                        <button
                          type="button"
                          onClick={() => updateDay(dow, { is_closed: !day.is_closed })}
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full transition-colors ${
                            day.is_closed
                              ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                              : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900'
                          }`}
                        >
                          {day.is_closed ? t('setup.hours.closed') : t('setup.hours.open')}
                        </button>
                      </div>

                      {!day.is_closed && (
                        <div className="flex flex-col gap-1.5 pl-28">
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              type="time"
                              value={day.start_time}
                              onChange={(e) => updateDay(dow, { start_time: e.target.value })}
                              className={timeCls}
                            />
                            <span className="text-muted-foreground text-xs">–</span>
                            <input
                              type="time"
                              value={day.end_time}
                              onChange={(e) => updateDay(dow, { end_time: e.target.value })}
                              className={timeCls}
                            />
                            {!day.has_break && (
                              <button
                                type="button"
                                onClick={() => toggleBreak(dow)}
                                className="text-[11px] font-medium text-primary/70 hover:text-primary transition-colors px-1.5 py-0.5 rounded border border-primary/20 hover:border-primary/50"
                              >
                                + {t('bookingSetup.hours.addSecondPeriod')}
                              </button>
                            )}
                          </div>

                          {day.has_break && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] text-muted-foreground w-12 shrink-0">
                                {t('bookingSetup.hours.break')}
                              </span>
                              <input
                                type="time"
                                value={day.break_start}
                                onChange={(e) => updateDay(dow, { break_start: e.target.value })}
                                className={timeCls}
                              />
                              <span className="text-muted-foreground text-xs">–</span>
                              <input
                                type="time"
                                value={day.break_end}
                                onChange={(e) => updateDay(dow, { break_end: e.target.value })}
                                className={timeCls}
                              />
                              <button
                                type="button"
                                onClick={() => toggleBreak(dow)}
                                className="text-[11px] font-medium text-destructive/60 hover:text-destructive transition-colors flex items-center gap-0.5"
                              >
                                <X className="w-3 h-3" />
                                {t('bookingSetup.hours.removeSecondPeriod')}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground mb-5">{t('staffHours.note')}</p>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {saving ? t('staffHours.saving') : t('staffHours.save')}
              </button>
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
