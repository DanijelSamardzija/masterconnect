'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserCircle, Wrench, AlertCircle } from 'lucide-react';
import { CityAutocomplete } from '@/components/city-autocomplete';
import { CategoryCombobox } from '@/components/category-combobox';
import { countries } from '@/lib/countries';
import { trackEvent } from '@/lib/analytics';
import { resumeAfterAuth } from '@/lib/guest-intent';

type UserRole = 'customer' | 'professional';

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { t, language } = useLanguage();

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [customCountry, setCustomCountry] = useState('');
  const [category, setCategory] = useState('');
  const [role, setRole] = useState<UserRole>('customer');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
      return;
    }

    if (user) {
      // Pre-fill name from OAuth metadata if available
      const meta = user.user_metadata;
      if (meta?.full_name) setName(meta.full_name);
      else if (meta?.name) setName(meta.name);

      // Check if profile is already complete — skip onboarding
      supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.name) router.replace('/feed');
        });
    }
  }, [user, loading]);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => { if (d.categories) setCategories(d.categories); });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    trackEvent('submit_onboarding');

    try {
      if (!name.trim()) throw new Error(language === 'de' ? 'Bitte Namen eingeben' : language === 'en' ? 'Please enter your name' : 'Unesite ime i prezime');
      if (!city.trim()) throw new Error(language === 'de' ? 'Bitte Stadt auswählen' : language === 'en' ? 'Please select a city' : 'Izaberite grad');
      if (!country.trim()) throw new Error(language === 'de' ? 'Bitte Land auswählen' : language === 'en' ? 'Please select a country' : 'Izaberite državu');
      if (!category.trim()) throw new Error(language === 'de' ? 'Bitte Kategorie auswählen' : language === 'en' ? 'Please select a category' : 'Izaberite kategoriju');

      const finalCountry = country === 'Ostalo' ? (customCountry.trim() || 'Ostalo') : country;

      // Update auth user metadata
      await supabase.auth.updateUser({
        data: { full_name: name, account_type: role, city, country: finalCountry, category },
      });

      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ name, role, city, country: finalCountry, category })
        .eq('id', user!.id);

      if (profileError) throw profileError;

      trackEvent('onboarding_complete', { role });
      resumeAfterAuth(router);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">

      <div className="w-full max-w-md">

        {/* Logo + progress */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-black text-white" style={{ fontFamily: 'Georgia, serif' }}>G</span>
            </div>
          </div>
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-1">
            {t('onboarding.step')}
          </p>
          <h1 className="text-2xl font-bold text-white">{t('onboarding.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{t('onboarding.subtitle')}</p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-6">
          <div className="flex-1 h-1.5 rounded-full bg-orange-500" />
          <div className="flex-1 h-1.5 rounded-full bg-orange-500" />
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">

          {error && (
            <Alert variant="destructive" className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-medium">{t('login.fullNameLabel')}</Label>
            <Input
              id="name"
              type="text"
              placeholder={t('login.fullNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11"
              required
            />
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t('login.cityLabel')}</Label>
            <CityAutocomplete
              value={city}
              onChange={setCity}
              placeholder={t('login.cityPlaceholder')}
            />
          </div>

          {/* Country */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t('login.countryLabel')}</Label>
            <select
              value={country}
              onChange={(e) => { setCountry(e.target.value); setCustomCountry(''); }}
              className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            >
              <option value="">{t('login.countryPlaceholder')}</option>
              {countries.map((c) => (
                <option key={c.value} value={c.value}>
                  {language === 'en' ? c.en : c.sr}
                </option>
              ))}
            </select>
            {country === 'Ostalo' && (
              <Input
                placeholder={t('login.enterCountry')}
                value={customCountry}
                onChange={(e) => setCustomCountry(e.target.value)}
                className="h-11"
                required
              />
            )}
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t('login.categoryLabel')}</Label>
            <CategoryCombobox
              value={category}
              onChange={setCategory}
              suggestions={categories}
              placeholder={t('login.categoryPlaceholder')}
            />
          </div>

          {/* Account type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('login.accountTypeLabel')}</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('customer')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  role === 'customer'
                    ? 'border-orange-500 bg-orange-50 shadow-sm'
                    : 'border-slate-200 hover:border-orange-300'
                }`}
              >
                <UserCircle className={`h-6 w-6 ${role === 'customer' ? 'text-orange-600' : 'text-slate-500'}`} />
                <div className="text-center">
                  <span className="font-semibold text-sm block">{t('login.customerLabel')}</span>
                  <span className="text-xs text-slate-500">{t('login.customerDesc')}</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole('professional')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  role === 'professional'
                    ? 'border-orange-500 bg-orange-50 shadow-sm'
                    : 'border-slate-200 hover:border-orange-300'
                }`}
              >
                <Wrench className={`h-6 w-6 ${role === 'professional' ? 'text-orange-600' : 'text-slate-500'}`} />
                <div className="text-center">
                  <span className="font-semibold text-sm block">{t('login.professionalLabel')}</span>
                  <span className="text-xs text-slate-500">{t('login.professionalDesc')}</span>
                </div>
              </button>
            </div>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            className="w-full h-12 text-base font-bold bg-orange-600 hover:bg-orange-700 shadow-md rounded-xl mt-2"
            disabled={saving}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('onboarding.completing')}
              </span>
            ) : (
              t('onboarding.completeButton')
            )}
          </Button>
        </div>

        {/* Skip — dostupno samo ako je ime uneseno */}
        {name.trim() && (
          <button
            onClick={() => resumeAfterAuth(router)}
            className="w-full text-center text-slate-400 text-sm mt-4 hover:text-slate-300 transition-colors"
          >
            {t('onboarding.skipButton')}
          </button>
        )}

      </div>
    </div>
  );
}
