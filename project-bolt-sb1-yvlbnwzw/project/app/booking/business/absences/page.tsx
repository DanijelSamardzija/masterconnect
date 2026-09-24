'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { ProtectedRoute } from '@/components/protected-route';
import { toast } from 'sonner';
import { AlertTriangle, X, Check, Loader2, MapPin } from 'lucide-react';
import { BusinessBookingNav } from '@/components/booking/business-booking-nav';
import { TradeOwnerNav } from '@/components/trade/TradeOwnerNav';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';

type BusinessClosure = {
  id: string;
  reason: string;
  note: string | null;
  date_from: string;
  date_to: string;
  is_past: boolean;
};

type StaffAbsence = {
  id: string;
  staff_member_id: string;
  staff_name: string;
  reason: string;
  note: string | null;
  date_from: string;
  date_to: string;
  is_past: boolean;
};

type StaffMember = {
  id: string;
  user_id: string;
  name: string;
  role: string;
  is_active: boolean;
};

const ABSENCE_REASONS = ['vacation', 'sick_leave', 'holiday', 'other'] as const;
const FIRM_REASONS = ['vacation', 'sick_leave', 'holiday', 'renovation', 'other'] as const;

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}.`;
}

export default function AbsencesPage() {
  const { user } = useAuth();
  const { activeProfileId, loading: profileCtxLoading } = useBookingProfile();
  const { t } = useLanguage();
  const router = useRouter();

  const [profileType, setProfileType] = useState<string | null>(null);
  useEffect(() => {
    if (!activeProfileId) { setProfileType(null); return; }
    (supabase as any).from('booking_profiles').select('profile_type').eq('id', activeProfileId).single()
      .then(({ data }: { data: { profile_type: string } | null }) => setProfileType(data?.profile_type ?? ''));
  }, [activeProfileId]);

  // Redirect to hub when context is ready but no active profile
  useEffect(() => {
    if (!profileCtxLoading && !activeProfileId) router.replace('/booking');
  }, [profileCtxLoading, activeProfileId, router]);

  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [closureLocId, setClosureLocId] = useState<string>('');
  const [staffAbsLocId, setStaffAbsLocId] = useState<string>('');  // any location of the business, for loading all staff absences
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'firm' | 'staff'>('firm');

  // Firma closures state
  const [closures, setClosures] = useState<BusinessClosure[]>([]);
  const [closureFrom, setClosureFrom] = useState('');
  const [closureTo, setClosureTo] = useState('');
  const [closureReason, setClosureReason] = useState('vacation');
  const [closureNote, setClosureNote] = useState('');
  const [closureSaving, setClosureSaving] = useState(false);
  const [closureWarning, setClosureWarning] = useState<number | null>(null);
  const [deletingClosureId, setDeletingClosureId] = useState<string | null>(null);

  // Staff absences state
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [absences, setAbsences] = useState<StaffAbsence[]>([]);
  const [absenceStaffId, setAbsenceStaffId] = useState('');
  const [absenceFrom, setAbsenceFrom] = useState('');
  const [absenceTo, setAbsenceTo] = useState('');
  const [absenceReason, setAbsenceReason] = useState('vacation');
  const [absenceNote, setAbsenceNote] = useState('');
  const [absenceSaving, setAbsenceSaving] = useState(false);
  const [absenceWarning, setAbsenceWarning] = useState<number | null>(null);
  const [deletingAbsenceId, setDeletingAbsenceId] = useState<string | null>(null);

  const loadClosures = useCallback(async (locId: string) => {
    const { data } = await (supabase as any).rpc('get_business_closures', { p_location_id: locId });
    setClosures((data as BusinessClosure[]) ?? []);
  }, []);

  const loadAbsences = useCallback(async (locId: string) => {
    const { data } = await (supabase as any).rpc('get_location_staff_absences', { p_location_id: locId });
    setAbsences((data as StaffAbsence[]) ?? []);
  }, []);

  useEffect(() => {
    if (!user || !activeProfileId) return;
    (async () => {
      setLoading(true);
      const [locsRes, staffRes] = await Promise.all([
        supabase.from('business_locations')
          .select('id, name, city, is_primary')
          .eq('business_id', activeProfileId)
          .eq('is_active', true)
          .order('is_primary', { ascending: false }),
        (supabase as any).rpc('get_my_staff', { p_business_id: activeProfileId }),
      ]);
      const locs = (locsRes.data as { id: string; name: string; city: string | null; is_primary: boolean }[]) ?? [];
      setLocations(locs);
      const primaryId = locs.find(l => l.is_primary)?.id ?? locs[0]?.id ?? null;
      if (primaryId) {
        setClosureLocId(primaryId);
        setStaffAbsLocId(primaryId);
      }
      const allStaff: StaffMember[] = ((staffRes.data as StaffMember[]) ?? []);
      const self = allStaff.find((sm) => sm.user_id === user.id);
      setCallerRole(self?.role ?? 'owner');
      setStaffMembers(allStaff.filter((sm) => sm.is_active));
      if (primaryId) {
        await Promise.all([loadClosures(primaryId), loadAbsences(primaryId)]);
      }
      setLoading(false);
    })();
  }, [user, activeProfileId, loadClosures, loadAbsences]);

  // ── Firma closure handlers ─────────────────────────────────────────────────

  async function handleSaveClosure(force = false) {
    if (!closureLocId || !closureFrom || !closureTo) return;
    if (closureTo < closureFrom) {
      toast.error(t('setup.closures.from') + ' > ' + t('setup.closures.to'));
      return;
    }
    setClosureSaving(true);
    setClosureWarning(null);
    const { data } = await (supabase as any).rpc('create_business_closure', {
      p_location_id: closureLocId,
      p_date_from: closureFrom,
      p_date_to: closureTo,
      p_reason: closureReason,
      p_note: closureNote.trim() || null,
      p_force: force,
    });
    setClosureSaving(false);
    const result = data as { ok: boolean; warning?: string; booking_count?: number } | null;
    if (!result?.ok) {
      if (result?.warning === 'has_bookings' && result?.booking_count) {
        setClosureWarning(result.booking_count);
        return;
      }
      toast.error(t('setup.error.saveFailed'));
      return;
    }
    toast.success(t('setup.closures.saved'));
    setClosureFrom(''); setClosureTo(''); setClosureReason('vacation'); setClosureNote('');
    loadClosures(closureLocId);
  }

  async function handleDeleteClosure(id: string) {
    setDeletingClosureId(id);
    const { data } = await (supabase as any).rpc('delete_business_closure', { p_closure_id: id });
    setDeletingClosureId(null);
    if (!(data as { ok: boolean } | null)?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    toast.success(t('setup.closures.deleted'));
    if (closureLocId) loadClosures(closureLocId);
  }

  async function handleSelectClosureLoc(locId: string) {
    setClosureLocId(locId);
    setClosureWarning(null);
    loadClosures(locId);
  }

  // ── Staff absence handlers ─────────────────────────────────────────────────

  async function handleSaveAbsence(force = false) {
    if (!absenceStaffId || !absenceFrom || !absenceTo) return;
    if (absenceTo < absenceFrom) {
      toast.error(t('setup.closures.from') + ' > ' + t('setup.closures.to'));
      return;
    }
    setAbsenceSaving(true);
    setAbsenceWarning(null);
    const { data } = await (supabase as any).rpc('create_staff_absence', {
      p_staff_member_id: absenceStaffId,
      p_date_from: absenceFrom,
      p_date_to: absenceTo,
      p_reason: absenceReason,
      p_note: absenceNote.trim() || null,
      p_force: force,
    });
    setAbsenceSaving(false);
    const result = data as { ok: boolean; warning?: string; booking_count?: number } | null;
    if (!result?.ok) {
      if (result?.warning === 'has_bookings' && result?.booking_count) {
        setAbsenceWarning(result.booking_count);
        return;
      }
      toast.error(t('setup.error.saveFailed'));
      return;
    }
    toast.success(t('absences.staff.saved'));
    setAbsenceStaffId(''); setAbsenceFrom(''); setAbsenceTo(''); setAbsenceReason('vacation'); setAbsenceNote('');
    if (staffAbsLocId) loadAbsences(staffAbsLocId);
  }

  async function handleDeleteAbsence(id: string) {
    setDeletingAbsenceId(id);
    const { data } = await (supabase as any).rpc('delete_staff_absence', { p_absence_id: id });
    setDeletingAbsenceId(null);
    if (!(data as { ok: boolean } | null)?.ok) { toast.error(t('setup.error.saveFailed')); return; }
    toast.success(t('absences.staff.deleted'));
    if (staffAbsLocId) loadAbsences(staffAbsLocId);
  }

  function getReasonLabel(reason: string): string {
    const key = `setup.closures.reason.${reason}` as Parameters<typeof t>[0];
    return ['vacation','sick_leave','holiday','renovation','other','blocked','break'].includes(reason) ? t(key) : reason;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto px-4 py-6">

          {profileType === 'tradespeople' && activeProfileId
            ? <TradeOwnerNav profileId={activeProfileId} active="staff" />
            : profileType !== null ? <BusinessBookingNav active="absences" /> : null
          }

          {/* Sub-nav: Raspored smjena ↔ Odsustva — only in trade context */}
          {profileType === 'tradespeople' && (
            <div className="flex w-full gap-1 p-1 rounded-xl bg-muted/50 mb-5">
              <button
                onClick={() => router.push('/booking/business/schedule')}
                className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors text-muted-foreground hover:text-foreground"
              >
                {t('schedule.title')}
              </button>
              <button
                className="flex-1 py-2 text-sm font-semibold rounded-lg transition-colors bg-background text-primary shadow-sm"
              >
                {t('absences.title')}
              </button>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-lg font-semibold">{t('absences.title')}</h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-muted/50 mb-6">
            {(['firm', 'staff'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'firm' ? t('absences.tab.firm') : t('absences.tab.staff')}
              </button>
            ))}
          </div>

          {(profileCtxLoading || !activeProfileId || loading) ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* ── Firma tab ─────────────────────────────────────────────── */}
              {activeTab === 'firm' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h2 className="font-semibold text-sm">{t('setup.closures.heading')}</h2>
                    {locations.length > 1 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        {locations.map(loc => (
                          <button
                            key={loc.id}
                            type="button"
                            onClick={() => handleSelectClosureLoc(loc.id)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                              closureLocId === loc.id
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border text-muted-foreground hover:border-primary'
                            }`}
                          >
                            {loc.name}{loc.city ? ` · ${loc.city}` : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Closure list */}
                  {closures.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {closures.map((c) => (
                        <div
                          key={c.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${
                            c.is_past
                              ? 'border-border/30 bg-muted/30 text-muted-foreground'
                              : 'border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800'
                          }`}
                        >
                          <span className="flex-1 min-w-0">
                            <span className="font-medium">{getReasonLabel(c.reason)}</span>
                            {c.is_past && (
                              <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                {t('setup.closures.past')}
                              </span>
                            )}
                            <span className="text-muted-foreground ml-1.5">
                              {formatDate(c.date_from)} – {formatDate(c.date_to)}
                            </span>
                            {c.note && <span className="block text-muted-foreground/70 truncate mt-0.5">{c.note}</span>}
                          </span>
                          {!c.is_past && (
                            <button
                              onClick={() => handleDeleteClosure(c.id)}
                              disabled={deletingClosureId === c.id}
                              className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              {deletingClosureId === c.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <X className="w-3.5 h-3.5" />
                              }
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('setup.closures.empty')}</p>
                  )}

                  {/* Warning */}
                  {closureWarning !== null && (
                    <div className="flex flex-col gap-2 p-3 rounded-xl border border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-700">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-orange-800 dark:text-orange-300">{t('setup.closures.warning')}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setClosureWarning(null)}
                          className="flex-1 text-xs py-1.5 px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {t('setup.closures.cancel')}
                        </button>
                        <button
                          onClick={() => handleSaveClosure(true)}
                          disabled={closureSaving}
                          className="flex-1 text-xs py-1.5 px-3 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
                        >
                          {closureSaving ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : t('setup.closures.confirm')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Add form */}
                  {closureWarning === null && (
                    <div className="flex flex-col gap-2 p-3 rounded-xl border border-border/60 bg-muted/20">
                      <div className="flex gap-2">
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs font-medium text-muted-foreground">{t('setup.closures.from')}</label>
                          <input
                            type="date"
                            value={closureFrom}
                            onChange={(e) => { setClosureFrom(e.target.value); setClosureWarning(null); }}
                            className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs font-medium text-muted-foreground">{t('setup.closures.to')}</label>
                          <input
                            type="date"
                            value={closureTo}
                            min={closureFrom}
                            onChange={(e) => { setClosureTo(e.target.value); setClosureWarning(null); }}
                            className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={closureReason}
                          onChange={(e) => setClosureReason(e.target.value)}
                          className="flex-1 border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          {FIRM_REASONS.map((r) => (
                            <option key={r} value={r}>{getReasonLabel(r)}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={closureNote}
                          onChange={(e) => setClosureNote(e.target.value)}
                          placeholder={t('setup.closures.note')}
                          className="flex-1 border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <button
                        onClick={() => handleSaveClosure(false)}
                        disabled={closureSaving || !closureFrom || !closureTo}
                        className="self-start flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {closureSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {t('setup.closures.save')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Radnici tab ───────────────────────────────────────────── */}
              {activeTab === 'staff' && (
                <div className="flex flex-col gap-4">
                  <h2 className="font-semibold text-sm">{t('absences.tab.staff')}</h2>

                  {staffMembers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('absences.staff.noStaff')}</p>
                  ) : (
                    <>
                      {/* Add absence form */}
                      <div className="flex flex-col gap-2 p-3 rounded-xl border border-border/60 bg-muted/20">
                        <select
                          value={absenceStaffId}
                          onChange={(e) => { setAbsenceStaffId(e.target.value); setAbsenceWarning(null); }}
                          className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="">{t('absences.staff.selectPlaceholder')}</option>
                          {staffMembers.map((sm) => (
                            <option key={sm.id} value={sm.id}>{sm.name}</option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <div className="flex flex-col gap-1 flex-1">
                            <label className="text-xs font-medium text-muted-foreground">{t('setup.closures.from')}</label>
                            <input
                              type="date"
                              value={absenceFrom}
                              onChange={(e) => { setAbsenceFrom(e.target.value); setAbsenceWarning(null); }}
                              className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                          <div className="flex flex-col gap-1 flex-1">
                            <label className="text-xs font-medium text-muted-foreground">{t('setup.closures.to')}</label>
                            <input
                              type="date"
                              value={absenceTo}
                              min={absenceFrom}
                              onChange={(e) => { setAbsenceTo(e.target.value); setAbsenceWarning(null); }}
                              className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <select
                            value={absenceReason}
                            onChange={(e) => setAbsenceReason(e.target.value)}
                            className="flex-1 border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                          >
                            {ABSENCE_REASONS.map((r) => (
                              <option key={r} value={r}>{getReasonLabel(r)}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={absenceNote}
                            onChange={(e) => setAbsenceNote(e.target.value)}
                            placeholder={t('setup.closures.note')}
                            className="flex-1 border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>

                        {/* Booking conflict warning */}
                        {absenceWarning !== null && (
                          <div className="flex flex-col gap-2 p-2.5 rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-700">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-orange-800 dark:text-orange-300 leading-relaxed">
                                {t('absences.staff.hasBookings').replace('{n}', String(absenceWarning))}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setAbsenceWarning(null)}
                                className="flex-1 text-xs py-1.5 px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {t('setup.closures.cancel')}
                              </button>
                              <button
                                onClick={() => handleSaveAbsence(true)}
                                disabled={absenceSaving}
                                className="flex-1 text-xs py-1.5 px-3 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
                              >
                                {absenceSaving ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : t('absences.staff.saveAnyway')}
                              </button>
                            </div>
                          </div>
                        )}

                        {absenceWarning === null && (
                          <button
                            onClick={() => handleSaveAbsence(false)}
                            disabled={absenceSaving || !absenceStaffId || !absenceFrom || !absenceTo}
                            className="self-start flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            {absenceSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            {t('setup.closures.save')}
                          </button>
                        )}
                      </div>

                      {/* Absence list grouped by staff member */}
                      {staffMembers.map((sm) => {
                        const memberAbsences = absences.filter((a) => a.staff_member_id === sm.id);
                        if (memberAbsences.length === 0) return null;
                        return (
                          <div key={sm.id} className="flex flex-col gap-1.5">
                            <p className="text-xs font-semibold text-foreground">{sm.name}</p>
                            {memberAbsences.map((a) => (
                              <div
                                key={a.id}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${
                                  a.is_past
                                    ? 'border-border/30 bg-muted/30 text-muted-foreground'
                                    : 'border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800'
                                }`}
                              >
                                <span className="flex-1 min-w-0">
                                  <span className="font-medium">{getReasonLabel(a.reason)}</span>
                                  {a.is_past && (
                                    <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                      {t('setup.closures.past')}
                                    </span>
                                  )}
                                  <span className="text-muted-foreground ml-1.5">
                                    {formatDate(a.date_from)} – {formatDate(a.date_to)}
                                  </span>
                                  {a.note && <span className="block text-muted-foreground/70 truncate mt-0.5">{a.note}</span>}
                                </span>
                                {!a.is_past && (
                                  <button
                                    onClick={() => handleDeleteAbsence(a.id)}
                                    disabled={deletingAbsenceId === a.id}
                                    className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  >
                                    {deletingAbsenceId === a.id
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <X className="w-3.5 h-3.5" />
                                    }
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })}

                      {absences.filter((a) => !a.is_past).length === 0 && absences.filter((a) => a.is_past).length === 0 && (
                        <p className="text-xs text-muted-foreground">{t('absences.staff.empty')}</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
