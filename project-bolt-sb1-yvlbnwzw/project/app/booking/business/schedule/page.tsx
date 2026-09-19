'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Copy, X, Info, Download, AlertTriangle, MapPin } from 'lucide-react';
import { BusinessBookingNav } from '@/components/booking/business-booking-nav';

type ShiftRow = {
  shift_date: string;
  is_override: boolean;
  start_time: string | null;
  end_time: string | null;
  is_off: boolean;
  off_reason: string | null;
  notes: string | null;
  break_start: string | null;
  break_end: string | null;
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
  mode: 'working' | 'off';
  offReason: string;
  startTime: string;
  endTime: string;
  notes: string;
  hasBreak: boolean;
  breakStart: string;
  breakEnd: string;
};

type AbsenceRow = {
  id: string;
  staff_member_id: string;
  date_from: string;
  date_to: string;
  reason: string;
  note: string | null;
};

// Booking system start — navigation cannot go before this month
const BOOKING_START_YEAR = 2026;
const BOOKING_START_MONTH = 8; // September (0-indexed)

function monthIdx(d: Date) { return d.getFullYear() * 12 + d.getMonth(); }

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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isToday(d: Date): boolean {
  return isoDate(d) === isoDate(new Date());
}

function getMonthWeeks(d: Date): Date[] {
  const [year, month] = [d.getFullYear(), d.getMonth()];
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const weeks: Date[] = [];
  let cur = getMondayOf(firstDay);
  while (cur <= lastDay) {
    weeks.push(new Date(cur));
    cur = addDays(cur, 7);
  }
  return weeks;
}

function getMonthDays(d: Date): Date[] {
  const [year, month] = [d.getFullYear(), d.getMonth()];
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => new Date(year, month, i + 1));
}

