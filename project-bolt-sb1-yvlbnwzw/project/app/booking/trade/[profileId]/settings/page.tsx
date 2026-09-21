'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeDashboardLayout } from '@/components/trade/TradeDashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Settings, ChevronRight, Loader2, Globe } from 'lucide-react';

export default function TradeSettingsPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = use(params);
  const { t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const { setActiveProfileId } = useBookingProfile();

  const [currentName, setCurrentName] = useState('');
  const [description, setDescription] = useState('');
  const [serviceAreaInput, setServiceAreaInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setActiveProfileId(profileId);
    if (!user || !profileId) return;
    loadPublicInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, user]);

  async function loadPublicInfo() {
    setLoading(true);
    // Read name directly (owner RLS allows this) to satisfy upsert_trade_profile's name_required
    const [profileResp, publicResp] = await Promise.all([
      (supabase as any).from('booking_profiles').select('name').eq('id', profileId).single(),
      (supabase as any).rpc('get_public_trade_profile', { p_business_id: profileId }),
    ]);
    if (profileResp.data?.name) setCurrentName(profileResp.data.name);
    if (publicResp.data?.ok) {
      setDescription(publicResp.data.profile.description ?? '');
      setServiceAreaInput((publicResp.data.profile.service_area_cities ?? []).join(', '));
    }
    setLoading(false);
  }

  async function savePublicInfo() {
    if (!currentName) return;
    setSaving(true);
    const cities = serviceAreaInput
      .split(',')
      .map((c: string) => c.trim())
      .filter(Boolean);

    const { data } = await (supabase as any).rpc('upsert_trade_profile', {
      p_booking_profile_id:  profileId,
      p_name:                currentName,
      p_description:         description || null,
      p_service_area_cities: cities,
    });

    if (data?.ok) {
      toast.success(t('trade.settings.saved'));
    } else {
      toast.error(data?.error ?? 'error');
    }
    setSaving(false);
  }

  return (
    <TradeDashboardLayout profileId={profileId} active="settings">
      <h1 className="text-lg font-bold text-foreground mb-4">{t('trade.dashboard.settings.title')}</h1>

      <div className="flex flex-col gap-3">
        {/* General settings link */}
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-muted shrink-0 mt-0.5">
              <Settings className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground mb-1">{t('trade.dashboard.settings.title')}</p>
              <p className="text-xs text-muted-foreground mb-3">{t('trade.dashboard.settings.desc')}</p>
              <button
                onClick={() => router.push('/booking/business/setup')}
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {t('trade.dashboard.settings.goToSetup')}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Public profile info */}
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 shrink-0">
              <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{t('trade.settings.publicProfile')}</p>
              <p className="text-xs text-muted-foreground">{t('trade.settings.publicProfileDesc')}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {t('trade.settings.description')}
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={t('trade.settings.descPh')}
                  rows={4}
                  maxLength={2000}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {t('trade.settings.serviceAreas')}
                </label>
                <input
                  type="text"
                  value={serviceAreaInput}
                  onChange={e => setServiceAreaInput(e.target.value)}
                  placeholder={t('trade.settings.serviceAreasPh')}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>

              <button
                onClick={savePublicInfo}
                disabled={saving}
                className="py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('trade.staff.permissions.save')}
              </button>
            </div>
          )}
        </div>
      </div>
    </TradeDashboardLayout>
  );
}
