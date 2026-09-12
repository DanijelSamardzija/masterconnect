'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/contexts/language-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ChevronLeft, Calendar, Users, CheckCircle2, XCircle,
  Clock, AlertCircle
} from 'lucide-react';

type Booking = {
  id: string;
  starts_at: string;
  ends_at: string;
  service_name_snapshot: string;
  status: string;
  staff_member_id: string | null;
  notes: string | null;
  client_name: string | null;
};

type StaffMember = { id: string; name: string };

type Filter = 'upcoming' | 'pending' | 'all';

function OwnerBookingsContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staff, setStaff]       = useState<StaffMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<Filter>('upcoming');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [isOwner, setIsOwner]   = useState<boolean | null>(null);

  const [reassignOpen, setReassignOpen]     = useState(false);
  const [reassignBookingId, setReassignBookingId] = useState<string | null>(null);
  const [reassignStaffId, setReassignStaffId]     = useState('');
  const [actionLoading, setActionLoading]   = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    checkOwnerRole();
    fetchStaff();
  }, [profile]);

  useEffect(() => {
    if (isOwner) fetchBookings();
  }, [isOwner, filter, staffFilter]);

  const checkOwnerRole = async () => {
    if (!profile) return;
    const { data } = await (supabase as any)
      .from('staff_members')
      .select('role')
      .eq('business_id', profile.id)
      .eq('user_id', profile.id)
      .eq('is_active', true)
      .in('role', ['owner', 'manager'])
      .limit(1)
      .maybeSingle();
    setIsOwner(!!data);
  };

  const fetchStaff = async () => {
    if (!profile) return;
    const { data } = await (supabase as any)
      .from('staff_members')
      .select('id, profiles!staff_members_user_id_fkey(name)')
      .eq('business_id', profile.id)
      .eq('is_active', true);
    if (data) setStaff(data.map((s: any) => ({ id: s.id, name: s.profiles?.name || '—' })));
  };

  const fetchBookings = async () => {
    if (!profile) return;
    setLoading(true);
    let query = (supabase as any)
      .from('bookings')
      .select('id, starts_at, ends_at, service_name_snapshot, status, staff_member_id, notes, profiles!bookings_client_id_fkey(name)')
      .eq('business_id', profile.id);

    if (filter === 'upcoming') {
      query = query.gte('starts_at', new Date().toISOString()).in('status', ['pending', 'confirmed']);
    } else if (filter === 'pending') {
      query = query.eq('status', 'pending');
    }

    if (staffFilter !== 'all') {
      query = query.eq('staff_member_id', staffFilter);
    }

    const { data } = await query.order('starts_at', { ascending: filter !== 'all' }).limit(50);
    setBookings((data || []).map((b: any) => ({ ...b, client_name: b.profiles?.name ?? null })));
    setLoading(false);
  };

  const handleConfirm = async (bookingId: string) => {
    setActionLoading(bookingId + '-confirm');
    const { data, error } = await (supabase as any).rpc('owner_confirm_booking', { p_booking_id: bookingId });
    setActionLoading(null);
    if (error || data?.ok === false) { toast.error(data?.error || 'Greška'); return; }
    toast.success(t('ownerBookings.confirmed'));
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'confirmed' } : b));
  };

  const handleCancel = async (bookingId: string) => {
    setActionLoading(bookingId + '-cancel');
    const { data, error } = await (supabase as any).rpc('owner_cancel_booking', { p_booking_id: bookingId });
    setActionLoading(null);
    if (error || data?.ok === false) { toast.error(data?.error || 'Greška'); return; }
    toast.success(t('ownerBookings.cancelled'));
    setBookings(prev => prev.filter(b => b.id !== bookingId));
  };

  const handleReassign = async () => {
    if (!reassignBookingId || !reassignStaffId) return;
    setActionLoading(reassignBookingId + '-reassign');
    const { data, error } = await (supabase as any).rpc('owner_reassign_booking', {
      p_booking_id: reassignBookingId,
      p_staff_member_id: reassignStaffId,
    });
    setActionLoading(null);
    if (error || data?.ok === false) { toast.error(data?.error || 'Greška'); return; }
    toast.success(t('ownerBookings.reassigned'));
    setBookings(prev => prev.map(b => b.id === reassignBookingId ? { ...b, staff_member_id: reassignStaffId } : b));
    setReassignOpen(false);
    setReassignBookingId(null);
  };

  const openReassign = (b: Booking) => {
    setReassignBookingId(b.id);
    setReassignStaffId(b.staff_member_id || '');
    setReassignOpen(true);
  };

  const statusConfig: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    pending:   { label: t('ownerBookings.status.pending'),   cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400', icon: <Clock className="h-3 w-3" /> },
    confirmed: { label: t('ownerBookings.status.confirmed'), cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',   icon: <CheckCircle2 className="h-3 w-3" /> },
    completed: { label: t('ownerBookings.status.completed'), cls: 'bg-muted text-muted-foreground', icon: <CheckCircle2 className="h-3 w-3" /> },
    no_show:   { label: t('ownerBookings.status.no_show'),   cls: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',           icon: <AlertCircle className="h-3 w-3" /> },
    cancelled: { label: t('ownerBookings.status.cancelled'), cls: 'bg-muted text-muted-foreground', icon: <XCircle className="h-3 w-3" /> },
  };

  if (isOwner === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('ownerBookings.noPermission')}</p>
      </div>
    );
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'upcoming', label: t('ownerBookings.filter.upcoming') },
    { key: 'pending',  label: t('ownerBookings.filter.pending')  },
    { key: 'all',      label: t('ownerBookings.filter.all')      },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t('ownerBookings.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('ownerBookings.subtitle')}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 bg-muted/50 rounded-xl p-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                filter === f.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Staff filter */}
        {staff.length > 1 && (
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <select
              value={staffFilter}
              onChange={e => setStaffFilter(e.target.value)}
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
              const isPast = new Date(b.starts_at) < new Date();
              const isActive = ['pending', 'confirmed'].includes(b.status);

              return (
                <div key={b.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  {/* Date + status row */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {new Date(b.starts_at).toLocaleDateString('sr-RS', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(b.starts_at).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {new Date(b.ends_at).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${sc.cls}`}>
                      {sc.icon} {sc.label}
                    </span>
                  </div>

                  {/* Service + staff */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground truncate">{b.service_name_snapshot}</span>
                    {staffName && <span className="shrink-0">· {staffName}</span>}
                  </div>

                  {/* Client */}
                  {b.client_name && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3 w-3 shrink-0" />
                      <span>{b.client_name}</span>
                    </div>
                  )}

                  {b.notes?.trim() && (
                    <p className="text-xs text-muted-foreground/70 italic">{b.notes}</p>
                  )}

                  {/* Action buttons — only for active non-past or pending */}
                  {isActive && (
                    <div className="flex items-center gap-2 pt-1 border-t border-border">
                      {b.status === 'pending' && (
                        <button
                          onClick={() => handleConfirm(b.id)}
                          disabled={!!actionLoading}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl py-2 text-xs font-semibold transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {actionLoading === b.id + '-confirm' ? '...' : t('ownerBookings.confirm')}
                        </button>
                      )}
                      <button
                        onClick={() => openReassign(b)}
                        disabled={!!actionLoading}
                        className="flex items-center justify-center gap-1.5 bg-muted hover:bg-muted/80 disabled:opacity-50 text-foreground rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
                      >
                        <Users className="h-3.5 w-3.5" />
                        {t('ownerBookings.reassign')}
                      </button>
                      {!isPast && (
                        <button
                          onClick={() => handleCancel(b.id)}
                          disabled={!!actionLoading}
                          className="flex items-center justify-center gap-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:hover:bg-red-900 disabled:opacity-50 text-red-600 dark:text-red-400 rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {actionLoading === b.id + '-cancel' ? '...' : t('ownerBookings.cancel')}
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

      {/* Reassign modal */}
      <Dialog open={reassignOpen} onOpenChange={(o) => { if (!o) { setReassignOpen(false); setReassignBookingId(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              {t('ownerBookings.reassign')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <select
              value={reassignStaffId}
              onChange={e => setReassignStaffId(e.target.value)}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">{t('ownerBookings.filterStaff.all')}</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button
              onClick={handleReassign}
              disabled={!reassignStaffId || !!actionLoading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
            >
              {actionLoading?.endsWith('-reassign') ? '...' : t('ownerBookings.confirmed')}
            </button>
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