function OwnerScheduleContent() {
  const { t, language } = useLanguage();
  const locale = { sr: 'sr-RS', en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' }[language] ?? 'en-US';
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [weekStart, setWeekStart] = useState<Date>(() => addDays(getMondayOf(new Date()), 7));
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [monthDate, setMonthDate] = useState<Date>(() => {
    const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [staffAccept, setStaffAccept] = useState<{id: string; name: string; accept: boolean; role: string; location_id: string | null}[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardWeeks, setCardWeeks] = useState<Record<string, Date>>({});
  const [cardShifts, setCardShifts] = useState<Record<string, ShiftRow[]>>({});
  const [cardMonths, setCardMonths] = useState<Record<string, Date>>({});
  const [cardMonthShifts, setCardMonthShifts] = useState<Record<string, ShiftRow[]>>({});
  const [isOwner, setIsOwner] = useState(false);
  const [copyingMap, setCopyingMap] = useState<Record<string, boolean>>({});
  const [infoOpen, setInfoOpen] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [shiftConflictCount, setShiftConflictCount] = useState<number | null>(null);
  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [primaryLocId, setPrimaryLocId] = useState<string | null>(null);
  const [locations, setLocations] = useState<{id: string; name: string}[]>([]);
  const [schedLocId, setSchedLocId] = useState<string | null>(null);
  // staffId → day_of_week(0=Sun..6=Sat) → { is_closed, start_time, end_time }
  const [staffDefaultHours, setStaffDefaultHours] = useState<Record<string, Record<number, { is_closed: boolean; start_time: string; end_time: string }>>>({});

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const loadAbsences = useCallback(async (locId: string) => {
    const { data } = await (supabase as any).rpc('get_location_staff_absences', { p_location_id: locId });
    setAbsences(Array.isArray(data) ? data : []);
  }, []);

  const loadShifts = useCallback(async (ws: Date) => {
    setLoading(true);
    const { data } = await (supabase as any).rpc('owner_get_week_shifts', {
      p_week_start: isoDate(ws),
    });
    setStaffRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  const loadMonthShifts = useCallback(async (md: Date) => {
    setLoading(true);
    const weeks = getMonthWeeks(md);
    const results = await Promise.all(
      weeks.map(ws => (supabase as any).rpc('owner_get_week_shifts', { p_week_start: isoDate(ws) }))
    );
    const staffMap = new Map<string, StaffRow>();
    for (const { data } of results) {
      if (!Array.isArray(data)) continue;
      for (const row of data as StaffRow[]) {
        if (!staffMap.has(row.staff_member_id)) {
          staffMap.set(row.staff_member_id, { ...row, shifts: [] });
        }
        staffMap.get(row.staff_member_id)!.shifts.push(...row.shifts);
      }
    }
    const [year, month] = [md.getFullYear(), md.getMonth()];
    setStaffRows([...staffMap.values()].map(row => ({
      ...row,
      shifts: row.shifts.filter(s => {
        const d = new Date(s.shift_date + 'T00:00:00');
        return d.getFullYear() === year && d.getMonth() === month;
      }),
    })));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: sm } = await (supabase as any)
        .from('staff_members')
        .select('role, business_id')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .in('role', ['owner', 'manager'])
        .maybeSingle();
      if (!sm) { setLoading(false); return; }
      setIsOwner(true);

      const { data: allLocs } = await supabase
        .from('business_locations')
        .select('id, name, is_primary')
        .eq('business_id', sm.business_id)
        .eq('is_active', true)
        .order('is_primary', { ascending: false });
      const locsArr = Array.isArray(allLocs) ? allLocs as {id: string; name: string; is_primary: boolean}[] : [];
      setLocations(locsArr.map(l => ({ id: l.id, name: l.name })));
      const primaryLoc = locsArr.find(l => l.is_primary) ?? locsArr[0];
      if (primaryLoc?.id) setPrimaryLocId(primaryLoc.id);

      const { data: staff } = await (supabase as any)
        .from('staff_members')
        .select('id, accept_bookings, role, primary_location_id, profiles!staff_members_user_id_fkey(name)')
        .eq('business_id', sm.business_id)
        .eq('is_active', true)
        .in('role', ['worker', 'manager', 'owner']);
      if (Array.isArray(staff)) {
        const members = staff.map((s: any) => ({
          id: s.id,
          name: s.profiles?.name || '—',
          accept: s.accept_bookings ?? true,
          role: s.role ?? 'worker',
          location_id: s.primary_location_id ?? null,
        }));
        setStaffAccept(members);

        if (primaryLoc?.id) {
          type HourDBRow = { day_of_week: number; start_time: string; end_time: string; is_closed: boolean; sort_order: number };
          const hoursResults = await Promise.all(
            members.map(m =>
              (supabase as any).rpc('get_staff_opening_hours', {
                p_staff_member_id: m.id,
                p_location_id: m.location_id ?? primaryLoc.id,
              })
            )
          );
          const newMap: Record<string, Record<number, { is_closed: boolean; start_time: string; end_time: string }>> = {};
          for (let i = 0; i < members.length; i++) {
            const rows = (hoursResults[i].data as HourDBRow[]) ?? [];
            if (rows.length === 0) continue;
            const dayMap: Record<number, { is_closed: boolean; start_time: string; end_time: string }> = {};
            for (const row of rows) {
              if (!dayMap[row.day_of_week]) {
                dayMap[row.day_of_week] = {
                  is_closed: row.is_closed,
                  start_time: row.start_time?.slice(0, 5) ?? '09:00',
                  end_time: row.end_time?.slice(0, 5) ?? '17:00',
                };
              }
            }
            newMap[members[i].id] = dayMap;
          }
          setStaffDefaultHours(newMap);
        }
      }

      await loadShifts(weekStart);
    })();
  }, [profile]);

  useEffect(() => {
    const targetLoc = schedLocId ?? primaryLocId;
    if (targetLoc) loadAbsences(targetLoc);
  }, [schedLocId, primaryLocId, loadAbsences]);

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
    setCardWeeks({});
    setCardShifts({});
    loadShifts(ws);
  }

  async function loadCardMonthShifts(staffId: string, month: Date): Promise<ShiftRow[]> {
    const weeks = getMonthWeeks(month);
    const results = await Promise.all(
      weeks.map(ws => (supabase as any).rpc('owner_get_week_shifts', { p_week_start: isoDate(ws) }))
    );
    const [year, mo] = [month.getFullYear(), month.getMonth()];
    const shifts: ShiftRow[] = [];
    for (const { data } of results) {
      if (!Array.isArray(data)) continue;
      const found = (data as StaffRow[]).find(r => r.staff_member_id === staffId);
      if (found) {
        shifts.push(...found.shifts.filter(s => {
          const d = new Date(s.shift_date + 'T00:00:00');
          return d.getFullYear() === year && d.getMonth() === mo;
        }));
      }
    }
    return shifts;
  }

  async function navCardMonth(staffId: string, delta: number) {
    const current = cardMonths[staffId] ?? monthDate;
    const newMonth = new Date(current.getFullYear(), current.getMonth() + delta, 1);
    const navMinIdx = BOOKING_START_YEAR * 12 + BOOKING_START_MONTH;
    const n = new Date();
    const navMaxIdx = n.getFullYear() * 12 + n.getMonth() + 6;
    if (monthIdx(newMonth) < navMinIdx) return;
    if (monthIdx(newMonth) > navMaxIdx) return;
    setCardMonths(prev => ({ ...prev, [staffId]: newMonth }));
    const shifts = await loadCardMonthShifts(staffId, newMonth);
    setCardMonthShifts(prev => ({ ...prev, [staffId]: shifts }));
  }

  async function navCard(staffId: string, delta: number) {
    const current = cardWeeks[staffId] ?? weekStart;
    const newWeek = addDays(current, delta * 7);
    const navMin = getMondayOf(new Date(BOOKING_START_YEAR, BOOKING_START_MONTH, 1));
    const n = new Date();
    const navMax = new Date(n.getFullYear(), n.getMonth() + 6, 1);
    if (newWeek.getTime() < navMin.getTime()) return;
    if (addDays(newWeek, 7).getTime() >= navMax.getTime()) return;
    setCardWeeks(prev => ({ ...prev, [staffId]: newWeek }));
    const { data } = await (supabase as any).rpc('owner_get_week_shifts', { p_week_start: isoDate(newWeek) });
    if (Array.isArray(data)) {
      const found = (data as StaffRow[]).find(r => r.staff_member_id === staffId);
      setCardShifts(prev => ({ ...prev, [staffId]: found?.shifts ?? [] }));
    }
  }

  function prevGlobalWeek() {
    const ws = addDays(weekStart, -7);
    setWeekStart(ws);
    setCardWeeks({});
    setCardShifts({});
    loadShifts(ws);
  }
  function nextGlobalWeek() {
    const ws = addDays(weekStart, 7);
    setWeekStart(ws);
    setCardWeeks({});
    setCardShifts({});
    loadShifts(ws);
  }

  function prevGlobalMonth() {
    const md = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
    setMonthDate(md);
    setCardMonths({});
    setCardMonthShifts({});
    loadMonthShifts(md);
  }
  function nextGlobalMonth() {
    const md = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
    setMonthDate(md);
    setCardMonths({});
    setCardMonthShifts({});
    loadMonthShifts(md);
  }

  function goThisMonth() {
    const n = new Date();
    const md = new Date(n.getFullYear(), n.getMonth(), 1);
    setMonthDate(md);
    setCardMonths({});
    setCardMonthShifts({});
    loadMonthShifts(md);
  }

  function switchView(mode: 'week' | 'month') {
    setViewMode(mode);
    if (mode === 'week') loadShifts(weekStart);
    else loadMonthShifts(monthDate);
  }

  function getAbsence(staffId: string, date: string): AbsenceRow | null {
    return absences.find(a => a.staff_member_id === staffId && a.date_from <= date && a.date_to >= date) ?? null;
  }

  function getShift(staffId: string, date: string): ShiftRow | null {
    if (viewMode === 'week' && cardShifts[staffId] !== undefined) {
      return cardShifts[staffId].find(s => s.shift_date === date) ?? null;
    }
    if (viewMode === 'month' && cardMonthShifts[staffId] !== undefined) {
      return cardMonthShifts[staffId].find(s => s.shift_date === date) ?? null;
    }
    const row = staffRows.find(r => r.staff_member_id === staffId);
    return row?.shifts.find(s => s.shift_date === date) ?? null;
  }

  function openEdit(staffId: string, staffName: string, date: string) {
    const shift = getShift(staffId, date);
    let mode: EditState['mode'] = 'working';
    let startTime = '09:00';
    let endTime = '17:00';
    let notes = '';
    let hasBreak = false;
    let breakStart = '13:00';
    let breakEnd = '14:00';
    let offReason = 'day_off';
    if (shift) {
      if (shift.is_off) {
        mode = 'off';
        offReason = shift.off_reason ?? 'day_off';
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
    setEdit({ staffId, staffName, date, mode, offReason, startTime, endTime, notes, hasBreak, breakStart, breakEnd });
  }

  async function handleSave(force = false) {
    if (!edit) return;

    // When marking as off, check for existing bookings on that day
    if (edit.mode === 'off' && !force) {
      const d = new Date(edit.date + 'T00:00:00');
      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);
      const { count } = await (supabase as any)
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('staff_member_id', edit.staffId)
        .in('status', ['pending', 'confirmed'])
        .gte('starts_at', d.toISOString())
        .lt('starts_at', nextD.toISOString());
      if ((count ?? 0) > 0) {
        setShiftConflictCount(count as number);
        return;
      }
    }
    setShiftConflictCount(null);
    setSaving(true);
    try {
      const { data } = await (supabase as any).rpc('owner_set_shift', {
        p_staff_member_id: edit.staffId,
        p_shift_date:      edit.date,
        p_start_time:      edit.mode === 'working' ? edit.startTime : null,
        p_end_time:        edit.mode === 'working' ? edit.endTime   : null,
        p_is_off:          edit.mode === 'off',
        p_off_reason:      edit.mode === 'off' ? edit.offReason : null,
        p_notes:           edit.notes.trim() || null,
        p_break_start:     edit.mode === 'working' && edit.hasBreak ? edit.breakStart : null,
        p_break_end:       edit.mode === 'working' && edit.hasBreak ? edit.breakEnd   : null,
      });
      if (data?.ok === false) throw new Error(data.error);
      toast.success(t('schedule.savedSuccess'));
      const savedStaffId = edit.staffId;
      setEdit(null);
      if (viewMode === 'month') {
        if (cardMonths[savedStaffId] !== undefined) {
          const shifts = await loadCardMonthShifts(savedStaffId, cardMonths[savedStaffId]);
          setCardMonthShifts(prev => ({ ...prev, [savedStaffId]: shifts }));
        } else {
          await loadMonthShifts(monthDate);
        }
      } else if (cardWeeks[savedStaffId]) {
        const cw = cardWeeks[savedStaffId];
        const { data } = await (supabase as any).rpc('owner_get_week_shifts', { p_week_start: isoDate(cw) });
        if (Array.isArray(data)) {
          const found = (data as StaffRow[]).find(r => r.staff_member_id === savedStaffId);
          setCardShifts(prev => ({ ...prev, [savedStaffId]: found?.shifts ?? [] }));
        }
      } else {
        await loadShifts(weekStart);
      }
    } catch {
      toast.error(t('schedule.saveError'));
    }
    setSaving(false);
  }

  async function handleCopyStaffWeek(staffId: string, fromWeek: Date) {
    setCopyingMap(m => ({ ...m, [staffId]: true }));
    const toWeek = addDays(fromWeek, 7);
    const { data } = await (supabase as any).rpc('owner_copy_staff_week_shifts', {
      p_staff_member_id: staffId,
      p_from_week_start: isoDate(fromWeek),
      p_to_week_start:   isoDate(toWeek),
    });
    setCopyingMap(m => ({ ...m, [staffId]: false }));
    if (data?.ok) {
      toast.success(t('schedule.copyWeekDone'));
      await loadShifts(addDays(fromWeek, 7));
    } else {
      toast.error(t('schedule.saveError'));
    }
  }

  async function handleToggleAccept(smId: string, current: boolean) {
    const newVal = !current;
    const { data } = await (supabase as any).rpc('set_accept_bookings', {
      p_staff_member_id: smId,
      p_accept: newVal,
    });
    if (data?.ok) {
      setStaffAccept(prev => prev.map(s => s.id === smId ? { ...s, accept: newVal } : s));
    } else {
      toast.error(t('schedule.saveError'));
    }
  }

  const filteredStaff = schedLocId
    ? staffAccept.filter(s => s.location_id === schedLocId)
    : staffAccept;

  const timeCls = 'border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary w-28';

  const monthDays = viewMode === 'month' ? getMonthDays(monthDate) : [];

  const SR_MONTHS = ['Januar','Februar','Mart','April','Maj','Jun','Jul','Avgust','Septembar','Oktobar','Novembar','Decembar'];

  function fmtDay(d: Date) {
    return `${d.getDate()}.${d.getMonth() + 1}.`;
  }

  // Navigation limits: Sep 2026 → current month + 6
  const bookingStartIdx = BOOKING_START_YEAR * 12 + BOOKING_START_MONTH;
  const now = new Date();
  const maxMonthIdx = now.getFullYear() * 12 + now.getMonth() + 6;
  const bookingStartMonday = getMondayOf(new Date(BOOKING_START_YEAR, BOOKING_START_MONTH, 1));
  const maxMonthStart = new Date(now.getFullYear(), now.getMonth() + 6, 1);
  const prevGlobalWeekDisabled = weekStart.getTime() <= bookingStartMonday.getTime();
  const nextGlobalWeekDisabled = addDays(weekStart, 7).getTime() >= maxMonthStart.getTime();
  const prevGlobalMonthDisabled = monthIdx(monthDate) <= bookingStartIdx;
  const nextGlobalMonthDisabled = monthIdx(monthDate) >= maxMonthIdx;
  const monthLabelCap = `${SR_MONTHS[monthDate.getMonth()]} ${monthDate.getFullYear()}.`;

  function downloadSchedule() {
    const header = 'Radnik,Datum,Dan,Početak,Kraj,Pauza,Napomena';
    const days = viewMode === 'week' ? weekDays : monthDays;
    const csvRows = [header];

    for (const staff of staffRows) {
      for (const day of days) {
        const dateStr = isoDate(day);
        const shift = getShift(staff.staff_member_id, dateStr);
        const dayName = day.toLocaleDateString(locale, { weekday: 'short' });
        let start = 'redovni';
        let end = '';
        let breakCol = '';
        let notes = '';
        if (shift?.is_off) {
          start = 'slobodan';
        } else if (shift && !shift.is_off) {
          start  = shift.start_time?.slice(0, 5) || '';
          end    = shift.end_time?.slice(0, 5)   || '';
          breakCol = (shift.break_start && shift.break_end)
            ? `${shift.break_start.slice(0, 5)}-${shift.break_end.slice(0, 5)}`
            : '';
          notes = shift.notes || '';
        }
        csvRows.push(`"${staff.staff_name}","${dateStr}","${dayName}","${start}","${end}","${breakCol}","${notes}"`);
      }
    }

    const csv = '﻿' + csvRows.join('\n'); // BOM → Excel opens UTF-8 correctly
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = viewMode === 'week'
      ? `raspored-${isoDate(weekDays[0])}_${isoDate(weekDays[6])}.csv`
      : `raspored-${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printSchedulePDF() {
    const days = viewMode === 'week' ? weekDays : monthDays;
    const title = viewMode === 'week'
      ? `Raspored: ${isoDate(weekDays[0])} – ${isoDate(weekDays[6])}`
      : `Raspored: ${SR_MONTHS[monthDate.getMonth()]} ${monthDate.getFullYear()}`;

    const headerCells = ['<th>Radnik</th>', ...days.map(d =>
      `<th>${d.toLocaleDateString(locale, { weekday: 'short' })}<br><span style="font-weight:400;font-size:10px">${isoDate(d)}</span></th>`
    )].join('');

    const bodyRows = staffRows.map(staff => {
      const cells = days.map(day => {
        const shift = getShift(staff.staff_member_id, isoDate(day));
        if (!shift) return '<td style="color:#999;font-size:10px">redovni</td>';
        if (shift.is_off) {
          const label = shift.off_reason === 'vacation' ? 'Godišnji' : shift.off_reason === 'sick' ? 'Bolovanje' : 'Slobodan';
          return `<td style="color:#888;font-size:10px">${label}</td>`;
        }
        const start = shift.start_time?.slice(0, 5) || '';
        const end   = shift.end_time?.slice(0, 5)   || '';
        const brk   = (shift.break_start && shift.break_end)
          ? `<div style="font-size:9px;color:#999">P: ${shift.break_start.slice(0,5)}–${shift.break_end.slice(0,5)}</div>` : '';
        const note  = shift.notes
          ? `<div style="font-size:9px;color:#666;font-style:italic">${shift.notes}</div>` : '';
        return `<td>${start}–${end}${brk}${note}</td>`;
      }).join('');
      return `<tr><td style="font-weight:500">${staff.staff_name}</td>${cells}</tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 16px; color: #111; }
  h2 { font-size: 14px; margin-bottom: 10px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: center; vertical-align: top; }
  th { background: #f0f0f0; font-size: 10px; }
  tr:nth-child(even) td { background: #fafafa; }
  td:first-child { text-align: left; white-space: nowrap; }
  @media print { @page { size: landscape; margin: 10mm; } }
</style>
</head><body>
<h2>${title}</h2>
<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  }

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

        <BusinessBookingNav active="schedule" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-semibold">{t('schedule.title')}</h1>
              <button
                type="button"
                onClick={() => setInfoOpen(o => !o)}
                className="text-muted-foreground/70 hover:text-muted-foreground transition-colors"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {!loading && staffRows.length > 0 && (
              <>
                <button
                  onClick={downloadSchedule}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors"
                  title={t('schedule.download')}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('schedule.download')}</span>
                </button>
                <button
                  onClick={printSchedulePDF}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors"
                  title={t('schedule.downloadPDF')}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('schedule.downloadPDF')}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Info panel */}
        {infoOpen && (
          <div className="mb-4 flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{t('schedule.info')}</p>
          </div>
        )}

        {/* View + navigation — both always visible */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {/* Week group */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors ${viewMode === 'week' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
            <button
              onClick={() => switchView('week')}
              className={`text-xs font-semibold px-1 py-0.5 rounded transition-colors ${viewMode === 'week' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('schedule.viewWeek')}
            </button>
            <button
              onClick={() => { setViewMode('week'); thisWeek(); }}
              className="text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border hover:bg-accent transition-colors"
            >
              {t('schedule.thisWeek')}
            </button>
            <div className="flex items-center gap-0.5">
              <button onClick={() => { setViewMode('week'); prevGlobalWeek(); }} disabled={prevGlobalWeekDisabled} className="p-1.5 rounded hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-medium text-foreground whitespace-nowrap px-0.5">
                {fmtDay(weekDays[0])} – {fmtDay(weekDays[6])} {weekDays[6].getFullYear()}.
              </span>
              <button onClick={() => { setViewMode('week'); nextGlobalWeek(); }} disabled={nextGlobalWeekDisabled} className="p-1.5 rounded hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Month group */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors ${viewMode === 'month' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
            <button
              onClick={() => switchView('month')}
              className={`text-xs font-semibold px-1 py-0.5 rounded transition-colors ${viewMode === 'month' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('schedule.viewMonth')}
            </button>
            <button
              onClick={() => { setViewMode('month'); goThisMonth(); }}
              className="text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border hover:bg-accent transition-colors"
            >
              {t('schedule.thisMonth')}
            </button>
            <div className="flex items-center gap-0.5">
              <button onClick={() => { setViewMode('month'); prevGlobalMonth(); }} disabled={prevGlobalMonthDisabled} className="p-1.5 rounded hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-medium text-foreground whitespace-nowrap px-0.5">
                {monthLabelCap}
              </span>
              <button onClick={() => { setViewMode('month'); nextGlobalMonth(); }} disabled={nextGlobalMonthDisabled} className="p-1.5 rounded hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Location filter pills — shown only when multi-location */}
        {locations.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mb-3 mt-2">
            <button
              onClick={() => setSchedLocId(null)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                schedLocId === null
                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
            >
              {t('schedule.locFilter.all')}
            </button>
            {locations.map(loc => (
              <button
                key={loc.id}
                onClick={() => setSchedLocId(loc.id)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  schedLocId === loc.id
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                }`}
              >
                <MapPin className="w-3 h-3 shrink-0" />
                {loc.name}
              </button>
            ))}
          </div>
        )}

        {/* Accept-bookings toggles */}
        {filteredStaff.length > 0 && (
          <div className="flex gap-x-4 overflow-x-auto scrollbar-hide mb-4 pl-1 pb-0.5">
            {filteredStaff.map(s => (
              <div key={s.id} className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] text-muted-foreground">{s.name}</span>
                <button
                  type="button"
                  title={t('staffHours.acceptBookings')}
                  onClick={() => handleToggleAccept(s.id, s.accept)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
                    s.accept ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5 ${
                    s.accept ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`} />
                </button>
                <span className="text-[10px] text-muted-foreground/60">{t('staffHours.acceptBookings')}</span>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">{t('schedule.noStaff')}</p>
          </div>
        ) : (
          /* ── PER-STAFF SCROLLABLE CARDS (week + month) ── */
          <div className="space-y-3">
            {[...filteredStaff]
              .sort((a, b) => {
                const order: Record<string, number> = { owner: 0, manager: 1, worker: 2 };
                return (order[a.role] ?? 2) - (order[b.role] ?? 2);
              })
              .map((sa) => {
                const effectiveWeek = cardWeeks[sa.id] ?? weekStart;
                const effectiveWeekDays = Array.from({ length: 7 }, (_, i) => addDays(effectiveWeek, i));
                const effectiveMonth = cardMonths[sa.id] ?? monthDate;
                const effectiveMonthDays = viewMode === 'month' ? getMonthDays(effectiveMonth) : [];
                const effectiveMonthLabel = `${SR_MONTHS[effectiveMonth.getMonth()]} ${effectiveMonth.getFullYear()}.`;
                const days = viewMode === 'week' ? effectiveWeekDays : effectiveMonthDays;
                const isOwnerStaff = sa.role === 'owner';
                const cardPrevDisabled = effectiveWeek.getTime() <= bookingStartMonday.getTime();
                const cardNextDisabled = addDays(effectiveWeek, 7).getTime() >= maxMonthStart.getTime();
                const cardMonthPrevDisabled = monthIdx(effectiveMonth) <= bookingStartIdx;
                const cardMonthNextDisabled = monthIdx(effectiveMonth) >= maxMonthIdx;
                return (
                  <div key={sa.id} className="rounded-xl border border-border overflow-hidden">
                    {/* Per-card navigation: week arrows or month arrows */}
                    {viewMode === 'week' ? (
                      <div className="flex items-center gap-1 px-2 py-1 bg-muted/20 border-b border-border">
                        <button onClick={() => navCard(sa.id, -1)} disabled={cardPrevDisabled} className="p-1.5 rounded hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground">
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-medium text-foreground px-0.5 whitespace-nowrap flex-1 text-center">
                          {fmtDay(effectiveWeekDays[0])} – {fmtDay(effectiveWeekDays[6])} {effectiveWeekDays[6].getFullYear()}.
                        </span>
                        <button onClick={() => navCard(sa.id, 1)} disabled={cardNextDisabled} className="p-1.5 rounded hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopyStaffWeek(sa.id, effectiveWeek)}
                          disabled={!!copyingMap[sa.id]}
                          title={t('schedule.copyWeek')}
                          className="ml-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground border border-border rounded px-1.5 py-0.5 transition-colors disabled:opacity-40"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-2 py-1 bg-muted/20 border-b border-border">
                        <button onClick={() => navCardMonth(sa.id, -1)} disabled={cardMonthPrevDisabled} className="p-1.5 rounded hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground">
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-medium text-foreground px-0.5 whitespace-nowrap flex-1 text-center">
                          {effectiveMonthLabel}
                        </span>
                        <button onClick={() => navCardMonth(sa.id, 1)} disabled={cardMonthNextDisabled} className="p-1.5 rounded hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {/* Scrollable date grid — name is first column */}
                    <div className="overflow-x-auto">
                      <table className="border-collapse" style={{ minWidth: viewMode === 'week' ? '580px' : `${100 + days.length * 44}px` }}>
                        <thead>
                          <tr className="bg-muted/20">
                            {/* Name column header — empty */}
                            <th className="border-b border-border border-r w-[100px] min-w-[100px]" />
                            {days.map((day, i) => {
                              const today = isToday(day);
                              const dow = day.getDay();
                              const isWeekend = dow === 0 || dow === 6;
                              if (viewMode === 'week') {
                                return (
                                  <th key={i} className={`px-2 py-2 text-center text-xs font-semibold border-b border-border border-l ${today ? 'text-primary bg-primary/5' : 'text-muted-foreground'} whitespace-nowrap`}>
                                    {t(DOW_KEYS[i])} <span className={`text-xs font-normal ${today ? 'text-primary' : 'text-muted-foreground/80'}`}>{fmtDay(day)}</span>
                                  </th>
                                );
                              } else {
                                return (
                                  <th key={i} className={`px-0 py-2 text-center border-b border-border border-l w-[44px] min-w-[44px] ${today ? 'text-primary bg-primary/5' : isWeekend ? 'text-muted-foreground/70 bg-muted/20' : 'text-muted-foreground'}`}>
                                    <div className="text-xs font-semibold leading-tight">{day.getDate()}</div>
                                    <div className="text-[10px] font-normal leading-tight opacity-70">{['N','P','U','S','Č','P','S'][dow]}</div>
                                  </th>
                                );
                              }
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {/* Name cell — first name / last name */}
                            {(() => {
                              const parts = sa.name.trim().split(' ');
                              const first = parts[0];
                              const last = parts.slice(1).join(' ');
                              return (
                                <td className="px-2 py-3 border-r border-border align-middle bg-muted/10">
                                  <div className="text-sm font-semibold text-foreground leading-tight whitespace-nowrap">{first}</div>
                                  {last && <div className="text-xs text-muted-foreground leading-tight whitespace-nowrap">{last}</div>}
                                  {isOwnerStaff && <div className="text-[11px] text-muted-foreground/80 leading-tight mt-0.5">{t('schedule.ownerLabel')}</div>}
                                </td>
                              );
                            })()}
                            {days.map((day, di) => {
                              const dateStr = isoDate(day);
                              const shift = getShift(sa.id, dateStr);
                              const absence = getAbsence(sa.id, dateStr);
                              const today = isToday(day);
                              const dow = day.getDay();
                              const isWeekend = dow === 0 || dow === 6;
                              let cellContent: React.ReactNode;
                              let cellCls = '';

                              if (viewMode === 'week') {
                                if (absence) {
                                  const reasonLabel = t(`setup.closures.reason.${absence.reason}` as Parameters<typeof t>[0]);
                                  cellContent = (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 text-center leading-tight px-1">{reasonLabel}</span>
                                      {absence.note && <span className="text-[9px] text-muted-foreground leading-tight truncate max-w-[60px]">{absence.note}</span>}
                                    </div>
                                  );
                                  cellCls = 'bg-amber-50 dark:bg-amber-950/20';
                                  return (
                                    <td key={di} className={`px-2 py-3 text-center ${di > 0 ? 'border-l' : ''} border-border ${cellCls}`}>
                                      {cellContent}
                                    </td>
                                  );
                                }
                                if (!shift) {
                                  // No explicit shift — show template from setup
                                  const defaultDay = staffDefaultHours[sa.id]?.[dow];
                                  if (defaultDay && !defaultDay.is_closed) {
                                    cellContent = (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-xs font-semibold text-green-600 dark:text-green-500">{defaultDay.start_time}</span>
                                        <span className="text-[10px] text-muted-foreground">–</span>
                                        <span className="text-xs font-semibold text-green-600 dark:text-green-500">{defaultDay.end_time}</span>
                                        <span className="text-[10px] text-muted-foreground/80">{t('schedule.defaultShort')}</span>
                                      </div>
                                    );
                                    cellCls = today ? 'bg-green-50/40 dark:bg-green-950/10' : 'bg-green-50/20 dark:bg-green-950/5';
                                  } else {
                                    cellContent = (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-xs font-medium px-1.5 py-0.5 rounded text-muted-foreground bg-muted/40 border border-dashed border-border">
                                          {t('schedule.dayOff')}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground/80">{t('schedule.defaultShort')}</span>
                                      </div>
                                    );
                                    cellCls = today ? 'bg-primary/3' : '';
                                  }
                                } else if (shift.is_off) {
                                  // Explicit off — show the specific off reason
                                  const offLabel = shift.off_reason === 'vacation'
                                    ? t('shift.vacation')
                                    : shift.off_reason === 'sick_leave'
                                    ? t('shift.sickLeave')
                                    : t('shift.dayOff');
                                  cellContent = (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="text-xs font-medium px-1.5 py-0.5 rounded text-muted-foreground bg-muted">
                                        {offLabel}
                                      </span>
                                    </div>
                                  );
                                  cellCls = 'bg-muted/20';
                                } else {
                                  // Explicit working shift
                                  cellContent = (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="text-xs font-semibold text-green-700 dark:text-green-400">{shift.start_time?.slice(0, 5)}</span>
                                      <span className="text-[10px] text-muted-foreground">–</span>
                                      <span className="text-xs font-semibold text-green-700 dark:text-green-400">{shift.end_time?.slice(0, 5)}</span>
                                      {shift.break_start && shift.break_end && <span className="text-[10px] text-orange-500 font-medium leading-tight mt-0.5">☕ {shift.break_start.slice(0,5)}–{shift.break_end.slice(0,5)}</span>}
                                      {shift.notes && <span className="text-[10px] text-muted-foreground leading-tight" title={shift.notes}>📝</span>}
                                    </div>
                                  );
                                  cellCls = 'bg-green-50 dark:bg-green-950/20';
                                }
                                return (
                                  <td key={di} className={`px-2 py-3 text-center ${di > 0 ? 'border-l' : ''} border-border cursor-pointer hover:bg-accent/60 transition-colors ${cellCls}`} onClick={() => openEdit(sa.id, sa.name, dateStr)}>
                                    {cellContent}
                                  </td>
                                );
                              } else {
                                // ── Monthly view ──
                                if (absence) {
                                  const reasonLabel = t(`setup.closures.reason.${absence.reason}` as Parameters<typeof t>[0]);
                                  cellContent = <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-400 leading-tight px-0.5 text-center">{reasonLabel.slice(0, 3)}</span>;
                                  cellCls = 'bg-amber-50 dark:bg-amber-950/20';
                                  return (
                                    <td key={di} className={`px-0 py-2 text-center border-l border-border ${cellCls}`} style={{ width: '44px' }} title={reasonLabel + (absence.note ? ` — ${absence.note}` : '')}>
                                      {cellContent}
                                    </td>
                                  );
                                }
                                if (!shift) {
                                  const defaultDay = staffDefaultHours[sa.id]?.[dow];
                                  if (defaultDay && !defaultDay.is_closed) {
                                    cellContent = (
                                      <div className="flex flex-col items-center leading-tight">
                                        <span className="text-[10px] font-semibold text-green-600 dark:text-green-500">{defaultDay.start_time.slice(0,5)}</span>
                                        <span className="text-[9px] text-muted-foreground/60">{defaultDay.end_time.slice(0,5)}</span>
                                      </div>
                                    );
                                    cellCls = 'bg-green-50/20 dark:bg-green-950/5';
                                  } else {
                                    cellContent = <span className="text-xs text-muted-foreground/60">—</span>;
                                    cellCls = isWeekend ? 'bg-muted/10' : (today ? 'bg-primary/3' : '');
                                  }
                                } else if (shift.is_off) {
                                  const offLabel = shift.off_reason === 'vacation'
                                    ? t('shift.vacation')
                                    : shift.off_reason === 'sick_leave'
                                    ? t('shift.sickLeave')
                                    : t('shift.dayOff');
                                  if (shift.off_reason === 'vacation') {
                                    cellContent = <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400 leading-tight">{offLabel.slice(0, 3)}</span>;
                                    cellCls = 'bg-blue-50/40 dark:bg-blue-950/20';
                                  } else if (shift.off_reason === 'sick_leave') {
                                    cellContent = <span className="text-[9px] font-semibold text-red-600 dark:text-red-400 leading-tight">{offLabel.slice(0, 3)}</span>;
                                    cellCls = 'bg-red-50/40 dark:bg-red-950/20';
                                  } else {
                                    cellContent = <span className="text-[9px] font-medium text-muted-foreground leading-tight">{offLabel.slice(0, 3)}</span>;
                                    cellCls = 'bg-muted/20';
                                  }
                                } else {
                                  const isOverride = shift.is_override;
                                  cellContent = (
                                    <div className="flex flex-col items-center leading-tight gap-0">
                                      <span className={`text-[10px] font-semibold ${isOverride ? 'text-green-700 dark:text-green-400' : 'text-green-600 dark:text-green-500'}`}>{shift.start_time?.slice(0,5)}</span>
                                      {shift.end_time && <span className="text-[9px] text-muted-foreground/70 leading-none">{shift.end_time.slice(0,5)}</span>}
                                      {shift.break_start && shift.break_end && <span className="text-[9px] text-orange-400 leading-none mt-0.5">☕ {shift.break_start.slice(0,5)}</span>}
                                      {shift.notes && <span className="text-[9px] text-muted-foreground leading-none">📝</span>}
                                    </div>
                                  );
                                  cellCls = isOverride ? 'bg-green-50 dark:bg-green-950/20' : 'bg-green-50/30 dark:bg-green-950/10';
                                }
                                const cellTitle = shift?.is_off
                                  ? (shift.off_reason === 'vacation' ? t('shift.vacation') : shift.off_reason === 'sick_leave' ? t('shift.sickLeave') : t('shift.dayOff'))
                                  : shift
                                  ? [
                                      shift.start_time && shift.end_time ? `${shift.start_time.slice(0,5)}–${shift.end_time.slice(0,5)}` : '',
                                      shift.break_start && shift.break_end ? `☕ ${shift.break_start.slice(0,5)}–${shift.break_end.slice(0,5)}` : '',
                                      shift.notes || '',
                                    ].filter(Boolean).join(' | ')
                                  : undefined;
                                return (
                                  <td key={di} className={`px-0 py-2 text-center border-l border-border cursor-pointer hover:bg-accent/60 transition-colors ${cellCls}`} style={{ width: '44px' }} title={cellTitle} onClick={() => openEdit(sa.id, sa.name, dateStr)}>
                                    {cellContent}
                                  </td>
                                );
                              }
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Legend */}
      </div>

      {/* Edit modal */}
      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setEdit(null); setShiftConflictCount(null); } }}
        >
          <div className="bg-background border border-border rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-sm text-foreground">{edit.staffName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(edit.date + 'T00:00:00').toLocaleDateString(locale, {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                </p>
              </div>
              <button onClick={() => { setEdit(null); setShiftConflictCount(null); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode selector */}
            <div className="flex gap-2 mb-4">
              {(['working', 'off'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setEdit(e => e ? { ...e, mode: m, ...(m === 'off' && !e.offReason ? { offReason: 'day_off' } : {}) } : e); if (m !== 'off') setShiftConflictCount(null); }}
                  className={`flex-1 text-xs font-semibold py-2 rounded-xl border transition-colors ${
                    edit.mode === m
                      ? m === 'off'
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-green-500 text-white border-green-500'
                      : 'bg-background border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {m === 'working' ? t('schedule.working') : t('schedule.dayOff')}
                </button>
              ))}
            </div>

            {/* Off-day reason selector */}
            {edit.mode === 'off' && (
              <div className="mb-4">
                <label className="text-[10px] text-muted-foreground block mb-1.5">{t('schedule.offReason')}</label>
                <div className="flex gap-2">
                  {(['day_off', 'vacation', 'sick_leave'] as const).map((r) => {
                    const label = r === 'vacation' ? t('shift.vacation') : r === 'sick_leave' ? t('shift.sickLeave') : t('shift.dayOff');
                    const active = edit.offReason === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setEdit(ev => ev ? { ...ev, offReason: r } : ev)}
                        className={`flex-1 text-xs font-medium py-1.5 rounded-lg border transition-colors ${
                          active
                            ? r === 'vacation'
                              ? 'bg-blue-500 text-white border-blue-500'
                              : r === 'sick_leave'
                              ? 'bg-red-500 text-white border-red-500'
                              : 'bg-muted text-foreground border-border'
                            : 'border-dashed border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground block mb-1">{t('schedule.breakStart')}</label>
                      <input
                        type="time"
                        value={edit.breakStart}
                        onChange={e => setEdit(ev => ev ? { ...ev, breakStart: e.target.value } : ev)}
                        className={timeCls + ' w-full'}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground block mb-1">{t('schedule.breakEnd')}</label>
                      <input
                        type="time"
                        value={edit.breakEnd}
                        onChange={e => setEdit(ev => ev ? { ...ev, breakEnd: e.target.value } : ev)}
                        className={timeCls + ' w-full'}
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

            {/* Booking conflict warning */}
            {edit.mode === 'off' && shiftConflictCount !== null && (
              <div className="flex flex-col gap-2 p-3 mb-3 rounded-xl border border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-700">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-orange-800 dark:text-orange-300 leading-relaxed">
                    {t('absences.staff.hasBookings').replace('{n}', String(shiftConflictCount))}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShiftConflictCount(null)}
                    className="flex-1 text-xs py-1.5 px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t('setup.closures.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="flex-1 text-xs py-1.5 px-3 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? '...' : t('absences.staff.saveAnyway')}
                  </button>
                </div>
              </div>
            )}

            {shiftConflictCount === null && (
              <button
                onClick={() => handleSave()}
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {saving ? '...' : t('schedule.save')}
              </button>
            )}
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
