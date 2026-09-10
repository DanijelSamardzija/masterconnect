'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { ArrowLeft, Clock, Users, DollarSign, Calendar } from 'lucide-react';

type Business = {
  id: string;
  name: string;
  avatar_url: string | null;
};

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  capacity: number;
  price: number | null;
  price_type: string;
  booking_type: string;
};

export default function BusinessBookingPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const router = useRouter();
  const { t } = useLanguage();

  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    async function load() {
      setLoading(true);
      const [bizRes, svcRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .eq('id', businessId)
          .eq('is_business', true)
          .maybeSingle(),
        supabase
          .from('service_catalog')
          .select('id, name, description, duration_minutes, capacity, price, price_type, booking_type')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .order('name'),
      ]);
      setBusiness(bizRes.data ?? null);
      setServices(svcRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [businessId]);

  function formatPrice(svc: Service): string {
    if (svc.price_type === 'negotiable') return t('booking.priceNegotiable');
    if (!svc.price || svc.price === 0) return t('booking.priceFree');
    return `${svc.price.toLocaleString()} €`;
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
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('booking.backToServices')}
        </button>

        <div className="flex items-center gap-3 mb-8">
          {business.avatar_url ? (
            <img
              src={business.avatar_url}
              alt={business.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Calendar className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold">{business.name}</h1>
            <p className="text-sm text-muted-foreground">{t('booking.selectServiceDesc')}</p>
          </div>
        </div>

        {services.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">{t('booking.noServices')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {services.map((svc) => (
              <Link
                key={svc.id}
                href={`/book/${businessId}/${svc.id}`}
                className="block border border-border rounded-xl p-5 hover:border-primary hover:bg-accent/30 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-medium text-base mb-1 truncate">{svc.name}</h2>
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
                  <div className="flex items-center gap-1 text-sm font-medium shrink-0">
                    <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                    {formatPrice(svc)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
