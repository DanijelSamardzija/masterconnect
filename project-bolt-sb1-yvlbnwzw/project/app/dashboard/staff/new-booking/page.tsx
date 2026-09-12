'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { ChevronRight, Plus } from 'lucide-react';

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  price_type: string;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeStr() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30, 0, 0);
  return d.toTimeString().slice(0, 5);
}

function toUTC(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

export default function StaffNewBookingPage() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const router = useRouter();

  const [hasPermission, setHasPermission] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState(nowTimeStr());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: sm } = await (supabase as any)
        .from('staff_members')
        .select('business_id, permissions')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .in('role', ['worker', 'manager'])
        .limit(1)
        .maybeSingle();

      if (!sm || !sm.permissions?.can_create_bookings) {
        setLoading(false);
        return;
      }

      setHasPermission(true);

      const { data: svcs } = await (supabase as any)
        .from('service_catalog')
        .select('id, name, duration_minutes, price, price_type')
        .eq('business_id', sm.business_id)
        .eq('is_active', true)
        .order('name');

      const list = (svcs as Service[]) ?? [];
      setServices(list);
      if (list.length > 0) setServiceId(list[0].id);
      setLoading(false);
    })();
  }, [profile]);

  async function handleSubmit() {
    if (!serviceId || !date || !time) return;
    const startsAt = toUTC(date, time);
    setSubmitting(true);
    const { data } = await (supabase as any).rpc('staff_create_booking', {
      p_service_id: serviceId,
      p_starts_at:  startsAt,
      p_notes:      notes.trim() || null,
    });
    setSubmitting(false);
    if (!data?.ok) {
      const errKey = data?.error === 'staff_conflict'
        ? 'staffBooking.error.conflict'
        : data?.error === 'service_not_found'
        ? 'staffBooking.error.noService'
        : 'staffBooking.error.generic';
      toast.error(t(errKey as Parameters<typeof t>[0]));
      return;
    }
    toast.success(t('staffBooking.success'));
    setNotes('');
    setDate(todayStr());
    setTime(nowTimeStr());
    router.push('/dashboard/staff/bookings');
  }

  const selectedService = services.find((s) => s.id === serviceId);

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
              <h1 className="text-xl font-semibold">{t('staffBooking.title')}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{t('staffBooking.subtitle')}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !hasPermission ? (
            <div className="text-center py-12">
              <Plus className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t('staffBooking.noPermission')}</p>
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">{t('staffBooking.noServices')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">

              {/* Service picker */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">{t('staffBooking.service')}</label>
                <div className="flex flex-col gap-2">
                  {services.map((svc) => (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => setServiceId(svc.id)}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left ${
                        serviceId === svc.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-background hover:bg-accent'
                      }`}
                    >
                      <span className="text-sm font-medium">{svc.name}</span>
                      <span className="text-xs text-muted-foreground">{svc.duration_minutes} min</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date + time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">{t('staffBooking.date')}</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">{t('staffBooking.time')}</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Duration hint */}
              {selectedService && (
                <p className="text-xs text-muted-foreground -mt-1">
                  {t('staffBooking.durationHint').replace('{d}', String(selectedService.duration_minutes))}
                </p>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">{t('staffBooking.clientNote')}</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('staffBooking.clientNotePlaceholder')}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || !serviceId || !date || !time}
                className="w-full py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 mt-1"
              >
                {submitting ? t('staffBooking.creating') : t('staffBooking.create')}
              </button>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
