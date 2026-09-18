'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/contexts/language-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ChevronLeft, ChevronRight, Calendar, Users, CheckCircle2, XCircle,
  Clock, AlertCircle, Plus, Trash2, MapPin
} from 'lucide-react';
import { BusinessBookingNav } from '@/components/booking/business-booking-nav';

type Booking = {
  id: string;
  starts_at: string;
  ends_at: string;
  service_name_snapshot: string;
  status: string;
  staff_member_id: string | null;
  location_id: string | null;
  location: { name: string } | null;
  notes: string | null;
  client_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  guest_name: string | null;
  guest_phone: string | null;
};

type HistoryBooking = { id: string; starts_at: string; service_name_snapshot: string; status: string };

type StaffMember = { id: string; name: string };
type Service     = { id: string; name: string; duration_minutes: number };
type Slot        = { slot_start: string; slot_end: string; available: boolean };
type Filter = 'upcoming' | 'pending' | 'all';

// Monday of the week containing `date`
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

function OwnerBookingsContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const { t, language } = useLanguage();
  const locale = { sr: 'sr-RS', en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' }[language] ?? 'en-US';

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [staff, setStaff]         = useState<StaffMember[]>([]);
  const [services, setServices]   = useState<Service[]>([]);
  const [locationId, setLocationId]   = useState<string>('');
  const [locations, setLocations]     = useState<{ id: string; name: string }[]>([]);
  const [locFilter, setLocFilter]     = useState<string>('all');
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<Filter>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('ownerBookingsFilter') : null;
      if (saved === 'upcoming' || saved === 'pending' || saved === 'all') return saved;
    } catch {}
    return 'upcoming';
  });
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [isOwner, setIsOwner]     = useState<boolean | null>(null);
  const [staffMemberId, setStaffMemberId] = useState<string | null>(null);
  const [staffBizId, setStaffBizId]       = useState<string | null>(null);
  const [staffPerms, setStaffPerms]       = useState<{ can_cancel_bookings: boolean; can_reschedule_bookings: boolean }>({ can_cancel_bookings: false, can_reschedule_bookings: false });
  const [staffBookings, setStaffBookings] = useState<Booking[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Reassign modal
  const [reassignOpen, setReassignOpen]           = useState(false);
  const [reassignBookingId, setReassignBookingId] = useState<string | null>(null);
  const [reassignStaffId, setReassignStaffId]     = useState('');

  // Cancel modal
  const [cancelOpen, setCancelOpen]           = useState(false);
  const [deleteOpen, setDeleteOpen]           = useState(false);
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason]       = useState('');

  // Reschedule modal
  const [rescheduleOpen, setRescheduleOpen]           = useState(false);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate]           = useState('');
  const [rescheduleTime, setRescheduleTime]           = useState('');
  const [rescheduleWeek, setRescheduleWeek]           = useState<Date>(weekMonday(new Date()));
  const [rescheduleLoading, setRescheduleLoading]     = useState(false);

  // Client history modal
  const [historyOpen, setHistoryOpen]           = useState(false);
  const [historyClientId, setHistoryClientId]   = useState<string | null>(null);
  const [historyClientName, setHistoryClientName] = useState('');
  const [historyBookings, setHistoryBookings]   = useState<HistoryBooking[]>([]);
  const [historyLoading, setHistoryLoading]     = useState(false);

  // Manual booking modal
  const [addOpen, setAddOpen]             = useState(false);
  const [addServiceId, setAddServiceId]   = useState('');
  const [addStaffId, setAddStaffId]       = useState('');
  const [addWeek, setAddWeek]             = useState<Date>(weekMonday(new Date()));
  const [addSelectedDay, setAddSelectedDay] = useState<string>('');   // YYYY-MM-DD
  const [addSlotStart, setAddSlotStart]   = useState<string>('');     // ISO
  const [addSlots, setAddSlots]           = useState<Slot[]>([]);
  const [addSlotsLoading, setAddSlotsLoading] = useState(false);
  const [addName, setAddName]             = useState('');
  const [addPhone, setAddPhone]           = useState('');
  const [addNotes, setAddNotes]           = useState('');
  const [addLoading, setAddLoading]       = useState(false);

  useEffect(() => {
    if (!profile) return;
    checkOwnerRole();
    fetchStaff();
    fetchServices();
    fetchLocation();
  }, [profile]);

  useEffect(() => {
    if (isOwner) fetchBookings();
  }, [isOwner, filter, staffFilter, locFilter]);

  useEffect(() => {
    if (staffMemberId && staffBizId) fetchStaffBookings();
  }, [staffMemberId, staffBizId]);

  // Fetch slots whenever week, service, or staff changes (and modal is open)
  useEffect(() => {
    if (addOpen && addServiceId && locationId) fetchSlots();
  }, [addOpen, addServiceId, addWeek, locationId]);

  const checkOwnerRole = async () => {
    if (!profile) return;
    const { data: ownerData } = await (supabase as any)
      .from('staff_members').select('role')
      .eq('business_id', profile.id).eq('user_id', profile.id)
      .eq('is_active', true).in('role', ['owner', 'manager'])
      .limit(1).maybeSingle();
    if (ownerData) { setIsOwner(true); return; }

    // Not owner — check if staff member of another business
    const { data: smData } = await (supabase as any)
      .from('staff_members').select('id, business_id, permissions')
      .eq('user_id', profile.id).eq('is_active', true)
      .not('role', 'in', '("owner","manager")')
      .limit(1).maybeSingle();
    if (smData) {
      const p = smData.permissions ?? {};
      setStaffMemberId(smData.id);
      setStaffBizId(smData.business_id);
      setStaffPerms({
        can_cancel_bookings:     !!p.can_cancel_bookings,
        can_reschedule_bookings: !!p.can_reschedule_bookings,
      });
    }
    setIsOwner(false);
  };

  const fetchStaff = async () => {
    if (!profile) return;
    const { data } = await (supabase as any)
      .from('staff_members')
      .select('id, profiles!staff_members_user_id_fkey(name)')
      .eq('business_id', profile.id).eq('is_active', true);
    if (data) setStaff(data.map((s: any) => ({ id: s.id, name: s.profiles?.name || '—' })));
  };

  const fetchServices = async () => {
    if (!profile) return;
    const { data } = await (supabase as any)
      .from('service_catalog').select('id, name, duration_minutes')
      .eq('business_id', profile.id).eq('is_active', true);
    if (data) setServices(data);
  };

  const fetchLocation = async () => {
    if (!profile) return;
    const { data } = await (supabase as any)
      .from('business_locations').select('id, name')
      .eq('business_id', profile.id).eq('is_active', true)
      .order('is_primary', { ascending: false });
    if (data?.length) {
      setLocationId(data[0].id);
      setLocations(data.map((l: any) => ({ id: l.id, name: l.name })));
    }
  };

  const fetchStaffBookings = async () => {
    if (!staffMemberId || !staffBizId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from('bookings')
      .select('id, starts_at, ends_at, service_name_snapshot, status, staff_member_id, location_id, location:location_id(name), notes, client_id, guest_name, guest_phone, profiles!bookings_client_id_fkey(name, phone)')
      .eq('business_id', staffBizId)
      .eq('staff_member_id', staffMemberId)
      .gte('starts_at', new Date().toISOString())
      .in('status', ['pending', 'confirmed'])
      .order('starts_at', { ascending: true })
      .limit(50);
    setStaffBookings((data || []).map((b: any) => ({
      ...b,
      client_id:    b.client_id    ?? null,
      client_name:  b.profiles?.name  ?? null,
      client_phone: b.profiles?.phone ?? null,
    })));
    setLoading(false);
  };

  const fetchBookings = async () => {
    if (!profile) return;
    setLoading(true);
    let query = (supabase as any)
      .from('bookings')
      .select('id, starts_at, ends_at, service_name_snapshot, status, staff_member_id, location_id, location:location_id(name), notes, client_id, guest_name, guest_phone, profiles!bookings_client_id_fkey(name, phone)')
      .eq('business_id', profile.id);
    if (filter === 'upcoming')
      query = query.gte('starts_at', new Date().toISOString()).in('status', ['pending', 'confirmed']);
    else if (filter === 'pending')
      query = query.eq('status', 'pending');
    if (staffFilter !== 'all') query = query.eq('staff_member_id', staffFilter);
    if (locFilter !== 'all') query = query.eq('location_id', locFilter);
    const { data } = await query.order('starts_at', { ascending: filter !== 'all' }).limit(50);
    setBookings((data || []).map((b: any) => ({
      ...b,
      client_id:    b.client_id    ?? null,
      client_name:  b.profiles?.name  ?? null,
      client_phone: b.profiles?.phone ?? null,
    })));
    setLoading(false);
  };

  const fetchSlots = useCallback(async () => {
    if (!profile || !addServiceId || !locationId) return;
    setAddSlotsLoading(true);
    setAddSlots([]);
    setAddSlotStart('');
    const { data } = await (supabase as any).rpc('get_available_slots', {
      p_business_id: profile.id,
      p_location_id: locationId,
      p_service_id:  addServiceId,
      p_week_start:  toDateKey(addWeek),
    });
    setAddSlots(data || []);
    setAddSlotsLoading(false);
  }, [profile, addServiceId, locationId, addWeek]);

  const handleConfirm = async (bookingId: string) => {
    setActionLoading(bookingId + '-confirm');
    const { data, error } = await (supabase as any).rpc('owner_confirm_booking', { p_booking_id: bookingId });
    setActionLoading(null);
    if (error || data?.ok === false) { toast.error(data?.error || 'Greška'); return; }
    toast.success(t('ownerBookings.confirmed'));
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'confirmed' } : b));
  };

  const openCancelModal = (bookingId: string) => {
    setCancelBookingId(bookingId);
    setCancelReason('');
    setCancelOpen(true);
  };

  const handleCancel = async () => {
    if (!cancelBookingId) return;
    setActionLoading(cancelBookingId + '-cancel');
    const rpc = isOwner ? 'owner_cancel_booking' : 'staff_cancel_booking';
    const { data, error } = await (supabase as any).rpc(rpc, {
      p_booking_id: cancelBookingId,
      p_reason: cancelReason.trim() || null,
    });
    setActionLoading(null);
    if (error || data?.ok === false) { toast.error(data?.error || 'Greška'); return; }
    toast.success(t('ownerBookings.cancelled'));
    fetch('/api/booking/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cancellation', booking_id: cancelBookingId }),
    }).catch(() => {});
    if (isOwner) {
      setBookings(prev => prev.filter(b => b.id !== cancelBookingId));
    } else {
      setStaffBookings(prev => prev.filter(b => b.id !== cancelBookingId));
    }
    setCancelOpen(false);
    setCancelBookingId(null);
    setCancelReason('');
  };

  const handleDelete = async () => {
    if (!deleteBookingId) return;
    setActionLoading(deleteBookingId + '-delete');
    const { data, error } = await (supabase as any).rpc('owner_delete_booking', {
      p_booking_id: deleteBookingId,
    });
    setActionLoading(null);
    if (error || data?.ok === false) { toast.error('Greška pri brisanju'); return; }
    toast.success(t('ownerBookings.deleted'));
    setBookings(prev => prev.filter(b => b.id !== deleteBookingId));
    setDeleteOpen(false);
    setDeleteBookingId(null);
  };

  const handleReassign = async () => {
    if (!reassignBookingId || !reassignStaffId) return;
    setActionLoading(reassignBookingId + '-reassign');
    const { data, error } = await (supabase as any).rpc('owner_reassign_booking', {
      p_booking_id: reassignBookingId,
      p_staff_member_id: reassignStaffId,
    });
    setActionLoading(null);
    if (error || data?.ok === false) {
      if (data?.error === 'staff_conflict') toast.error(t('ownerBookings.errorStaffConflict'));
      else toast.error(data?.error || 'Greška');
      return;
    }
    toast.success(t('ownerBookings.reassigned'));
    setBookings(prev => prev.map(b => b.id === reassignBookingId ? { ...b, staff_member_id: reassignStaffId } : b));
    setReassignOpen(false);
    setReassignBookingId(null);
  };

  const openReschedule = (b: Booking) => {
    setRescheduleBookingId(b.id);
    const d = new Date(b.starts_at);
    const dateKey = d.toISOString().slice(0, 10);
    setRescheduleDate(dateKey);
    setRescheduleWeek(weekMonday(d));
    const h = String(d.getHours()).padStart(2, '0');
    const rawM = d.getMinutes();
    const m = String(Math.round(rawM / 5) * 5 % 60).padStart(2, '0');
    setRescheduleTime(`${h}:${m}`);
    setRescheduleOpen(true);
  };

  const handleReschedule = async () => {
    if (!rescheduleBookingId || !rescheduleDate || !rescheduleTime) return;
    setRescheduleLoading(true);
    const isoStr = new Date(`${rescheduleDate}T${rescheduleTime}`).toISOString();
    const rpc = isOwner ? 'owner_reschedule_booking' : 'staff_reschedule_booking';
    const { data, error } = await (supabase as any).rpc(rpc, {
      p_booking_id:    rescheduleBookingId,
      p_new_starts_at: isoStr,
    });
    setRescheduleLoading(false);
    if (error || data?.ok === false) {
      const key = data?.error === 'conflict'
        ? 'ownerBookings.rescheduleError.conflict'
        : 'ownerBookings.rescheduleError.tooSoon';
      toast.error(t(key as Parameters<typeof t>[0]));
      return;
    }
    toast.success(t('ownerBookings.rescheduled'));
    fetch('/api/booking/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'reschedule', booking_id: rescheduleBookingId }),
    }).catch(() => {});
    setRescheduleOpen(false);
    setRescheduleBookingId(null);
    if (isOwner) fetchBookings(); else fetchStaffBookings();
  };

  const openHistory = async (clientId: string, clientName: string) => {
    setHistoryClientId(clientId);
    setHistoryClientName(clientName);
    setHistoryLoading(true);
    setHistoryOpen(true);
    setHistoryBookings([]);
    const { data } = await (supabase as any)
      .from('bookings')
      .select('id, starts_at, service_name_snapshot, status')
      .eq('business_id', profile?.id)
      .eq('client_id', clientId)
      .order('starts_at', { ascending: false })
      .limit(20);
    setHistoryBookings(data || []);
    setHistoryLoading(false);
  };

  const openReassign = (b: Booking) => {
    setReassignBookingId(b.id);
    setReassignStaffId(b.staff_member_id || '');
    setReassignOpen(true);
  };

  const openAddModal = () => {
    const monday = weekMonday(new Date());
    setAddWeek(monday);
    setAddSelectedDay(toDateKey(new Date()));
    setAddSlotStart('');
    setAddSlots([]);
    setAddServiceId(services[0]?.id || '');
    setAddStaffId(staff[0]?.id || '');
    setAddName('');
    setAddPhone('');
    setAddNotes('');
    setAddOpen(true);
  };

  const handleAddBooking = async () => {
    if (!addServiceId || !addStaffId || !addSlotStart || !addName.trim()) return;
    setAddLoading(true);
    const { data, error } = await (supabase as any).rpc('owner_create_booking', {
      p_service_id:      addServiceId,
      p_staff_member_id: addStaffId,
      p_starts_at:       addSlotStart,
      p_guest_name:      addName.trim(),
      p_guest_phone:     addPhone.trim() || null,
      p_notes:           addNotes.trim() || null,
    });
    setAddLoading(false);
    if (error || data?.ok === false) { toast.error(data?.error || 'Greška'); return; }
    toast.success(t('ownerBookings.add.success'));
    setAddOpen(false);
    fetchBookings();
  };

  // Slots grouped by day key
  const slotsByDay: Record<string, Slot[]> = {};
  for (const s of addSlots) {
    const key = s.slot_start.slice(0, 10);
    if (!slotsByDay[key]) slotsByDay[key] = [];
    if (s.available) slotsByDay[key].push(s);
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(addWeek, i));

  const clientLabel = (b: Booking) => b.client_name || b.guest_name;

  const statusConfig: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    pending:   { label: t('ownerBookings.status.pending'),   cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400', icon: <Clock className="h-3 w-3" /> },
    confirmed: { label: t('ownerBookings.status.confirmed'), cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',   icon: <CheckCircle2 className="h-3 w-3" /> },
    completed: { label: t('ownerBookings.status.completed'), cls: 'bg-muted text-muted-foreground', icon: <CheckCircle2 className="h-3 w-3" /> },
    no_show:   { label: t('ownerBookings.status.no_show'),   cls: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',           icon: <AlertCircle className="h-3 w-3" /> },
    cancelled: { label: t('ownerBookings.status.cancelled'), cls: 'bg-muted text-muted-foreground', icon: <XCircle className="h-3 w-3" /> },
  };

  if (isOwner === false && !staffMemberId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('ownerBookings.noPermission')}</p>
      </div>
    );
  }

  // Staff view (non-owner staff member with bookings assigned to them)
  if (isOwner === false && staffMemberId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
          <BusinessBookingNav active="bookings" />
          <div>
            <h1 className="text-xl font-bold text-foreground">{t('ownerBookings.staffView.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('ownerBookings.staffView.subtitle')}</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-7 w-7 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
            </div>
          ) : staffBookings.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl px-5 py-12 text-center">
              <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">{t('ownerBookings.staffView.empty')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {staffBookings.map(b => {
                const sc = statusConfig[b.status] ?? { label: b.status, cls: 'bg-muted text-muted-foreground', icon: null };
                const isPast   = new Date(b.starts_at) < new Date();
                const isActive = ['pending', 'confirmed'].includes(b.status);
                const client   = b.client_name || b.guest_name;
                const displaySc = (isPast && isActive)
                  ? { ...sc, label: t('ownerBookings.status.pastDone'), cls: 'bg-muted text-muted-foreground' }
                  : sc;
                return (
                  <div key={b.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {new Date(b.starts_at).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(b.starts_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                          {' – '}
                          {new Date(b.ends_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${displaySc.cls}`}>
                        {displaySc.icon} {displaySc.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground truncate">{b.service_name_snapshot}</span>
                    </div>
                    {client && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3 w-3 shrink-0" />
                        <span className="font-medium text-foreground">{client}</span>
                        {(b.client_phone || b.guest_phone) && (
                          <span>· {b.client_phone || b.guest_phone}</span>
                        )}
                      </div>
                    )}
                    {b.notes?.trim() && <p className="text-xs text-muted-foreground/70 italic">{b.notes}</p>}
                    {isActive && (staffPerms.can_reschedule_bookings || staffPerms.can_cancel_bookings) && (
                      <div className="flex items-center gap-2 pt-1 border-t border-border">
                        {!isPast && staffPerms.can_reschedule_bookings && (
                          <button onClick={() => openReschedule(b)} disabled={!!actionLoading}
                            className="flex items-center justify-center gap-1.5 bg-muted hover:bg-muted/80 disabled:opacity-50 text-foreground rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
                          >
                            <Clock className="h-3.5 w-3.5" />
                            {t('ownerBookings.reschedule')}
                          </button>
                        )}
                        {!isPast && staffPerms.can_cancel_bookings && (
                          <button onClick={() => openCancelModal(b.id)} disabled={!!actionLoading}
                            className="flex items-center justify-center gap-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:hover:bg-red-900 disabled:opacity-50 text-red-600 dark:text-red-400 rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            {t('ownerBookings.cancel')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Reschedule modal (reused) */}
        <Dialog open={rescheduleOpen} onOpenChange={o => { if (!o) { setRescheduleOpen(false); setRescheduleBookingId(null); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                {t('ownerBookings.rescheduleModal.title')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{t('ownerBookings.rescheduleModal.dateLabel')}</label>
                <div className="flex items-center justify-between mb-1">
                  <button onClick={() => setRescheduleWeek(w => addDays(w, -7))} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="text-xs font-semibold text-foreground">
                    {rescheduleWeek.toLocaleDateString(locale, { day: 'numeric', month: 'long' })}
                    {' – '}
                    {addDays(rescheduleWeek, 6).toLocaleDateString(locale, { day: 'numeric', month: 'long' })}
                  </span>
                  <button onClick={() => setRescheduleWeek(w => addDays(w, 7))} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><ChevronRight className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 7 }, (_, i) => addDays(rescheduleWeek, i)).map(day => {
                    const key = toDateKey(day);
                    const isSelected = rescheduleDate === key;
                    const isToday = toDateKey(new Date()) === key;
                    const isPastDay = day < new Date(new Date().toDateString());
                    return (
                      <button key={key} onClick={() => !isPastDay && setRescheduleDate(key)} disabled={isPastDay}
                        className={`flex flex-col items-center py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${isSelected ? 'bg-orange-500 text-white' : isPastDay ? 'bg-muted/40 text-muted-foreground/60 cursor-default' : 'bg-muted text-foreground hover:bg-orange-100 dark:hover:bg-orange-950'}`}
                      >
                        <span>{day.toLocaleDateString(locale, { weekday: 'short' }).replace(/\.$/, '')}</span>
                        <span className={`text-xs font-bold ${isToday && !isSelected ? 'text-orange-500' : ''}`}>{day.getDate()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{t('ownerBookings.rescheduleModal.timeLabel')}</label>
                <div className="flex items-center gap-2">
                  <select value={(rescheduleTime || '09:00').split(':')[0]} onChange={e => setRescheduleTime(`${e.target.value}:${(rescheduleTime || '09:00').split(':')[1]}`)} className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {Array.from({ length: 18 }, (_, i) => String(i + 6).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <span className="text-muted-foreground font-bold text-lg">:</span>
                  <select value={(rescheduleTime || '09:00').split(':')[1]} onChange={e => setRescheduleTime(`${(rescheduleTime || '09:00').split(':')[0]}:${e.target.value}`)} className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={handleReschedule} disabled={rescheduleLoading || !rescheduleDate || !rescheduleTime}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
              >
                {rescheduleLoading ? '...' : t('ownerBookings.rescheduleModal.confirm')}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Cancel modal (reused) */}
        <Dialog open={cancelOpen} onOpenChange={o => { if (!o) { setCancelOpen(false); setCancelBookingId(null); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                {t('ownerBookings.cancelModal.title')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder={t('ownerBookings.cancelModal.reasonPlaceholder')}
                rows={3}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => { setCancelOpen(false); setCancelBookingId(null); }}
                  className="flex-1 border border-border rounded-xl py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
                >
                  {t('ownerBookings.cancelModal.back')}
                </button>
                <button onClick={handleCancel} disabled={!!actionLoading}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
                >
                  {actionLoading ? '...' : t('ownerBookings.cancelModal.confirm')}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'upcoming', label: t('ownerBookings.filter.upcoming') },
    { key: 'pending',  label: t('ownerBookings.filter.pending')  },
    { key: 'all',      label: t('ownerBookings.filter.all')      },
  ];

  // Generate short day names Mon–Sun from the current locale
  const DAY_NAMES = weekDays.map(d =>
    d.toLocaleDateString(locale, { weekday: 'short' }).replace(/\.$/, '')
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        <BusinessBookingNav active="bookings" />

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{t('ownerBookings.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('ownerBookings.subtitle')}</p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-3 py-2 text-sm font-semibold transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('ownerBookings.add.button')}
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 bg-muted/50 rounded-xl p-1">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => { setFilter(f.key); try { localStorage.setItem('ownerBookingsFilter', f.key); } catch {} }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                filter === f.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Location filter */}
        {locations.length > 1 && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <select value={locFilter} onChange={e => setLocFilter(e.target.value)}
              className="flex-1 border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">{t('ownerBookings.filterLoc.all')}</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}

        {/* Staff filter */}
        {staff.length > 1 && (
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)}
              className="flex-1 border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">{t('ownerBookings.filterStaff.all')}</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {/* Bookings list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-7 w-7 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl px-5 py-12 text-center">
            <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">{t('ownerBookings.empty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map(b => {
              const staffName = staff.find(s => s.id === b.staff_member_id)?.name;
              const sc = statusConfig[b.status] ?? { label: b.status, cls: 'bg-muted text-muted-foreground', icon: null };
              const isPast      = new Date(b.starts_at) < new Date();
              const isActive    = ['pending', 'confirmed'].includes(b.status);
              const isDeletable = ['completed', 'cancelled'].includes(b.status);
              const client   = clientLabel(b);
              const displaySc = (isPast && isActive)
                ? { ...sc, label: t('ownerBookings.status.pastDone'), cls: 'bg-muted text-muted-foreground' }
                : sc;
              return (
                <div key={b.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {new Date(b.starts_at).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(b.starts_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {new Date(b.ends_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${displaySc.cls}`}>
                      {displaySc.icon} {displaySc.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground truncate">{b.service_name_snapshot}</span>
                    {staffName && <span className="shrink-0">· {staffName}</span>}
                  </div>
                  {locations.length > 1 && (b.location as any)?.name && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span>{(b.location as any).name}</span>
                    </div>
                  )}
                  {client && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3 w-3 shrink-0" />
                      {b.client_id ? (
                        <button
                          onClick={() => openHistory(b.client_id!, client!)}
                          className="font-medium text-foreground hover:text-primary underline-offset-2 hover:underline transition-colors"
                        >
                          {client}
                        </button>
                      ) : (
                        <span>{client}</span>
                      )}
                      {(b.client_phone || b.guest_phone) && (
                        <span className="text-muted-foreground">· {b.client_phone || b.guest_phone}</span>
                      )}
                      {b.guest_name && <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded-full">{t('ownerBookings.guestLabel')}</span>}
                    </div>
                  )}
                  {b.notes?.trim() && <p className="text-xs text-muted-foreground/70 italic">{b.notes}</p>}
                  {isActive && (
                    <div className="flex items-center gap-2 pt-1 border-t border-border">
                      {b.status === 'pending' && (
                        <button onClick={() => handleConfirm(b.id)} disabled={!!actionLoading}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl py-2 text-xs font-semibold transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {actionLoading === b.id + '-confirm' ? '...' : t('ownerBookings.confirm')}
                        </button>
                      )}
                      <button onClick={() => openReassign(b)} disabled={!!actionLoading}
                        className="flex items-center justify-center gap-1.5 bg-muted hover:bg-muted/80 disabled:opacity-50 text-foreground rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
                      >
                        <Users className="h-3.5 w-3.5" />
                        {t('ownerBookings.reassign')}
                      </button>
                      {!isPast && (
                        <button onClick={() => openReschedule(b)} disabled={!!actionLoading}
                          className="flex items-center justify-center gap-1.5 bg-muted hover:bg-muted/80 disabled:opacity-50 text-foreground rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          {t('ownerBookings.reschedule')}
                        </button>
                      )}
                      {!isPast && (
                        <button onClick={() => openCancelModal(b.id)} disabled={!!actionLoading}
                          className="flex items-center justify-center gap-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:hover:bg-red-900 disabled:opacity-50 text-red-600 dark:text-red-400 rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {t('ownerBookings.cancel')}
                        </button>
                      )}
                    </div>
                  )}
                  {isDeletable && (
                    <div className="flex items-center gap-2 pt-1 border-t border-border">
                      <button
                        onClick={() => { setDeleteBookingId(b.id); setDeleteOpen(true); }}
                        disabled={!!actionLoading}
                        className="flex items-center justify-center gap-1.5 bg-muted hover:bg-red-100 dark:hover:bg-red-950 disabled:opacity-50 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {actionLoading === b.id + '-delete' ? '...' : t('ownerBookings.delete')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Manual booking modal ───────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={o => { if (!o) setAddOpen(false); }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-orange-500" />
              {t('ownerBookings.add.title')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">

            {/* Service */}
            <select value={addServiceId} onChange={e => { setAddServiceId(e.target.value); setAddSlotStart(''); }}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>)}
            </select>

            {/* Staff */}
            {staff.length > 1 && (
              <select value={addStaffId} onChange={e => setAddStaffId(e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}

            {/* Week navigation */}
            <div className="flex items-center justify-between">
              <button onClick={() => { setAddWeek(w => addDays(w, -7)); setAddSlotStart(''); }}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-semibold text-foreground">
                {addWeek.toLocaleDateString(locale, { day: 'numeric', month: 'long' })}
                {' – '}
                {addDays(addWeek, 6).toLocaleDateString(locale, { day: 'numeric', month: 'long' })}
              </span>
              <button onClick={() => { setAddWeek(w => addDays(w, 7)); setAddSlotStart(''); }}
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
                const isSelected = addSelectedDay === key;
                const isToday = toDateKey(new Date()) === key;
                return (
                  <button key={key}
                    onClick={() => { setAddSelectedDay(key); setAddSlotStart(''); }}
                    className={`flex flex-col items-center py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
                      isSelected
                        ? 'bg-orange-500 text-white'
                        : hasSlots
                        ? 'bg-muted text-foreground hover:bg-orange-100 dark:hover:bg-orange-950'
                        : 'bg-muted/40 text-muted-foreground cursor-default'
                    }`}
                    disabled={!hasSlots && !isSelected}
                  >
                    <span>{DAY_NAMES[i]}</span>
                    <span className={`text-xs font-bold ${isToday && !isSelected ? 'text-orange-500' : ''}`}>
                      {day.getDate()}
                    </span>
                    {hasSlots && !isSelected && (
                      <span className="w-1 h-1 rounded-full bg-orange-500 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Slot grid */}
            {addSlotsLoading ? (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
              </div>
            ) : addSelectedDay && (slotsByDay[addSelectedDay]?.length || 0) === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                {t('ownerBookings.add.noSlots')}
              </p>
            ) : addSelectedDay && slotsByDay[addSelectedDay] ? (
              <div className="grid grid-cols-4 gap-1.5">
                {slotsByDay[addSelectedDay].map(sl => {
                  const timeStr = new Date(sl.slot_start).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
                  const isChosen = addSlotStart === sl.slot_start;
                  return (
                    <button key={sl.slot_start}
                      onClick={() => setAddSlotStart(sl.slot_start)}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        isChosen
                          ? 'bg-orange-500 text-white'
                          : 'bg-muted text-foreground hover:bg-orange-100 dark:hover:bg-orange-950'
                      }`}
                    >
                      {timeStr}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* Client details — shown only after slot is chosen */}
            {addSlotStart && (
              <div className="space-y-2 border-t border-border pt-3">
                <input type="text" value={addName} onChange={e => setAddName(e.target.value)}
                  placeholder={t('ownerBookings.add.namePlaceholder')}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <input type="tel" value={addPhone} onChange={e => setAddPhone(e.target.value)}
                  placeholder={t('ownerBookings.add.phonePlaceholder')}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <textarea value={addNotes} onChange={e => setAddNotes(e.target.value)}
                  placeholder={t('ownerBookings.add.notesPlaceholder')} rows={2}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>
            )}

            <button onClick={handleAddBooking}
              disabled={addLoading || !addServiceId || !addStaffId || !addSlotStart || !addName.trim()}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
            >
              {addLoading ? '...' : t('ownerBookings.add.save')}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Cancel modal ──────────────────────────────────────────────── */}
      <Dialog open={cancelOpen} onOpenChange={o => { if (!o) { setCancelOpen(false); setCancelBookingId(null); setCancelReason(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="h-4 w-4" />
              {t('ownerBookings.cancelModal.title')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">{t('ownerBookings.cancelModal.body')}</p>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              placeholder={t('ownerBookings.cancelModal.reasonPlaceholder')} rows={3}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => { setCancelOpen(false); setCancelBookingId(null); setCancelReason(''); }}
                className="flex-1 border border-border rounded-xl py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                {t('ownerBookings.cancelModal.back')}
              </button>
              <button onClick={handleCancel} disabled={!!actionLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
              >
                {actionLoading?.endsWith('-cancel') ? '...' : t('ownerBookings.cancelModal.confirm')}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete modal ─────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={o => { if (!o) { setDeleteOpen(false); setDeleteBookingId(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="h-4 w-4" />
              {t('ownerBookings.deleteModal.title')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">{t('ownerBookings.deleteModal.body')}</p>
            <div className="flex gap-2">
              <button onClick={() => { setDeleteOpen(false); setDeleteBookingId(null); }}
                className="flex-1 border border-border rounded-xl py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                {t('ownerBookings.cancelModal.back')}
              </button>
              <button onClick={handleDelete} disabled={!!actionLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
              >
                {actionLoading?.endsWith('-delete') ? '...' : t('ownerBookings.deleteModal.confirm')}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reassign modal ────────────────────────────────────────────── */}
      <Dialog open={reassignOpen} onOpenChange={o => { if (!o) { setReassignOpen(false); setReassignBookingId(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              {t('ownerBookings.reassign')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <select value={reassignStaffId} onChange={e => setReassignStaffId(e.target.value)}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">{t('ownerBookings.reassignPlaceholder')}</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={handleReassign} disabled={!reassignStaffId || !!actionLoading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
            >
              {actionLoading?.endsWith('-reassign') ? '...' : t('ownerBookings.reassign')}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reschedule modal ──────────────────────────────────────────── */}
      <Dialog open={rescheduleOpen} onOpenChange={o => { if (!o) { setRescheduleOpen(false); setRescheduleBookingId(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              {t('ownerBookings.rescheduleModal.title')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">{t('ownerBookings.rescheduleModal.dateLabel')}</label>
              <div className="flex items-center justify-between mb-1">
                <button onClick={() => setRescheduleWeek(w => addDays(w, -7))}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-semibold text-foreground">
                  {rescheduleWeek.toLocaleDateString(locale, { day: 'numeric', month: 'long' })}
                  {' – '}
                  {addDays(rescheduleWeek, 6).toLocaleDateString(locale, { day: 'numeric', month: 'long' })}
                </span>
                <button onClick={() => setRescheduleWeek(w => addDays(w, 7))}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 7 }, (_, i) => addDays(rescheduleWeek, i)).map(day => {
                  const key = toDateKey(day);
                  const isSelected = rescheduleDate === key;
                  const isToday = toDateKey(new Date()) === key;
                  const isPast = day < new Date(new Date().toDateString());
                  return (
                    <button key={key} onClick={() => !isPast && setRescheduleDate(key)}
                      disabled={isPast}
                      className={`flex flex-col items-center py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
                        isSelected
                          ? 'bg-orange-500 text-white'
                          : isPast
                          ? 'bg-muted/40 text-muted-foreground/60 cursor-default'
                          : 'bg-muted text-foreground hover:bg-orange-100 dark:hover:bg-orange-950'
                      }`}
                    >
                      <span>{day.toLocaleDateString(locale, { weekday: 'short' }).replace(/\.$/, '')}</span>
                      <span className={`text-xs font-bold ${isToday && !isSelected ? 'text-orange-500' : ''}`}>{day.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">{t('ownerBookings.rescheduleModal.timeLabel')}</label>
              <div className="flex items-center gap-2">
                <select
                  value={(rescheduleTime || '09:00').split(':')[0]}
                  onChange={e => setRescheduleTime(`${e.target.value}:${(rescheduleTime || '09:00').split(':')[1]}`)}
                  className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {Array.from({ length: 18 }, (_, i) => String(i + 6).padStart(2, '0')).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span className="text-muted-foreground font-bold text-lg">:</span>
                <select
                  value={(rescheduleTime || '09:00').split(':')[1]}
                  onChange={e => setRescheduleTime(`${(rescheduleTime || '09:00').split(':')[0]}:${e.target.value}`)}
                  className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <button onClick={handleReschedule} disabled={rescheduleLoading || !rescheduleDate || !rescheduleTime}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
            >
              {rescheduleLoading ? '...' : t('ownerBookings.rescheduleModal.confirm')}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Client history modal ──────────────────────────────────────── */}
      <Dialog open={historyOpen} onOpenChange={o => { if (!o) setHistoryOpen(false); }}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {t('ownerBookings.clientHistory')} — {historyClientName}
            </DialogTitle>
          </DialogHeader>
          <div className="pt-2 space-y-2">
            {historyLoading ? (
              <div className="flex justify-center py-6">
                <div className="h-5 w-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
              </div>
            ) : historyBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('ownerBookings.clientHistoryEmpty')}</p>
            ) : (
              historyBookings.map(b => {
                const sc = statusConfig[b.status] ?? { label: b.status, cls: 'bg-muted text-muted-foreground', icon: null };
                return (
                  <div key={b.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{b.service_name_snapshot}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(b.starts_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${sc.cls}`}>
                      {sc.icon} {sc.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function OwnerBookingsPage() {
  return (
    <ProtectedRoute>
      <OwnerBookingsContent />
    </ProtectedRoute>
  );
}
