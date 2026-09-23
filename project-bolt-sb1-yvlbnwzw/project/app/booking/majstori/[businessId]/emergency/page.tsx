'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { supabase } from '@/lib/supabase/client';
import { ChevronLeft, Zap, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function PublicEmergencyPage() {
  const { businessId } = useParams() as { businessId: string };
  const { t } = useLanguage();
  const router = useRouter();

  const [businessName, setBusinessName] = useState('');
  const [emergencyEnabled, setEmergencyEnabled] = useState<boolean | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data } = await (supabase as any).rpc('get_public_trade_profile', {
        p_business_id: businessId,
      });
      if (data?.ok) {
        setBusinessName(data.profile.name);
        setEmergencyEnabled(data.profile.emergency_enabled);
      } else {
        setEmergencyEnabled(false);
      }
      setLoadingProfile(false);
    }
    loadProfile();
  }, [businessId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data } = await (supabase as any).rpc('create_public_emergency_request', {
      p_business_id:  businessId,
      p_contact_phone: phone,
      p_title:         title,
      p_description:   description || null,
      p_contact_name:  contactName || null,
      p_address:       address || null,
    });

    if (data?.ok) {
      setSuccess(true);
    } else {
      setError(data?.error ?? 'error');
    }
    setSubmitting(false);
  }

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground mb-1">{t('trade.public.emergency.success')}</h2>
        </div>
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
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950 flex items-center justify-center shrink-0">
            <Zap className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t('trade.public.emergency.title')}</h1>
            <p className="text-sm text-muted-foreground">{businessName}</p>
          </div>
        </div>

        {emergencyEnabled === false ? (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-muted border border-border">
            <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">{t('trade.public.emergency.notAvailable')}</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-5">{t('trade.public.emergency.subtitle')}</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Phone */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {t('trade.public.emergency.contactPhone')} *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder={t('trade.public.emergency.contactPhonePh')}
                  required
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400"
                />
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {t('trade.public.emergency.contactName')}
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder={t('trade.public.emergency.contactNamePh')}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400"
                />
              </div>

              {/* Problem */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {t('trade.public.emergency.problem')} *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={t('trade.public.emergency.problemPh')}
                  required
                  minLength={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {t('trade.public.emergency.problem')}
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 resize-none"
                />
              </div>

              {/* Address */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {t('trade.public.emergency.address')}
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder={t('trade.public.emergency.addressPh')}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400"
                />
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
                className="mt-1 py-3.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {t('trade.public.emergency.submit')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
