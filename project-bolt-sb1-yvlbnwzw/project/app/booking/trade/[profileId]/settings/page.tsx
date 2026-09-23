'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeDashboardLayout } from '@/components/trade/TradeDashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Settings, ChevronRight, Loader2, Globe, Store, Camera, Wrench } from 'lucide-react';
import { compressImage } from '@/lib/utils/compress-image';

export default function TradeSettingsPage() {
  const { profileId } = useParams() as { profileId: string };
  const { t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const { setActiveProfileId } = useBookingProfile();

  const [currentName, setCurrentName] = useState('');
  const [description, setDescription] = useState('');
  const [serviceAreaInput, setServiceAreaInput] = useState('');
  const [isMarketplaceListed, setIsMarketplaceListed] = useState(true);
  const [togglingMarketplace, setTogglingMarketplace] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

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
      (supabase as any).from('booking_profiles').select('name, is_marketplace_listed, logo_url').eq('id', profileId).single(),
      (supabase as any).rpc('get_public_trade_profile', { p_business_id: profileId }),
    ]);
    if (profileResp.data?.name) setCurrentName(profileResp.data.name);
    if (typeof profileResp.data?.is_marketplace_listed === 'boolean') {
      setIsMarketplaceListed(profileResp.data.is_marketplace_listed);
    }
    if (profileResp.data?.logo_url) setLogoUrl(profileResp.data.logo_url);
    if (publicResp.data?.ok) {
      setDescription(publicResp.data.profile.description ?? '');
      setServiceAreaInput((publicResp.data.profile.service_area_cities ?? []).join(', '));
    }
    setLoading(false);
  }

  async function toggleMarketplace(val: boolean) {
    setTogglingMarketplace(true);
    const { data } = await (supabase as any).rpc('set_marketplace_listed', {
      p_business_id: profileId,
      p_listed:      val,
    });
    if (data?.ok) {
      setIsMarketplaceListed(val);
      toast.success(t('trade.settings.saved'));
    } else {
      toast.error(data?.error ?? 'error');
    }
    setTogglingMarketplace(false);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(t('bookingSetup.profile.logoMax')); return; }
    setUploadingLogo(true);
    try {
      const compressed = await compressImage(file, 400);
      const fileName = `${user.id}/booking-profiles/${profileId}/${Date.now()}.jpg`;
      if (logoUrl) {
        const oldPath = logoUrl.split('/avatars/')[1];
        if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
      }
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressed, { upsert: true, contentType: 'image/jpeg' });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await (supabase as any)
        .from('booking_profiles')
        .update({ logo_url: publicUrl })
        .eq('id', profileId);
      setLogoUrl(publicUrl);
      toast.success(t('trade.settings.saved'));
    } catch {
      toast.error(t('setup.error.saveFailed'));
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
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

        {/* Marketplace visibility toggle */}
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-green-100 dark:bg-green-950 shrink-0 mt-0.5">
                <Store className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t('trade.settings.marketplace.listed')}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('trade.settings.marketplace.listedDesc')}
                </p>
              </div>
            </div>
            <button
              onClick={() => toggleMarketplace(!isMarketplaceListed)}
              disabled={togglingMarketplace || loading}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-0.5 ${
                isMarketplaceListed ? 'bg-primary' : 'bg-muted'
              } disabled:opacity-50`}
              aria-label={t('trade.settings.marketplace.listed')}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                isMarketplaceListed ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
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
              {/* Logo */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {t('bookingSetup.profile.logo')}
                </label>
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-xl border-2 border-dashed border-border bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
                    ) : (
                      <Wrench className="w-6 h-6 text-muted-foreground/50" />
                    )}
                    {uploadingLogo && (
                      <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="text-sm font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50 text-left"
                    >
                      {uploadingLogo
                        ? t('bookingSetup.profile.logoUploading')
                        : logoUrl
                          ? t('bookingSetup.profile.logoChange')
                          : t('bookingSetup.profile.logoUpload')}
                    </button>
                    <p className="text-xs text-muted-foreground">{t('bookingSetup.profile.logoMax')}</p>
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </div>
              </div>

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
