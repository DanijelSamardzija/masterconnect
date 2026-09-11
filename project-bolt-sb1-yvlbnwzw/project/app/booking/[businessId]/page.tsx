'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Calendar, Clock, Users, DollarSign } from 'lucide-react';

type Business = {
  id: string;
  name: string;
  avatar_url: string | null;
  live_status: string | null;
  city: string | null;
  category: string | null;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    (async () => {
      setLoading(true);
      const [bizRes, svcRes] = await Promise.all([
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
      ]);
      setBusiness(bizRes.data ?? null);
      setServices((svcRes.data as Service[]) ?? []);
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
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('booking.discovery.title')}
        </button>

        <div className="flex items-center gap-3 mb-8">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarImage src={business.avatar_url ?? undefined} alt={business.name} />
            <AvatarFallback className="text-base font-semibold">
              {business.name[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold">{business.name}</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {business.city && (
                <span className="text-sm text-muted-foreground">{business.city}</span>
              )}
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

        {services.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">{t('booking.noServices')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {services.map((svc) => {
              const typeKey = BOOKING_TYPE_LABELS[svc.booking_type];
              return (
                <Link
                  key={svc.id}
                  href={`/booking/${businessId}/${svc.id}`}
                  className="block border border-border rounded-xl p-5 hover:border-primary hover:bg-accent/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="font-medium text-base truncate">{svc.name}</h2>
                        {typeKey && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                            {t(typeKey as Parameters<typeof t>[0])}
                          </span>
                        )}
                      </div>
                      {svc.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {svc.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {t('booking.duration').replace('{min}', String(svc.duration_minutes))}
                        </span>
                        {svc.capacity > 1 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {t('booking.guests')}: {svc.capacity}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-medium shrink-0 text-foreground">
                      {formatPrice(svc)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
