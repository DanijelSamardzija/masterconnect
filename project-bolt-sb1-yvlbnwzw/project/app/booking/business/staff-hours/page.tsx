'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { ChevronLeft, Users, X, Info, ChevronRight } from 'lucide-react';

type StaffMember = { id: string; name: string; primary_location_id: string | null; accept_bookings: boolean; role: string };

type DaySchedule = {
  is_closed:   boolean;
  start_time:  string;
  end_time:    string;
  has_break:   boolean;
  break_start: string;
  break_end:   string;
};

type WeekShift = {
  shift_date:             string;
  start_time:             string | null;
  end_time:               string | null;
  is_off:                 boolean;
  break_start:            string | null;
  break_end:              string | null;
  is_template_generated:  boolean;
};

const DEFAULT_DAY: DaySchedule = {
  is_closed:   true,
  start_time:  '09:00',
  end_time:    '17:00',
  has_break:   false,
  break_start: '12:00',
  break_end:   '13:00',
};

// 0=Mon, 1=Tue, ..., 6=Sun
const DOW_KEYS = [
  'setup.hours.day.1',
  'setup.hours.day.2',
  'setup.hours.day.3',
  'setup.hours.day.4',
  'setup.hours.day.5',
  'setup.hours.day.6',
  'setup.hours.day.0',
] as const;

