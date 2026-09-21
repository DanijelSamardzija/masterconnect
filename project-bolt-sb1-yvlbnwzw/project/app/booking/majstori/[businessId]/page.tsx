'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { supabase } from '@/lib/supabase/client';
import {
  Wrench, MapPin, Zap, Phone, MessageSquare, Loader2,
  ChevronLeft, ChevronRight, AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Service = {
  id: string;
  name: string;
  description: string | null;
  price_type: string | null;
  price: number | null;
  currency: string | null;
};

type Profile = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  contact_channels: Record<string, string> | null;
  emergency_enabled: boolean;
  service_area_cities: string[];
  business_subtype: string | null;
  city: string | null;
  services: Service[];
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PublicTradeProfilePage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = use(params);
  const { t } = useLanguage();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await (supabase as any).rpc('get_public_trade_profile', {
        p_business_id: businessId,
      });
      if (data?.ok) {
        setProfile(data.profile);
      } else {
        setError(data?.error ?? 'not_found');
      }
      setLoading(false);
    }
    load();
  }, [businessId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{t('trade.majstori.empty')}</p>
        <button
          onClick={() => router.push('/booking/majstori')}
          className="text-sm text-primary hover:underline"
        >
          ← {t('trade.majstori.title')}
        </button>
      </div>
    );
  }

  const cc = profile.contact_channels ?? {};

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Back */}
      <div className="border-b border-border bg-card px-4 py-3">
        <button
          onClick={() => router.push('/booking/majstori')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('trade.majstori.title')}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="py-5 flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0 overflow-hidden">
            {profile.logo_url ? (
              <img src={profile.logo_url} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <Wrench className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground">{profile.name}</h1>
            {profile.city && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />
                {profile.city}
              </p>
            )}
            {profile.emergency_enabled && (
              <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full">
                <Zap className="w-3 h-3" />
                {t('trade.majstori.emergencyAvailable')}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {profile.description && (
          <section className="mb-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {t('trade.public.description')}
            </h2>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {profile.description}
            </p>
          </section>
        )}

        {/* Service areas */}
        {profile.service_area_cities.length > 0 && (
          <section className="mb-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {t('trade.public.serviceAreas')}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {profile.service_area_cities.map((c, i) => (
                <span key={i} className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                  {c}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Services */}
        <section className="mb-5">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {t('trade.public.services')}
          </h2>
          {profile.services.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('trade.public.noServices')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {profile.services.map(svc => (
                <div key={svc.id} className="border border-border rounded-xl p-3 bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{svc.name}</p>
                    {svc.price != null && (
                      <span className="text-sm font-semibold text-primary shrink-0">
                        {svc.price_type === 'hourly'
                          ? `${svc.price} ${svc.currency ?? ''}/h`
                          : `${svc.price} ${svc.currency ?? ''}`}
                      </span>
                    )}
                  </div>
                  {svc.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{svc.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Contact */}
        {(cc.phone || cc.whatsapp || cc.viber) && (
          <section className="mb-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {t('trade.public.contact')}
            </h2>
            <div className="flex flex-col gap-2">
              {cc.phone && (
                <a href={`tel:${cc.phone}`} className="flex items-center gap-2.5 text-sm text-primary hover:underline">
                  <Phone className="w-4 h-4" />
                  {cc.phone}
                </a>
              )}
              {cc.whatsapp && (
                <a href={`https://wa.me/${cc.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2.5 text-sm text-green-600 hover:underline">
                  <MessageSquare className="w-4 h-4" />
                  WhatsApp
                </a>
              )}
              {cc.viber && (
                <a href={`viber://chat?number=${cc.viber.replace(/\D/g, '')}`}
                  className="flex items-center gap-2.5 text-sm text-purple-600 hover:underline">
                  <MessageSquare className="w-4 h-4" />
                  Viber
                </a>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          {profile.emergency_enabled && (
            <button
              onClick={() => router.push(`/booking/majstori/${businessId}/emergency`)}
              className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              {t('trade.public.emergencyBtn')}
            </button>
          )}
          <button
            onClick={() => router.push(`/booking/majstori/${businessId}/request`)}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            {t('trade.public.requestBtn')}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
