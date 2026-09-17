'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, X, Info, CalendarOff } from 'lucide-react';
import { StaffBookingNav } from '@/components/booking/staff-booking-nav';

type ShiftRow = {
  shift_date: string;
  start_time: string | null;
  end_time: string | null;
  is_off: boolean;
  off_reason: string | null;
  notes: string | null;
  break_start: string | null;
  break_end: string | null;
};

type OffReason = 'day_off' | 'vacation' | 'sick_leave';
const OFF_REASON_CYCLE: OffReason[] = ['day_off', 'vacation', 'sick_leave'];

type EditState = {
  date: string;
  mode: 'default' | 'working' | 'off';
  offReason: OffReason;
  startTime: string;
  endTime: string;
  notes: string;
  hasBreak: boolean;
  breakStart: string;
  breakEnd: string;
};

const DAY_SHORT: Record<number, string> = {
  0: 'Ned', 1: 'Pon', 2: 'Uto', 3: 'Sri', 4: 'Čet', 5: 'Pet', 6: 'Sub',
};

// Mon=1 .. Sun=0 order
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];

function getMonday(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isToday(dateStr: string): boolean {
  return dateStr === isoDate(new Date());
}

function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const startStr = monday.toLocaleDateString('sr-RS', opts);
  const endStr = sunday.toLocaleDateString('sr-RS', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

function StaffScheduleContent() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [weekDate, setWeekDate] = useState<Date>(() => getMonday(new Date()));
  const [infoOpen, setInfoOpen] = useState(false);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [hasStaff, setHasStaff] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [staffMemberId, setStaffMemberId] = useState<string | null>(null);
  const [acceptBookings, setAcceptBookings] = useState(true);
  const [togglingAccept, setTogglingAccept] = useState(false);
  const [canBlockTime, setCanBlockTime] = useState(false);

  const weekDays = DOW_ORDER.map((_, i) => {
    const mon = getMonday(weekDate);
    // DOW_ORDER: 1,2,3,4,5,6,0 → offset from Monday: 0,1,2,3,4,5,6
    return addDays(mon, i);
  });

  const loadShifts = useCallback(async (mon: Date) => {
    const from = isoDate(mon);
    const to = isoDate(addDays(mon, 6));
    const { data } = await (supabase as any).rpc('staff_get_my_shifts', {
      p_from_date: from,
      p_to_date:   to,
    });
    setShifts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: sm } = await (supabase as any)
        .from('staff_members')
        .select('id, permissions, business_id, role, accept_bookings')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!sm) { setLoading(false); return; }
      setHasStaff(true);
      setStaffMemberId(sm.id);
      setCanEdit(!!sm.permissions?.can_set_hours);
      setAcceptBookings(sm.accept_bookings ?? true);
      setCanBlockTime(sm.role === 'owner' || !!sm.permissions?.can_block_time);
      // shifts are loaded by the weekDate/hasStaff effect below (avoids race condition)
    })();
  }, [profile]);

  useEffect(() => {
    if (hasStaff) loadShifts(weekDate);
  }, [weekDate, hasStaff, loadShifts]);

  function getShift(dateStr: string): ShiftRow | null {
    return shifts.find(s => s.shift_date === dateStr) ?? null;
  }

  function openEdit(dateStr: string) {
    if (!canEdit) return;
    const shift = getShift(dateStr);
    let mode: EditState['mode'] = 'working';
    let offReason: OffReason = 'day_off';
    let startTime = '09:00';
    let endTime = '17:00';
    let notes = '';
    let hasBreak = false;
    let breakStart = '13:00';
    let breakEnd = '14:00';
    if (shift) {
      if (shift.is_off) {
        mode = 'off';
        offReason = (shift.off_reason as OffReason | null) ?? 'day_off';
      } else {
        mode = 'working';
        startTime  = shift.start_time?.slice(0, 5) ?? '09:00';
        endTime    = shift.end_time?.slice(0, 5)   ?? '17:00';
        notes      = shift.notes ?? '';
        hasBreak   = !!(shift.break_start && shift.break_end);
        breakStart = shift.break_start?.slice(0, 5) ?? '13:00';
        breakEnd   = shift.break_end?.slice(0, 5)   ?? '14:00';
      }
    }
    setEdit({ date: dateStr, mode, offReason, startTime, endTime, notes, hasBreak, breakStart, breakEnd });
  }

  async function handleToggleAcceptBookings() {
    if (!staffMemberId) return;
    setTogglingAccept(true);
    const newVal = !acceptBookings;
    const { data } = await (supabase as any).rpc('set_accept_bookings', {
      p_staff_member_id: staffMemberId,
      p_accept: newVal,
    });
    if (data?.ok) {
      setAcceptBookings(newVal);
    } else {
      toast.error('Greška');
    }
    setTogglingAccept(false);
  }

  async function handleSave() {
    if (!edit) return;
    setSaving(true);
    try {
      if (edit.mode === 'default') {
        const { data } = await (supabase as any).rpc('staff_delete_my_shift', {
          p_shift_date: edit.date,
        });
        if (data?.ok === false) throw new Error(data.error);
      } else {
        const { data } = await (supabase as any).rpc('staff_set_my_shift', {
          p_shift_date:  edit.date,
          p_start_time:  edit.mode === 'working' ? edit.startTime : null,
          p_end_time:    edit.mode === 'working' ? edit.endTime   : null,
          p_is_off:      edit.mode === 'off',
          p_off_reason:  edit.mode === 'off' ? edit.offReason : 'day_off',
          p_notes:       edit.notes.trim() || null,
          p_break_start: edit.mode === 'working' && edit.hasBreak ? edit.breakStart : null,
          p_break_end:   edit.mode === 'working' && edit.hasBreak ? edit.breakEnd   : null,
        });
        if (data?.ok === false) throw new Error(data.error);
      }
      toast.success(t('schedule.savedSuccess'));
      setEdit(null);
      await loadShifts(weekDate);
    } catch {
      toast.error(t('schedule.saveError'));
    }
    setSaving(false);
  }

  const todayMonday = isoDate(getMonday(new Date()));
  const timeCls = 'border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary w-full';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6">

        <StaffBookingNav active="schedule" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{t('schedule.staffView.title')}</h1>
              <button
                onClick={() => setInfoOpen(o => !o)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{t('schedule.staffView.subtitle')}</p>
          </div>
        </div>

        {infoOpen && (
          <div className="mb-4 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              {t('schedule.staffView.info')}
            </p>
          </div>
        )}

        {canEdit && (
          <div className="mb-4 px-3 py-2 rounded-xl bg-primary/8 border border-primary/20">
            <p className="text-xs text-primary font-medium">{t('schedule.staffView.canEdit')}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !hasStaff ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">{t('staffHours.noPermission')}</p>
          </div>
        ) : (
          <>
            {/* Accept bookings toggle */}
            {staffMemberId && (
              <div className="flex items-center justify-between border border-border rounded-xl px-3 py-2 mb-3">
                <div>
                  <p className="text-sm font-medium">{t('staffHours.acceptBookings')}</p>
                  {!acceptBookings && (
                    <p className="text-xs text-muted-foreground mt-0.5">{t('staffHours.acceptBookingsHint')}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={togglingAccept}
                  onClick={handleToggleAcceptBookings}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-60 ${
                    acceptBookings ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5 ${
                      acceptBookings ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Time-off shortcut */}
            {canBlockTime && (
              <button
                onClick={() => router.push('/dashboard/staff/time-off')}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 mb-3 rounded-xl border border-border bg-background hover:bg-accent transition-colors"
              >
                <CalendarOff className="w-3.5 h-3.5" />
                {t('staffDashboard.timeOff')}
              </button>
            )}

            {/* Week navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setWeekDate(d => addDays(getMonday(d), -7))}
                disabled={isoDate(getMonday(weekDate)) <= todayMonday}
                className="p-2 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                {isoDate(getMonday(weekDate)) !== todayMonday && (
                  <button
                    onClick={() => setWeekDate(getMonday(new Date()))}
                    className="text-xs text-primary font-medium px-2.5 py-1 rounded-lg border border-primary/30 hover:bg-primary/5 transition-colors"
                  >
                    {t('schedule.thisWeek')}
                  </button>
                )}
                <span className="text-sm font-medium text-foreground">
                  {formatWeekRange(getMonday(weekDate))}
                </span>
              </div>

              <button
                onClick={() => setWeekDate(d => addDays(getMonday(d), 7))}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Weekly table */}
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[600px] border-collapse">
                <thead>
                  <tr>
                    {weekDays.map((day) => {
                      const dow = day.getDay();
                      const dateStr = isoDate(day);
                      const today = isToday(dateStr);
                      return (
                        <th
                          key={dateStr}
                          className={`text-center py-2.5 px-1 border-b border-border text-xs font-semibold ${
                            today ? 'text-primary' : 'text-muted-foreground'
                          }`}
                        >
                          <div>{DAY_SHORT[dow]}</div>
                          <div className={`text-sm font-bold mt-0.5 ${today ? 'text-primary' : 'text-foreground'}`}>
                            {day.getDate()}.
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {weekDays.map((day) => {
                      const dateStr = isoDate(day);
                      const shift = getShift(dateStr);
                      const today = isToday(dateStr);

                      let cellContent: React.ReactNode;
                      let cellCls = 'bg-background';

                      if (!shift) {
                        cellCls = 'bg-background';
                        cellContent = null;
                      } else if (shift.is_off) {
                        cellCls = 'bg-muted/50';
                        const offLabel = shift.off_reason === 'vacation'
                          ? t('shift.vacation')
                          : shift.off_reason === 'sick_leave'
                          ? t('shift.sickLeave')
                          : t('shift.dayOff');
                        cellContent = (
                          <span className="text-[10px] font-medium text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted">
                            {offLabel}
                          </span>
                        );
                      } else {
                        cellCls = 'bg-green-50 dark:bg-green-950/20';
                        cellContent = (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[11px] font-semibold text-green-700 dark:text-green-400 leading-tight">
                              {shift.start_time?.slice(0, 5)}
                            </span>
                            <span className="text-[10px] text-green-700/70 dark:text-green-400/70">–</span>
                            <span className="text-[11px] font-semibold text-green-700 dark:text-green-400 leading-tight">
                              {shift.end_time?.slice(0, 5)}
                            </span>
                            {shift.break_start && shift.break_end && (
                              <span className="text-[9px] text-orange-500 font-medium mt-0.5 leading-tight">
                                ☕ {shift.break_start.slice(0, 5)}–{shift.break_end.slice(0, 5)}
                              </span>
                            )}
                            {shift.notes?.trim() && (
                              <span className="text-[9px] text-muted-foreground mt-0.5 leading-tight text-center max-w-[72px] break-words">
                                {shift.notes.trim()}
                              </span>
                            )}
                          </div>
                        );
                      }

                      return (
                        <td
                          key={dateStr}
                          onClick={() => openEdit(dateStr)}
                          className={`border-r last:border-r-0 border-border text-center px-1 py-4 align-middle ${cellCls} ${
                            today ? 'ring-1 ring-inset ring-primary/30' : ''
                          } ${canEdit ? 'cursor-pointer hover:brightness-95 dark:hover:brightness-110 transition-all' : ''}`}
                        >
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Edit modal */}
      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setEdit(null); }}
        >
          <div className="bg-background border border-border rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-sm text-foreground">
                {new Date(edit.date + 'T00:00:00').toLocaleDateString('sr-RS', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </p>
              <button onClick={() => setEdit(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              {(['working', 'off'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setEdit(e => e ? { ...e, mode: m } : e)}
                  className={`flex-1 text-xs font-medium py-2 rounded-xl border transition-colors ${
                    edit.mode === m
                      ? m === 'off'
                        ? 'bg-muted text-foreground border-muted'
                        : 'bg-green-500 text-white border-green-500'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {m === 'working' ? t('schedule.working') : t('schedule.dayOff')}
                </button>
              ))}
              {getShift(edit.date) && (
                <button
                  type="button"
                  onClick={() => setEdit(e => e ? { ...e, mode: 'default' } : e)}
                  className={`flex-1 text-xs font-medium py-2 rounded-xl border transition-colors ${
                    edit.mode === 'default'
                      ? 'bg-destructive/10 text-destructive border-destructive/30'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {t('schedule.defaultSchedule')}
                </button>
              )}
            </div>

            {edit.mode === 'off' && (
              <div className="flex items-center justify-between bg-muted/40 rounded-xl px-3 py-2.5 mb-4">
                <span className="text-xs text-muted-foreground">{t('schedule.offReason')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">
                    {edit.offReason === 'vacation'
                      ? t('shift.vacation')
                      : edit.offReason === 'sick_leave'
                      ? t('shift.sickLeave')
                      : t('shift.dayOff')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEdit(e => {
                      if (!e) return e;
                      const idx = OFF_REASON_CYCLE.indexOf(e.offReason);
                      return { ...e, offReason: OFF_REASON_CYCLE[(idx + 1) % OFF_REASON_CYCLE.length] };
                    })}
                    className="text-xs px-1.5 py-0.5 rounded bg-background border border-border hover:bg-accent transition-colors"
                    title="Promijeni razlog"
                  >
                    ↻
                  </button>
                </div>
              </div>
            )}

            {edit.mode === 'default' && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2.5 mb-4">
                {t('schedule.defaultHint')}
              </p>
            )}

            {edit.mode === 'working' && (
              <div className="space-y-3 mb-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground block mb-1">{t('schedule.shiftStart')}</label>
                    <input
                      type="time"
                      value={edit.startTime}
                      onChange={e => setEdit(ev => ev ? { ...ev, startTime: e.target.value } : ev)}
                      className={timeCls}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground block mb-1">{t('schedule.shiftEnd')}</label>
                    <input
                      type="time"
                      value={edit.endTime}
                      onChange={e => setEdit(ev => ev ? { ...ev, endTime: e.target.value } : ev)}
                      className={timeCls}
                    />
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setEdit(ev => ev ? { ...ev, hasBreak: !ev.hasBreak } : ev)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      edit.hasBreak
                        ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400'
                        : 'border-dashed border-border text-muted-foreground hover:border-orange-300 hover:text-orange-600'
                    }`}
                  >
                    {edit.hasBreak ? `${t('schedule.break')}: ${edit.breakStart} – ${edit.breakEnd}` : `+ ${t('schedule.addBreak')}`}
                  </button>
                </div>
                {edit.hasBreak && (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground block mb-1">{t('schedule.breakStart')}</label>
                      <input
                        type="time"
                        value={edit.breakStart}
                        onChange={e => setEdit(ev => ev ? { ...ev, breakStart: e.target.value } : ev)}
                        className={timeCls}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground block mb-1">{t('schedule.breakEnd')}</label>
                      <input
                        type="time"
                        value={edit.breakEnd}
                        onChange={e => setEdit(ev => ev ? { ...ev, breakEnd: e.target.value } : ev)}
                        className={timeCls}
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">{t('schedule.notes')}</label>
                  <input
                    type="text"
                    value={edit.notes}
                    onChange={e => setEdit(ev => ev ? { ...ev, notes: e.target.value } : ev)}
                    placeholder="..."
                    className="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving ? '...' : t('schedule.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StaffSchedulePage() {
  return (
    <ProtectedRoute>
      <StaffScheduleContent />
    </ProtectedRoute>
  );
}
