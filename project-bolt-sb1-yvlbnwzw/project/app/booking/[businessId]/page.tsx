'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, ChevronRight, Clock, Users, MapPin, Phone } from 'lucide-react';

type Business = {
  id: string;
  name: string;
  avatar_url: string | null;
  live_status: string | null;
  city: string | null;
  category: string | null;
};

type StaffMember = {
  id: string;
  name: string;
  avatar_url: string | null;
  role: string;
};

type Location = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  is_primary: boolean;
};

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  capacity: number;
  price: number | null;
  price_type: string;
  currency: string | null;
  booking_type: string;
};

const BOOKING_TYPE_LABELS: Record<string, string> = {
  appointment_service: 'booking.activate.typeAppointment',
  tradespeople: 'booking.activate.typeTradespeople',
};

export default function BusinessBookingProfilePage() {
  const { businessId } = useParams<{ businessId: string }>();
  const router = useRouter();
  const { t } = useLanguage();

  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [primaryLocation, setPrimaryLocation] = useState<Location | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    (async () => {
      setLoading(true);
      const [bizRes, svcRes, locRes, smRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, avatar_url, live_status, city, category')
          .eq('id', businessId)
          .eq('is_business', true)
          .maybeSingle(),
        (supabase as any)
          .from('service_catalog')
          .select('id, name, description, duration_minutes, capacity, price, price_type, currency, booking_type')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('business_locations')
          .select('id, name, address, city, country, phone, is_primary')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .order('is_primary', { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Staff members visible to clients
        supabase
          .from('staff_members')
          .select('id, role, user_id')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .in('role', ['owner', 'worker', 'manager']),
      ]);
      setBusiness(bizRes.data ?? null);
      setServices((svcRes.data as Service[]) ?? []);
      setPrimaryLocation((locRes.data as Location) ?? null);
      // Fetch staff profiles
      const smRows = smRes.data ?? [];
      if (smRows.length > 0) {
        const userIds = smRows.map((s: { user_id: string }) => s.user_id);
        const { data: profData } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', userIds);
        const profMap: Record<string, { name: string; avatar_url: string | null }> = {};
        for (const p of profData ?? []) profMap[p.id] = p;
        setStaffMembers(
          smRows.map((s: { id: string; role: string; user_id: string }) => ({
            id: s.id,
            role: s.role,
            name: profMap[s.user_id]?.name ?? '',
            avatar_url: profMap[s.user_id]?.avatar_url ?? null,
          }))
        );
      }
      setLoading(false);
    })();
  }, [businessId]);

  function formatPrice(svc: Service): string {
    if (svc.price_type === 'negotiable') return t('booking.priceNegotiable');
    if (!svc.price || svc.price === 0) return t('booking.priceFree');
    return `${svc.price.toLocaleString()} ${svc.currency ?? ''}`.trim();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">{t('booking.notFound')}</p>
        <button onClick={() => router.back()} className="text-primary underline text-sm">
          {t('booking.backToServices')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button
          onClick={() => router.push('/booking')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors py-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('booking.discovery.title')}
        </button>

        <div className="border border-border rounded-xl overflow-hidden">
          {/* Avatar + name */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={business.avatar_url ?? undefined} alt={business.name} />
              <AvatarFallback className="text-base font-semibold">
                {business.name[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-semibold">{business.name}</h1>
                {business.live_status && business.live_status !== 'unavailable' && business.live_status !== 'by_schedule' && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    business.live_status === 'available_now'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {t(`live.status.${business.live_status}` as Parameters<typeof t>[0])}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Services list */}
          {services.length === 0 ? (
            <div className="border-t border-border px-4 py-6 text-center">
              <p className="text-muted-foreground text-sm">{t('booking.noServices')}</p>
            </div>
          ) : (
            <div className="border-t border-border divide-y divide-border">
              {services.map((svc) => {
                const typeKey = BOOKING_TYPE_LABELS[svc.booking_type];
                return (
                  <Link
                    key={svc.id}
                    href={`/booking/${businessId}/${svc.id}`}
                    className="flex items-start justify-between gap-3 px-4 py-4 hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="font-medium text-sm truncate">{svc.name}</h2>
                        {typeKey && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                            {t(typeKey as Parameters<typeof t>[0])}
                          </span>
                        )}
                      </div>
                      {svc.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {svc.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {t('booking.duration').replace('{min}', String(svc.duration_minutes))}
                        </span>
                        {svc.capacity > 1 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {t('booking.guests')}: {svc.capacity}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-medium shrink-0 text-foreground">
                      {formatPrice(svc)}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Location + phone */}
          {((primaryLocation && (primaryLocation.address || primaryLocation.city || primaryLocation.phone)) || (!primaryLocation && business.city)) && (
            <div className="border-t border-border px-4 py-2.5 flex flex-col gap-1.5">
              {primaryLocation && (primaryLocation.address || primaryLocation.city) && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3 shrink-0" />
                  {[primaryLocation.address, primaryLocation.city, primaryLocation.country].filter(Boolean).join(', ')}
                </span>
              )}
              {primaryLocation?.phone && (
                <a href={`tel:${primaryLocation.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                  <Phone className="w-3 h-3 shrink-0" />
                  {primaryLocation.phone}
                </a>
              )}
              {!primaryLocation && business.city && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3 shrink-0" />
                  {business.city}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Staff section */}
        {staffMembers.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden mt-4">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <span className="text-sm font-medium">{t('staffProfile.staff')}</span>
            </div>
            <div className="divide-y divide-border">
              {staffMembers.map((sm) => (
                <Link
                  key={sm.id}
                  href={`/booking/${businessId}/staff/${sm.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={sm.avatar_url ?? undefined} alt={sm.name} />
                    <AvatarFallback className="text-xs font-semibold">
                      {sm.name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{sm.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {sm.role === 'owner' ? t('setup.staff.owner') : t('setup.staff.worker')}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