function getMondayOf(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const sm = months[weekStart.getMonth()];
  const em = months[weekEnd.getMonth()];
  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${weekStart.getDate()}–${weekEnd.getDate()} ${sm}`;
  }
  return `${weekStart.getDate()} ${sm} – ${weekEnd.getDate()} ${em}`;
}

function emptySchedule(): Record<number, DaySchedule> {
  return Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(d => [d, { ...DEFAULT_DAY }]));
}

function shiftsToSchedule(weekStart: Date, shifts: WeekShift[]): Record<number, DaySchedule> {
  const byDate: Record<string, WeekShift> = {};
  for (const s of shifts) byDate[s.shift_date] = s;

  return Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6].map(dow => {
      const date = isoDate(addDays(weekStart, dow));
      const s = byDate[date];
      if (!s) return [dow, { ...DEFAULT_DAY }];
      const hasBreak = !!(s.break_start && s.break_end);
      return [dow, {
        is_closed:   s.is_off,
        start_time:  s.start_time?.slice(0, 5) ?? '09:00',
        end_time:    s.end_time?.slice(0, 5)   ?? '17:00',
        has_break:   hasBreak,
        break_start: s.break_start?.slice(0, 5) ?? '12:00',
        break_end:   s.break_end?.slice(0, 5)   ?? '13:00',
      } satisfies DaySchedule];
    })
  );
}

function weekIsExplicit(weekStart: Date, shifts: WeekShift[]): boolean {
  const dates = new Set(
    [0, 1, 2, 3, 4, 5, 6].map(d => isoDate(addDays(weekStart, d)))
  );
  return shifts.some(s => dates.has(s.shift_date) && !s.is_template_generated);
}

function OwnerStaffHoursContent() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const weeks = useMemo(() => {
    const monday = getMondayOf(new Date());
    return Array.from({ length: 13 }, (_, i) => addDays(monday, i * 7));
  }, []);

  const [staffList,      setStaffList]      = useState<StaffMember[]>([]);
  const [locationId,     setLocationId]     = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedWeek,   setSelectedWeek]   = useState<number>(0);
  const [allShifts,      setAllShifts]      = useState<WeekShift[]>([]);
  const [schedule,       setSchedule]       = useState<Record<number, DaySchedule>>(emptySchedule());
  const [loading,        setLoading]        = useState(true);
  const [shiftsLoading,  setShiftsLoading]  = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [isOwner,        setIsOwner]        = useState(false);
  const [infoOpen,       setInfoOpen]       = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: ownerSm } = await (supabase as any)
        .from('staff_members')
        .select('role, business_id')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .in('role', ['owner', 'manager'])
        .limit(1)
        .maybeSingle();

      if (!ownerSm) { setLoading(false); return; }
      setIsOwner(true);

      const { data: loc } = await (supabase as any)
        .from('business_locations')
        .select('id')
        .eq('business_id', ownerSm.business_id)
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (loc) setLocationId(loc.id);

      const { data: staff } = await (supabase as any)
        .from('staff_members')
        .select('id, primary_location_id, accept_bookings, role, profiles!staff_members_user_id_fkey(name)')
        .eq('business_id', ownerSm.business_id)
        .eq('is_active', true)
        .in('role', ['worker', 'manager', 'owner']);

      if (staff && staff.length > 0) {
        const list = staff.map((s: any) => ({
          id:                  s.id,
          name:                s.profiles?.name || '—',
          primary_location_id: s.primary_location_id,
          accept_bookings:     s.accept_bookings ?? true,
          role:                s.role,
        }));
        setStaffList(list);
        setSelectedStaffId(list[0].id);
        const locId = loc?.id || list[0].primary_location_id || '';
        if (locId) await loadShifts(list[0].id, locId);
      }

      setLoading(false);
    })();
  }, [profile]);

  // When week changes, re-derive schedule from allShifts
  useEffect(() => {
    setSchedule(shiftsToSchedule(weeks[selectedWeek], allShifts));
  }, [selectedWeek, allShifts, weeks]);

  async function loadShifts(smId: string, locId: string) {
    setShiftsLoading(true);
    const from = isoDate(weeks[0]);
    const to   = isoDate(addDays(weeks[12], 6));
    const { data } = await (supabase as any).rpc('owner_get_staff_shifts_range', {
      p_staff_member_id: smId,
      p_from_date:       from,
      p_to_date:         to,
    });
    setAllShifts(Array.isArray(data) ? data : []);
    setShiftsLoading(false);
  }

  async function handleToggleAcceptBookings(smId: string, current: boolean) {
    const newVal = !current;
    const { data } = await (supabase as any).rpc('set_accept_bookings', {
      p_staff_member_id: smId,
      p_accept: newVal,
    });
    if (data?.ok) {
      setStaffList(prev => prev.map(s => s.id === smId ? { ...s, accept_bookings: newVal } : s));
    } else {
      toast.error('Greška');
    }
  }

  async function handleStaffChange(smId: string) {
    setSelectedStaffId(smId);
    setSelectedWeek(0);
    const locId = locationId;
    if (locId) await loadShifts(smId, locId);
  }

  async function handleSave() {
    if (!selectedStaffId || !locationId) return;
    setSaving(true);

    const weekStart = weeks[selectedWeek];
    const days = [0, 1, 2, 3, 4, 5, 6].map(dow => {
      const day = schedule[dow];
      return {
        day_of_week: dow,
        start_time:  day.is_closed ? null : day.start_time,
        end_time:    day.is_closed ? null : day.end_time,
        is_off:      day.is_closed,
        break_start: day.is_closed || !day.has_break ? null : day.break_start,
        break_end:   day.is_closed || !day.has_break ? null : day.break_end,
      };
    });

    const { data } = await (supabase as any).rpc('owner_save_week_schedule', {
      p_staff_member_id: selectedStaffId,
      p_location_id:     locationId,
      p_week_start:      isoDate(weekStart),
      p_days:            days,
    });

    setSaving(false);

    if (data?.ok) {
      toast.success(t('staffHours.saved'));
      await loadShifts(selectedStaffId, locationId);
    } else {
      toast.error(t('staffHours.saveError'));
    }
  }

  function updateDay(dow: number, patch: Partial<DaySchedule>) {
    setSchedule(prev => ({ ...prev, [dow]: { ...prev[dow], ...patch } }));
  }

  function toggleBreak(dow: number) {
    setSchedule(prev => {
      const day = prev[dow];
      return day.has_break
        ? { ...prev, [dow]: { ...day, has_break: false } }
        : { ...prev, [dow]: { ...day, has_break: true, break_start: '12:00', break_end: '13:00' } };
    });
  }

  if (!isOwner && !loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('ownerBookings.noPermission')}</p>
      </div>
    );
  }

  const timeCls = "border border-border rounded-lg px-2 py-1 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary w-28";
  const currentWeekStart = weeks[selectedWeek];
  const isCurrentWeekExplicit = weekIsExplicit(currentWeekStart, allShifts);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-semibold">{t('ownerStaffHours.title')}</h1>
              <button
                type="button"
                onClick={() => setInfoOpen(o => !o)}
                className="text-muted-foreground/70 hover:text-muted-foreground transition-colors"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{t('ownerStaffHours.subtitle')}</p>
          </div>
        </div>

        {/* Info panel */}
        {infoOpen && (
          <div className="mb-4 flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{t('ownerStaffHours.info')}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : staffList.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{t('ownerStaffHours.noStaff')}</p>
          </div>
        ) : (
          <>
            {/* Staff picker with accept_bookings toggle */}
            <div className="mb-5">
              <label className="block text-xs text-muted-foreground mb-1.5">{t('ownerStaffHours.selectStaff')}</label>
              <div className="flex flex-col gap-2">
                {staffList.map(sm => (
                  <div key={sm.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleStaffChange(sm.id)}
                      className={`flex-1 text-left px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                        selectedStaffId === sm.id
                          ? 'bg-primary text-white border-primary'
                          : 'border-border bg-background hover:bg-accent text-foreground'
                      }`}
                    >
                      {sm.name}
                      {sm.role === 'owner' && (
                        <span className="ml-1.5 text-[10px] font-normal opacity-70">(vlasnik)</span>
                      )}
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{t('staffHours.acceptBookings')}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleAcceptBookings(sm.id, sm.accept_bookings)}
                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
                          sm.accept_bookings ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5 ${
                            sm.accept_bookings ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Week selector */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">{t('ownerStaffHours.selectWeek')}</p>
              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                {weeks.map((ws, idx) => {
                  const explicit = weekIsExplicit(ws, allShifts);
                  const isSelected = selectedWeek === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedWeek(idx)}
                      className={`flex-shrink-0 flex flex-col items-center px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-colors border ${
                        isSelected
                          ? 'bg-primary text-white border-primary'
                          : 'border-border bg-background hover:bg-accent text-foreground'
                      }`}
                    >
                      <span>{idx === 0 ? t('ownerStaffHours.thisWeek') : idx === 1 ? t('ownerStaffHours.nextWeek') : `+${idx}`}</span>
                      <span className={`text-[9px] mt-0.5 ${isSelected ? 'opacity-80' : explicit ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                        {explicit ? t('ownerStaffHours.explicit') : t('ownerStaffHours.inherited')}
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* Week date range */}
              <p className="text-xs text-muted-foreground mt-1.5 pl-0.5">
                {formatWeekRange(currentWeekStart)}
                {!isCurrentWeekExplicit && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">{t('ownerStaffHours.inheritedNotice')}</span>
                )}
              </p>
            </div>

            {shiftsLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Mon-Sun grid */}
                <div className="border border-border rounded-xl overflow-hidden mb-5">
                  {[0, 1, 2, 3, 4, 5, 6].map((dow, idx) => {
                    const day = schedule[dow];
                    return (
                      <div
                        key={dow}
                        className={`flex flex-col gap-2 p-4 ${idx > 0 ? 'border-t border-border' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium w-28">{t(DOW_KEYS[idx])}</span>
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
                          <div className="flex flex-col gap-1.5 pl-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <input
                                type="time"
                                value={day.start_time}
                                onChange={e => updateDay(dow, { start_time: e.target.value })}
                                className={timeCls}
                              />
                              <span className="text-muted-foreground text-xs">–</span>
                              <input
                                type="time"
                                value={day.end_time}
                                onChange={e => updateDay(dow, { end_time: e.target.value })}
                                className={timeCls}
                              />
                              {!day.has_break && (
                                <button
                                  type="button"
                                  onClick={() => toggleBreak(dow)}
                                  className="text-xs font-medium text-primary/70 hover:text-primary transition-colors px-2 py-1 rounded border border-primary/20 hover:border-primary/50"
                                >
                                  + {t('bookingSetup.hours.addSecondPeriod')}
                                </button>
                              )}
                            </div>

                            {day.has_break && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {t('bookingSetup.hours.break')}
                                </span>
                                <input
                                  type="time"
                                  value={day.break_start}
                                  onChange={e => updateDay(dow, { break_start: e.target.value })}
                                  className={timeCls}
                                />
                                <span className="text-muted-foreground text-xs">–</span>
                                <input
                                  type="time"
                                  value={day.break_end}
                                  onChange={e => updateDay(dow, { break_end: e.target.value })}
                                  className={timeCls}
                                />
                                <button
                                  type="button"
                                  onClick={() => toggleBreak(dow)}
                                  className="text-xs font-medium text-destructive/70 hover:text-destructive transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-destructive/10"
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

                <button
                  onClick={handleSave}
                  disabled={saving || !selectedStaffId}
                  className="w-full py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {saving ? t('staffHours.saving') : t('ownerStaffHours.saveWeek')}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function OwnerStaffHoursPage() {
  return (
    <ProtectedRoute>
      <OwnerStaffHoursContent />
    </ProtectedRoute>
  );
}
