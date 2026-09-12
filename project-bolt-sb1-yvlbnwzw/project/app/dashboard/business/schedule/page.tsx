'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Copy, X } from 'lucide-react';

type ShiftRow = {
  shift_date: string;
  start_time: string | null;
  end_time: string | null;
  is_off: boolean;
  notes: string | null;
};

type StaffRow = {
  staff_member_id: string;
  staff_name: string;
  shifts: ShiftRow[];
};

type EditState = {
  staffId: string;
  staffName: string;
  date: string;
  mode: 'default' | 'working' | 'off';
  startTime: string;
  endTime: string;
  notes: string;
};

const DOW_KEYS = [
  'schedule.day.short.1',
  'schedule.day.short.2',
  'schedule.day.short.3',
  'schedule.day.short.4',
  'schedule.day.short.5',
  'schedule.day.short.6',
  'schedule.day.short.0',
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
  return d.toISOString().slice(0, 10);
}

function isToday(d: Date): boolean {
  return isoDate(d) === isoDate(new Date());
}

function OwnerScheduleContent() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [copying, setCopying] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const loadShifts = useCallback(async (ws: Date) => {
    setLoading(true);
    const { data } = await (supabase as any).rpc('owner_get_week_shifts', {
      p_week_start: isoDate(ws),
    });
    setStaffRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: sm } = await (supabase as any)
        .from('staff_members')
        .select('role')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .in('role', ['owner', 'manager'])
        .maybeSingle();
      if (!sm) { setLoading(false); return; }
      setIsOwner(true);
      await loadShifts(weekStart);
    })();
  }, [profile]);

  function prevWeek() {
    const ws = addDays(weekStart, -7);
    setWeekStart(ws);
    loadShifts(ws);
  }

  function nextWeek() {
    const ws = addDays(weekStart, 7);
    setWeekStart(ws);
    loadShifts(ws);
  }

  function thisWeek() {
    const ws = getMondayOf(new Date());
    setWeekStart(ws);
    loadShifts(ws);
  }

  function getShift(staffId: string, date: string): ShiftRow | null {
    const row = staffRows.find(r => r.staff_member_id === staffId);
    return row?.shifts.find(s => s.shift_date === date) ?? null;
  }

  function openEdit(staffId: string, staffName: string, date: string) {
    const shift = getShift(staffId, date);
    let mode: EditState['mode'] = 'default';
    let startTime = '09:00';
    let endTime = '17:00';
    let notes = '';
    if (shift) {
      if (shift.is_off) {
        mode = 'off';
      } else {
        mode = 'working';
        startTime = shift.start_time?.slice(0, 5) ?? '09:00';
        endTime   = shift.end_time?.slice(0, 5)   ?? '17:00';
        notes     = shift.notes ?? '';
      }
    }
    setEdit({ staffId, staffName, date, mode, startTime, endTime, notes });
  }

  async function handleSave() {
    if (!edit) return;
    setSaving(true);
    try {
      if (edit.mode === 'default') {
        await (supabase as any).rpc('owner_delete_shift', {
          p_staff_member_id: edit.staffId,
          p_shift_date: edit.date,
        });
      } else {
        const { data } = await (supabase as any).rpc('owner_set_shift', {
          p_staff_member_id: edit.staffId,
          p_shift_date:      edit.date,
          p_start_time:      edit.mode === 'working' ? edit.startTime : null,
          p_end_time:        edit.mode === 'working' ? edit.endTime   : null,
          p_is_off:          edit.mode === 'off',
          p_notes:           edit.notes.trim() || null,
        });
        if (data?.ok === false) throw new Error(data.error);
      }
      toast.success(t('schedule.savedSuccess'));
      setEdit(null);
      await loadShifts(weekStart);
    } catch {
      toast.error(t('schedule.saveError'));
    }
    setSaving(false);
  }

  async function handleCopyWeek() {
    setCopying(true);
    const nextWs = addDays(weekStart, 7);
    const { data } = await (supabase as any).rpc('owner_copy_week_shifts', {
      p_from_week_start: isoDate(weekStart),
      p_to_week_start:   isoDate(nextWs),
    });
    setCopying(false);
    if (data?.ok) {
      toast.success(t('schedule.copyWeekDone'));
    } else {
      toast.error(t('schedule.saveError'));
    }
  }

  const timeCls = 'border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary w-28';

  if (!isOwner && !loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('ownerBookings.noPermission')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{t('schedule.title')}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{t('schedule.subtitle')}</p>
          </div>
          <button
            onClick={handleCopyWeek}
            disabled={copying}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
            title={t('schedule.copyWeek')}
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('schedule.copyWeek')}</span>
          </button>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={prevWeek}
            className="p-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={thisWeek}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            {t('schedule.thisWeek')}
          </button>
          <span className="flex-1 text-center text-sm font-medium text-foreground">
            {weekDays[0].toLocaleDateString('sr-RS', { day: 'numeric', month: 'short' })}
            {' – '}
            {weekDays[6].toLocaleDateString('sr-RS', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <button
            onClick={nextWeek}
            className="p-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : staffRows.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">{t('schedule.noStaff')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-32 border-b border-border">
                    Radnik
                  </th>
                  {weekDays.map((day, i) => {
                    const today = isToday(day);
                    return (
                      <th
                        key={i}
                        className={`px-2 py-3 text-center text-xs font-semibold border-b border-border border-l ${
                          today ? 'text-primary bg-primary/5' : 'text-muted-foreground'
                        }`}
                      >
                        <div>{t(DOW_KEYS[i])}</div>
                        <div className={`text-[10px] mt-0.5 font-normal ${today ? 'text-primary' : 'text-muted-foreground/60'}`}>
                          {day.getDate()}.{day.getMonth() + 1}.
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {staffRows.map((staff, si) => (
                  <tr key={staff.staff_member_id} className={si > 0 ? 'border-t border-border' : ''}>
                    <td className="px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap">
                      {staff.staff_name}
                    </td>
                    {weekDays.map((day, di) => {
                      const dateStr = isoDate(day);
                      const shift = getShift(staff.staff_member_id, dateStr);
                      const today = isToday(day);

                      let cellContent: React.ReactNode;
                      let cellCls = '';

                      if (!shift) {
                        cellContent = (
                          <span className="text-[10px] text-muted-foreground/40">—</span>
                        );
                        cellCls = today ? 'bg-primary/3' : '';
                      } else if (shift.is_off) {
                        cellContent = (
                          <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {t('schedule.dayOff')}
                          </span>
                        );
                        cellCls = 'bg-muted/20';
                      } else {
                        cellContent = (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] font-semibold text-green-700 dark:text-green-400">
                              {shift.start_time?.slice(0, 5)}
                            </span>
                            <span className="text-[9px] text-muted-foreground">–</span>
                            <span className="text-[10px] font-semibold text-green-700 dark:text-green-400">
                              {shift.end_time?.slice(0, 5)}
                            </span>
                          </div>
                        );
                        cellCls = 'bg-green-50 dark:bg-green-950/20';
                      }

                      return (
                        <td
                          key={di}
                          className={`px-2 py-3 text-center border-l border-border cursor-pointer hover:bg-accent/60 transition-colors ${cellCls}`}
                          onClick={() => openEdit(staff.staff_member_id, staff.staff_name, dateStr)}
                        >
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        {!loading && staffRows.length > 0 && (
          <div className="flex items-center gap-4 mt-3 px-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-3 h-3 rounded-sm bg-green-100 dark:bg-green-950/40 border border-green-300 dark:border-green-800 inline-block" />
              {t('schedule.working')}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-3 h-3 rounded-sm bg-muted border border-border inline-block" />
              {t('schedule.dayOff')}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-3 h-3 rounded-sm bg-background border border-dashed border-border inline-block" />
              {t('schedule.defaultSchedule')}
            </div>
          </div>
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
              <div>
                <p className="font-semibold text-sm text-foreground">{edit.staffName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(edit.date + 'T00:00:00').toLocaleDateString('sr-RS', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                </p>
              </div>
              <button onClick={() => setEdit(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode selector */}
            <div className="flex gap-2 mb-4">
              {(['default', 'working', 'off'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setEdit(e => e ? { ...e, mode: m } : e)}
                  className={`flex-1 text-xs font-medium py-2 rounded-xl border transition-colors ${
                    edit.mode === m
                      ? m === 'off'
                        ? 'bg-muted text-foreground border-muted'
                        : m === 'working'
                          ? 'bg-green-500 text-white border-green-500'
                          : 'bg-primary text-white border-primary'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {m === 'default'
                    ? t('schedule.defaultSchedule')
                    : m === 'working'
                      ? t('schedule.working')
                      : t('schedule.dayOff')}
                </button>
              ))}
            </div>

            {/* Time inputs */}
            {edit.mode === 'working' && (
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground block mb-1">{t('schedule.shiftStart')}</label>
                    <input
                      type="time"
                      value={edit.startTime}
                      onChange={e => setEdit(ev => ev ? { ...ev, startTime: e.target.value } : ev)}
                      className={timeCls + ' w-full'}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground block mb-1">{t('schedule.shiftEnd')}</label>
                    <input
                      type="time"
                      value={edit.endTime}
                      onChange={e => setEdit(ev => ev ? { ...ev, endTime: e.target.value } : ev)}
                      className={timeCls + ' w-full'}
                    />
                  </div>
                </div>
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

export default function OwnerSchedulePage() {
  return (
    <ProtectedRoute>
      <OwnerScheduleContent />
    </ProtectedRoute>
  );
}
