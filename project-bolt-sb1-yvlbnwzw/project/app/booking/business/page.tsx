'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { supabase } from '@/lib/supabase/client';
import { isBookingBetaUser } from '@/lib/booking-whitelist';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Calendar, Clock, Copy, Users, Info, MapPin,
} from 'lucide-react';
import { BusinessBookingNav } from '@/components/booking/business-booking-nav';

type ServiceStat = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  price_type: string | null;
  upcoming_count: number;
  pending_count: number;
  total_count: number;
};

type UpcomingBooking = {
  id: string;
  starts_at: string;
  service_name_snapshot: string;
  staff_member_id: string | null;
  staff_name: string | null;
  notes: string | null;
  client_name: string | null;
  client_phone: string | null;
  guest_name: string | null;
  guest_phone: string | null;
};

function BusinessContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  const [businessServices, setBusinessServices] = useState<ServiceStat[]>([]);
  const [businessServicesLoaded, setBusinessServicesLoaded] = useState(false);
  const [businessStaff, setBusinessStaff] = useState<{ id: string; name: string }[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBooking[]>([]);
  const [reassignBookingId, setReassignBookingId] = useState<string | null>(null);
  const [reassignStaffId, setReassignStaffId] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [analyticsContext, setAnalyticsContext] = useState<{
    serviceId: string; serviceName: string; filter: 'upcoming' | 'pending' | 'total';
  } | null>(null);
  const [analyticsBookings, setAnalyticsBookings] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [isBusinessProfile, setIsBusinessProfile] = useState<boolean | null>(null);
  const [dashLocations, setDashLocations] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [selectedDashLocId, setSelectedDashLocId] = useState<string>('');

  const isPremium = (profile as any)?.is_premium === true;

  const fetchBusinessServices = useCallback(async (locId?: string) => {
    const { data, error } = await (supabase as any).rpc('get_business_service_stats_by_location', {
      p_location_id: locId || null,
    });
    if (!error && Array.isArray(data)) setBusinessServices(data);
    setBusinessServicesLoaded(true);
  }, []);

  const fetchBusinessStaff = useCallback(async () => {
    if (!profile) return;
    const { data } = await (supabase as any)
      .from('staff_members')
      .select('id, user_id, profiles!staff_members_user_id_fkey(name)')
      .eq('business_id', profile.id)
      .eq('is_active', true);
    if (data) setBusinessStaff(data.map((s: any) => ({ id: s.id, name: s.profiles?.name || '—' })));
  }, [profile]);

  const fetchUpcomingBookings = useCallback(async (locId?: string) => {
    if (!profile) return;
    let q = (supabase as any)
      .from('bookings')
      .select('id, starts_at, service_name_snapshot, staff_member_id, notes, guest_name, guest_phone, profiles!bookings_client_id_fkey(name, phone)')
      .eq('business_id', profile.id)
      .gte('starts_at', new Date().toISOString())
      .in('status', ['pending', 'confirmed'])
      .order('starts_at', { ascending: true })
      .limit(4);
    if (locId) q = q.eq('location_id', locId);
    const { data } = await q;
    if (data) setUpcomingBookings(data.map((b: any) => ({
      id: b.id,
      starts_at: b.starts_at,
      service_name_snapshot: b.service_name_snapshot,
      staff_member_id: b.staff_member_id ?? null,
      staff_name: null,
      notes: b.notes ?? null,
      client_name: b.profiles?.name ?? null,
      client_phone: b.profiles?.phone ?? null,
      guest_name: b.guest_name ?? null,
      guest_phone: b.guest_phone ?? null,
    })));
  }, [profile]);

  const fetchIsBusinessProfile = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('profiles').select('is_business').eq('id', profile.id).single();
    setIsBusinessProfile(data?.is_business ?? false);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    fetchIsBusinessProfile();
    if (isBookingBetaUser(profile.id) && isPremium) {
      fetchBusinessServices();
      fetchBusinessStaff();
      fetchUpcomingBookings();
      // Load locations for analytics filter
      supabase
        .from('business_locations')
        .select('id, name, city')
        .eq('business_id', profile.id)
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
        .then(({ data }) => { if (data) setDashLocations(data as any); });
    }
  }, [profile, isPremium, fetchIsBusinessProfile, fetchBusinessServices, fetchBusinessStaff, fetchUpcomingBookings]);

  const openAnalytics = async (serviceId: string, serviceName: string, filter: 'upcoming' | 'pending' | 'total') => {
    setAnalyticsContext({ serviceId, serviceName, filter });
    setAnalyticsBookings([]);
    setAnalyticsLoading(true);
    if (!profile) return;
    let query = (supabase as any)
      .from('bookings')
      .select('id, starts_at, ends_at, service_name_snapshot, status, staff_member_id, notes, guest_name, guest_phone, profiles!bookings_client_id_fkey(name, phone)')
      .eq('business_id', profile.id)
      .eq('service_id', serviceId);
    if (selectedDashLocId) query = query.eq('location_id', selectedDashLocId);
    if (filter === 'upcoming') {
      query = query.gte('starts_at', new Date().toISOString()).in('status', ['pending', 'confirmed']).order('starts_at', { ascending: true });
    } else if (filter === 'pending') {
      query = query.eq('status', 'pending').order('starts_at', { ascending: true });
    } else {
      query = query.in('status', ['confirmed', 'completed', 'no_show']).order('starts_at', { ascending: false });
    }
    const { data } = await query.limit(30);
    setAnalyticsBookings(data || []);
    setAnalyticsLoading(false);
  };

  const handleReassign = async () => {
    if (!reassignBookingId || !reassignStaffId) return;
    setReassignLoading(true);
    const { data, error } = await (supabase as any).rpc('owner_reassign_booking', {
      p_booking_id: reassignBookingId,
      p_staff_member_id: reassignStaffId,
    });
    setReassignLoading(false);
    if (error || data?.ok === false) { toast.error(data?.error || 'Greška'); return; }
    toast.success(t('dashboard.services.reassignSuccess'));
    setUpcomingBookings(prev =>
      prev.map(b => b.id === reassignBookingId ? { ...b, staff_member_id: reassignStaffId } : b)
    );
    setReassignBookingId(null);
  };

  if (!profile) return null;

  const canViewBusiness = isBookingBetaUser(profile.id) && isPremium && isBusinessProfile;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-3">

        <BusinessBookingNav />

        {/* Not eligible */}
        {isBusinessProfile === false && (
          <div className="bg-card border border-border rounded-xl px-5 py-8 text-center">
            <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">{t('dashboard.services.empty')}</p>
            <button
              onClick={() => router.push('/booking/business/setup?tab=services')}
              className="mt-2 text-xs font-semibold text-primary hover:text-primary/80"
            >
              {t('dashboard.services.settings')} →
            </button>
          </div>
        )}

        {/* Services */}
        {canViewBusiness && businessServicesLoaded && (
          <div className="space-y-3">
            {dashLocations.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => { setSelectedDashLocId(''); fetchBusinessServices(); fetchUpcomingBookings(); }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      !selectedDashLocId ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary'
                    }`}
                  >
                    {t('booking.allLocations')}
                  </button>
                  {dashLocations.map(loc => (
                    <button
                      key={loc.id}
                      onClick={() => { setSelectedDashLocId(loc.id); fetchBusinessServices(loc.id); fetchUpcomingBookings(loc.id); }}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        selectedDashLocId === loc.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary'
                      }`}
                    >
                      {loc.name}{loc.city ? ` · ${loc.city}` : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {businessServices.length === 0 ? (
              <div className="bg-card border border-border rounded-xl px-5 py-8 text-center">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">{t('dashboard.services.empty')}</p>
                <button
                  onClick={() => router.push('/booking/business/setup?tab=services')}
                  className="mt-2 text-xs font-semibold text-primary hover:text-primary/80"
                >
                  {t('dashboard.services.settings')} →
                </button>
              </div>
            ) : (
              businessServices.map(svc => (
                <div key={svc.id} className="bg-card border border-border rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{svc.name}</p>
                      <p className="text-[11px] text-muted-foreground">{svc.duration_minutes} {t('dashboard.services.min')}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`https://gigzone.app/booking/${profile.id}/${svc.id}`);
                        toast.success(t('dashboard.services.linkCopied'));
                      }}
                      className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      title={t('dashboard.services.copyLink')}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { key: 'upcoming', num: svc.upcoming_count, colorNum: 'text-blue-600 dark:text-blue-400', colorBg: 'bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50' },
                      { key: 'pending',  num: svc.pending_count,  colorNum: 'text-yellow-600 dark:text-yellow-400', colorBg: 'bg-yellow-50 dark:bg-yellow-950/30 hover:bg-yellow-100 dark:hover:bg-yellow-950/50' },
                      { key: 'total',    num: svc.total_count,    colorNum: 'text-foreground', colorBg: 'bg-muted/50 hover:bg-muted' },
                    ] as const).map(tile => {
                      const tooltipKey = `${svc.id}-${tile.key}`;
                      return (
                        <div key={tile.key} className="relative">
                          <button
                            onClick={() => { setActiveTooltip(null); openAnalytics(svc.id, svc.name, tile.key); }}
                            className={`w-full ${tile.colorBg} rounded-lg p-2 text-center transition-colors active:scale-95`}
                          >
                            <p className={`text-base font-bold ${tile.colorNum}`}>{tile.num}</p>
                            <p className="text-[10px] text-muted-foreground">{t(`dashboard.services.${tile.key}` as any)}</p>
                          </button>
                          <div className="absolute top-0.5 right-0.5 z-10">
                            <button
                              onClick={() => setActiveTooltip(activeTooltip === tooltipKey ? null : tooltipKey)}
                              className="p-0.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                            >
                              <Info className="h-2.5 w-2.5" />
                            </button>
                            {activeTooltip === tooltipKey && (
                              <div className="absolute bottom-full right-0 mb-1 w-40 bg-popover border border-border rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground shadow-lg z-30 text-left leading-relaxed">
                                {t(`dashboard.services.info.${tile.key}` as any)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}

            {/* Upcoming bookings */}
            {upcomingBookings.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  {t('dashboard.services.upcomingTitle')}
                </p>
                {upcomingBookings.map(b => {
                  const staffName = businessStaff.find(s => s.id === b.staff_member_id)?.name ?? b.staff_name;
                  const clientLabel = b.client_name || b.guest_name;
                  const phone = b.client_phone || b.guest_phone;
                  return (
                    <div key={b.id} className="bg-card border border-border rounded-xl px-3 py-2.5 flex items-center gap-2.5">
                      <div className="p-1.5 bg-blue-100 dark:bg-blue-950 rounded-lg shrink-0">
                        <Calendar className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{b.service_name_snapshot}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {new Date(b.starts_at).toLocaleDateString('sr-RS', { day: 'numeric', month: 'short' })}
                          {' · '}
                          {new Date(b.starts_at).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })}
                          {staffName ? ` · ${staffName}` : ''}
                          {clientLabel ? ` · ${clientLabel}` : ''}
                          {phone ? ` · ${phone}` : ''}
                        </p>
                        {b.notes?.trim() && (
                          <p className="text-[11px] text-muted-foreground/80 italic truncate">{b.notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => { setReassignBookingId(b.id); setReassignStaffId(b.staff_member_id || ''); }}
                        className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        title={t('dashboard.services.reassign')}
                      >
                        <Users className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Loading state */}
        {canViewBusiness === null || (isBookingBetaUser(profile.id) && isPremium && isBusinessProfile && !businessServicesLoaded) ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          </div>
        ) : null}

      </div>

      {/* Analytics dialog */}
      <Dialog open={!!analyticsContext} onOpenChange={(o) => { if (!o) { setAnalyticsContext(null); setAnalyticsBookings([]); } }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-orange-500 shrink-0" />
              <span className="truncate">{analyticsContext?.serviceName}</span>
              <span className="text-muted-foreground font-normal shrink-0">
                — {analyticsContext && t(`dashboard.services.${analyticsContext.filter}` as any)}
              </span>
            </DialogTitle>
          </DialogHeader>
          {analyticsContext && (
            <div className="mt-1 mb-1 text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 leading-relaxed">
              {t(`dashboard.services.info.${analyticsContext.filter}` as any)}
            </div>
          )}
          <div className="space-y-2 pt-1">
            {analyticsLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
              </div>
            ) : analyticsBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('dashboard.services.analytics.empty')}</p>
            ) : analyticsContext?.filter === 'total' ? (
              (() => {
                const served   = analyticsBookings.filter((b: any) => b.status !== 'no_show');
                const no_shows = analyticsBookings.filter((b: any) => b.status === 'no_show');
                const renderRow = (b: any) => {
                  const staffName = businessStaff.find(s => s.id === b.staff_member_id)?.name;
                  return (
                    <div key={b.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-muted/40">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-sm font-semibold text-foreground">
                            {new Date(b.starts_at).toLocaleDateString('sr-RS', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(b.starts_at).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {staffName && <p className="text-xs text-muted-foreground">{staffName}</p>}
                        {(b.profiles?.name || b.guest_name) && (
                          <p className="text-xs text-muted-foreground truncate">
                            {b.profiles?.name || b.guest_name}
                            {(b.profiles?.phone || b.guest_phone) && ` · ${b.profiles?.phone || b.guest_phone}`}
                          </p>
                        )}
                        {b.notes?.trim() && <p className="text-xs text-muted-foreground/70 italic truncate">{b.notes}</p>}
                      </div>
                    </div>
                  );
                };
                return (
                  <div className="space-y-4">
                    {served.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">
                            {t('dashboard.services.analytics.group.served')} ({served.length})
                          </span>
                          <div className="flex-1 h-px bg-green-200 dark:bg-green-900" />
                        </div>
                        {served.map(renderRow)}
                      </div>
                    )}
                    {no_shows.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 dark:text-red-400">
                            {t('dashboard.services.analytics.group.no_show')} ({no_shows.length})
                          </span>
                          <div className="flex-1 h-px bg-red-200 dark:bg-red-900" />
                        </div>
                        {no_shows.map(renderRow)}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              analyticsBookings.map((b: any) => {
                const staffName = businessStaff.find(s => s.id === b.staff_member_id)?.name;
                const statusCls = b.status === 'pending'
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400';
                const statusLabel = b.status === 'pending'
                  ? t('dashboard.services.analytics.status.pending')
                  : t('dashboard.services.analytics.status.confirmed');
                return (
                  <div key={b.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-muted/40">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold text-foreground">
                          {new Date(b.starts_at).toLocaleDateString('sr-RS', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(b.starts_at).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusCls}`}>
                          {statusLabel}
                        </span>
                      </div>
                      {staffName && <p className="text-xs text-muted-foreground">{staffName}</p>}
                      {(b.profiles?.name || b.guest_name) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {b.profiles?.name || b.guest_name}
                          {(b.profiles?.phone || b.guest_phone) && ` · ${b.profiles?.phone || b.guest_phone}`}
                        </p>
                      )}
                      {b.notes?.trim() && <p className="text-xs text-muted-foreground/70 italic truncate">{b.notes}</p>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reassign staff modal */}
      <Dialog open={!!reassignBookingId} onOpenChange={(o) => { if (!o) setReassignBookingId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              {t('dashboard.services.reassignTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <select
              value={reassignStaffId}
              onChange={e => setReassignStaffId(e.target.value)}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">{t('dashboard.services.select')}</option>
              {businessStaff.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              onClick={handleReassign}
              disabled={!reassignStaffId || reassignLoading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
            >
              {reassignLoading ? '...' : t('dashboard.services.reassignSave')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function BookingBusinessPage() {
  return (
    <ProtectedRoute>
      <BusinessContent />
    </ProtectedRoute>
  );
}
