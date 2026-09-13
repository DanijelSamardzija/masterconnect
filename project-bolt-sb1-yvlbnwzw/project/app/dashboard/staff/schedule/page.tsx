'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { ChevronLeft, X } from 'lucide-react';

type ShiftRow = {
  shift_date: string;
  start_time: string | null;
  end_time: string | null;
  is_off: boolean;
  notes: string | null;
  break_start: string | null;
  break_end: string | null;
};

type EditState = {
  date: string;
  mode: 'default' | 'working' | 'off';
  startTime: string;
  endTime: string;
  notes: string;
  hasBreak: boolean;
  breakStart: string;
  breakEnd: string;
};

const DAY_LABELS: Record<number, string> = {
  0: 'Ned', 1: 'Pon', 2: 'Uto', 3: 'Sri', 4: 'Čet', 5: 'Pet', 6: 'Sub',
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isToday(dateStr: string): boolean {
  return dateStr === isoDate(new Date());
}

function StaffScheduleContent() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [hasStaff, setHasStaff] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  // 14 days starting today
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  async function loadShifts() {
    const { data } = await (supabase as any).rpc('staff_get_my_shifts', {
      p_from_date: isoDate(days[0]),
      p_to_date:   isoDate(days[days.length - 1]),
    });
    setShifts(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: sm } = await (supabase as any)
        .from('staff_members')
        .select('id, permissions')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!sm) { setLoading(false); return; }
      setHasStaff(true);
      setCanEdit(!!sm.permissions?.can_set_hours);
      await loadShifts();
      setLoading(false);
    })();
  }, [profile]);

  function getShift(dateStr: string): ShiftRow | null {
    return shifts.find(s => s.shift_date === dateStr) ?? null;
  }

  function openEdit(dateStr: string) {
    if (!canEdit) return;
    const shift = getShift(dateStr);
    let mode: EditState['mode'] = 'default';
    let startTime = '09:00';
    let endTime = '17:00';
    let notes = '';
    let hasBreak = false;
    let breakStart = '13:00';
    let breakEnd = '14:00';
    if (shift) {
      if (shift.is_off) {
        mode = 'off';
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
    setEdit({ date: dateStr, mode, startTime, endTime, notes, hasBreak, breakStart, breakEnd });
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
          p_notes:       edit.notes.trim() || null,
          p_break_start: edit.mode === 'working' && edit.hasBreak ? edit.breakStart : null,
          p_break_end:   edit.mode === 'working' && edit.hasBreak ? edit.breakEnd   : null,
        });
        if (data?.ok === false) throw new Error(data.error);
      }
      toast.success(t('schedule.savedSuccess'));
      setEdit(null);
      await loadShifts();
    } catch {
      toast.error(t('schedule.saveError'));
    }
    setSaving(false);
  }

  const timeCls = 'border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary w-full';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/dashboard/staff/bookings')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{t('schedule.staffView.title')}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{t('schedule.staffView.subtitle')}</p>
          </div>
        </div>

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
          <div className="space-y-2">
            {days.map((day) => {
              const dateStr = isoDate(day);
              const shift = getShift(dateStr);
              const today = isToday(dateStr);
              const dow = day.getDay();

              let badge: React.ReactNode = null;
              let rowCls = 'bg-card border border-border';

              if (shift) {
                if (shift.is_off) {
                  badge = (
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                      {t('schedule.staffView.dayOff')}
                    </span>
                  );
                  rowCls = 'bg-muted/30 border border-border';
                } else {
                  badge = (
                    <span className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2.5 py-1 rounded-full">
                      {shift.start_time?.slice(0, 5)} – {shift.end_time?.slice(0, 5)}
                    </span>
                  );
                  rowCls = 'bg-card border border-border';
                }
              } else {
                badge = (
                  <span className="text-xs text-muted-foreground/50">
                    {t('schedule.staffView.regular')}
                  </span>
                );
              }

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => openEdit(dateStr)}
                  disabled={!canEdit}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${rowCls} ${
                    canEdit ? 'hover:border-primary/30 cursor-pointer' : 'cursor-default'
                  } ${today ? 'ring-1 ring-primary/40' : ''}`}
                >
                  <div className={`w-12 shrink-0 text-center`}>
                    <p className={`text-xs font-semibold ${today ? 'text-primary' : 'text-muted-foreground'}`}>
                      {DAY_LABELS[dow]}
                    </p>
                    <p className={`text-lg font-bold leading-tight ${today ? 'text-primary' : 'text-foreground'}`}>
                      {day.getDate()}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {day.toLocaleDateString('sr-RS', { month: 'short' })}
                    </p>
                  </div>
                  <div className="flex-1 flex items-center justify-between gap-2">
                    {badge}
                    {shift?.notes?.trim() && (
                      <p className="text-[10px] text-muted-foreground italic truncate max-w-[120px]">
                        {shift.notes}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
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
                {/* Break toggle */}
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
