'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { ArrowLeft, Check, MapPin, Clock, Wrench } from 'lucide-react';

type Business = { id: string; name: string; avatar_url: string | null; city: string | null };
type TradeService = { id: string; name: string; price_type: string; price_from: number | null; price_currency: string };

const TIME_OPTIONS = ['morning', 'afternoon', 'evening', 'flexible'] as const;

export default function HireTradespersonPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [business, setBusiness] = useState<Business | null>(null);
  const [tradeServices, setTradeServices] = useState<TradeService[]>([]);
  const [loading, setLoading] = useState(true);

  const [serviceId, setServiceId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState<string>('flexible');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [bizRes, svcRes] = await Promise.all([
        supabase.from('profiles').select('id, name, avatar_url, city').eq('id', businessId).single(),
        (supabase as any).from('tradesperson_services')
          .select('id, name, price_type, price_from, price_currency')
          .eq('business_id', businessId).eq('is_active', true).order('sort_order'),
      ]);
      setBusiness(bizRes.data);
      setTradeServices(svcRes.data ?? []);
      setLoading(false);
    })();
    if (user) {
      supabase.from('profiles').select('name').eq('id', user.id).single().then(({ data }) => {
        if (data?.name) setClientName(data.name);
      });
    }
  }, [businessId, user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !clientName.trim()) return;
    setSubmitting(true);
    const { error } = await (supabase as any).from('tradesperson_requests').insert({
      business_id: businessId,
      service_id: serviceId || null,
      client_id: user?.id ?? null,
      client_name: clientName.trim(),
      client_phone: clientPhone.trim() || null,
      title: title.trim(),
      description: description.trim(),
      address: address.trim() || null,
      city: city.trim() || null,
      preferred_date: preferredDate || null,
      preferred_time: preferredTime,
    });
    setSubmitting(false);
    if (error) { toast.error('Greška. Pokušajte ponovo.'); return; }
    setSuccess(true);
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Zanatlija nije pronađen.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-xl font-semibold text-center">{t('trade.request.success')}</h1>
        <p className="text-sm text-muted-foreground">{business.name}</p>
        <button onClick={() => router.push('/')}
          className="mt-4 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
          Nazad na početnu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{business.name}</h1>
            {business.city && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" /> {business.city}
              </div>
            )}
          </div>
        </div>

        {/* Services offered */}
        {tradeServices.length > 0 && (
          <div className="mb-5 flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Usluge</p>
            <div className="flex flex-wrap gap-2">
              {tradeServices.map((svc) => (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => setServiceId(svc.id === serviceId ? '' : svc.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    serviceId === svc.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:border-primary'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  {svc.name}
                  {svc.price_from && (
                    <span className="text-xs opacity-70">od {svc.price_from} {svc.price_currency}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
          <h2 className="text-base font-semibold">{t('trade.request.title')}</h2>

          {/* Problem title */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">{t('trade.request.titleField')}</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={t('trade.request.titlePh')} required
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">{t('trade.request.desc')}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder={t('trade.request.descPh')} required rows={4}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">{t('trade.request.address')}</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">{t('trade.request.city')}</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>

          {/* Preferred date + time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">{t('trade.request.date')}</label>
              <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> {t('trade.request.time')}
              </label>
              <select value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary">
                {TIME_OPTIONS.map((to) => (
                  <option key={to} value={to}>
                    {t(`trade.request.time.${to}` as Parameters<typeof t>[0])}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Contact */}
          <div className="border-t border-border pt-3 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">{t('trade.request.name')}</label>
              <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} required
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">{t('trade.request.phone')}</label>
              <input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>

          <button type="submit" disabled={submitting || !title.trim() || !description.trim() || !clientName.trim()}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 mt-1">
            {submitting ? '...' : t('trade.request.submit')}
          </button>
        </form>

      </div>
    </div>
  );
}
