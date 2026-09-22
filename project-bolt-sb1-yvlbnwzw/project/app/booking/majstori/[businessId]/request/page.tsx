'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { friendlyError } from '@/lib/utils/friendly-error';
import { supabase } from '@/lib/supabase/client';
import { ChevronLeft, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Service = { id: string; name: string };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PublicRequestPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = use(params);
  const { t } = useLanguage();
  const router = useRouter();

  const [services, setServices] = useState<Service[]>([]);
  const [businessName, setBusinessName] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [serviceId, setServiceId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data } = await (supabase as any).rpc('get_public_trade_profile', {
        p_business_id: businessId,
      });
      if (data?.ok) {
        setBusinessName(data.profile.name);
        setServices(data.profile.services ?? []);
      }
      setLoadingProfile(false);
    }
    loadProfile();
  }, [businessId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data } = await (supabase as any).rpc('create_tradesperson_request_public', {
      p_business_id:    businessId,
      p_title:          title,
      p_description:    desc,
      p_contact_phone:  phone,
      p_contact_name:   name || null,
      p_service_id:     serviceId || null,
      p_address:        address || null,
      p_city:           city || null,
      p_preferred_date: date || null,
      p_preferred_time: time || null,
    });

    if (data?.ok) {
      setToken(data.tracking_token);
    } else {
      setError(friendlyError(data?.error, t));
    }
    setSubmitting(false);
  }

  if (token) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground mb-1">{t('trade.request.success')}</h2>
          <p className="text-sm text-muted-foreground">{t('trade.request.tracking.desc')}</p>
        </div>
        <button
          onClick={() => router.push(`/booking/majstori/track/${token}`)}
          className="mt-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          {t('trade.request.tracking.title')} →
        </button>
        <button
          onClick={() => router.push(`/booking/majstori/${businessId}`)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {businessName}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Back */}
      <div className="border-b border-border bg-card px-4 py-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {businessName || '...'}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-foreground mb-1">{t('trade.request.title')}</h1>
        {businessName && (
          <p className="text-sm text-muted-foreground mb-5">{businessName}</p>
        )}

        {loadingProfile && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loadingProfile && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Service */}
            {services.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {t('trade.request.service')}
                </label>
                <select
                  value={serviceId}
                  onChange={e => setServiceId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="">{t('trade.request.service.any')}</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                {t('trade.request.titleField')} *
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('trade.request.titlePh')}
                required
                maxLength={200}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                {t('trade.request.desc')} *
              </label>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder={t('trade.request.descPh')}
                required
                rows={4}
                maxLength={2000}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              />
            </div>

            {/* Address + City */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {t('trade.request.address')}
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {t('trade.request.city')}
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {t('trade.request.date')}
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {t('trade.request.time')}
                </label>
                <select
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="">{t('trade.request.time.flexible')}</option>
                  <option value="morning">{t('trade.request.time.morning')}</option>
                  <option value="afternoon">{t('trade.request.time.afternoon')}</option>
                  <option value="evening">{t('trade.request.time.evening')}</option>
                </select>
              </div>
            </div>

            {/* Name + Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {t('trade.request.name')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {t('trade.request.phone')} *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t('trade.request.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
