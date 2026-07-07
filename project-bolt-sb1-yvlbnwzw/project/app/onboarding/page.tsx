'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, Loader2, MapPin } from 'lucide-react';
import { CityAutocomplete } from '@/components/city-autocomplete';
import { trackEvent } from '@/lib/analytics';
import { useLanguage } from '@/lib/contexts/language-context';
import { resumeAfterAuth } from '@/lib/guest-intent';

type Step = 1 | 2;

export default function OnboardingPage() {
  const { user, loading, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [hasGoogleName, setHasGoogleName] = useState(false);
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
      return;
    }
    if (user) {
      trackEvent('view_onboarding');
      const meta = user.user_metadata;
      const googleName = meta?.full_name || meta?.name;
      if (googleName) {
        setName(googleName);
        setHasGoogleName(true);
        trackEvent('onboarding_step_1_completed', { name_length: googleName.trim().length, auto: true });
        setStep(2);
      }

      supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.onboarding_completed) router.replace('/feed');
        });
    }
  }, [user, loading]);

  const handleStep1 = () => {
    if (!name.trim()) { setError('Unesite vaše ime'); return; }
    setError('');
    trackEvent('onboarding_step_1_completed', { name_length: name.trim().length });
    setStep(2);
  };

  const handleFinish = async () => {
    setSaving(true);
    setError('');
    trackEvent('onboarding_step_2_completed', { role: 'customer' });
    try {
      await supabase.auth.updateUser({ data: { full_name: name, account_type: 'customer' } });

      const signupSource = localStorage.getItem('signup_source') || 'direct';
      localStorage.removeItem('signup_source');

      let detectedCountry: string | undefined;
      try {
        const geo = await fetch('https://ipapi.co/json/').then(r => r.json());
        if (geo.country_name) detectedCountry = geo.country_name;
      } catch {}

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user!.id,
          email: user!.email ?? '',
          name: name.trim(),
          account_type: 'customer',
          role: 'customer',
          signup_source: signupSource,
          onboarding_completed: true,
          city: city.trim(),
          ...(detectedCountry ? { country: detectedCountry } : {}),
        }, { onConflict: 'id' });

      if (profileError) throw profileError;

      trackEvent('onboarding_complete', { role: 'customer' });
      trackEvent('register_success', { source: 'google' });
      fetch('/api/email/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user!.id }),
      }).catch(() => {});
      await refreshProfile();
      resumeAfterAuth(router);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0f0f0f] flex flex-col items-center justify-center px-4 py-10">

      {/* Logo */}
      <div className="mb-8 text-center">
        <span className="text-2xl font-black text-white tracking-tight">
          Gig<span className="text-orange-500">Zone</span>
        </span>
      </div>

      {/* Progress dots */}
      {!hasGoogleName && (
        <div className="flex gap-2 mb-8">
          <div className={`h-2 w-8 rounded-full transition-all ${step >= 1 ? 'bg-orange-500' : 'bg-white/10'}`} />
          <div className={`h-2 w-8 rounded-full transition-all ${step >= 2 ? 'bg-orange-500' : 'bg-white/10'}`} />
        </div>
      )}
      {hasGoogleName && <div className="mb-8" />}

      <div className="w-full max-w-sm">

        {/* ── STEP 1: Name ── */}
        {step === 1 && (
          <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-7 shadow-2xl">
            <h1 className="text-2xl font-black text-white mb-1">Kako se zoveš?</h1>
            <p className="text-slate-400 text-sm mb-6">Ovo će biti tvoje ime na GigZone-u.</p>

            <Input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleStep1()}
              placeholder="Ime i prezime"
              className="h-14 text-base bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-xl mb-3 focus-visible:ring-orange-500"
              autoFocus
            />

            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

            <Button
              onClick={handleStep1}
              className="w-full h-14 text-base font-bold bg-orange-600 hover:bg-orange-500 rounded-2xl shadow-lg shadow-orange-600/30"
            >
              Nastavi
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}

        {/* ── STEP 2: City + Role ── */}
        {step === 2 && (
          <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-7 shadow-2xl">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-5 w-5 text-orange-400 flex-shrink-0" />
              <h1 className="text-2xl font-black text-white">{t('onboarding.cityTitle')}</h1>
            </div>
            <p className="text-slate-400 text-sm mb-5">
              {t('onboarding.citySubtitle')}
            </p>

            <CityAutocomplete
              value={city}
              onChange={(val) => { setCity(val); setError(''); }}
              placeholder={t('onboarding.cityPlaceholder')}
              className="mb-1 [&_input]:h-14 [&_input]:text-base [&_input]:bg-white/5 [&_input]:border-white/10 [&_input]:text-white [&_input]:placeholder:text-slate-500 [&_input]:rounded-xl [&_input]:focus-visible:ring-orange-500"
            />
            <p className="text-slate-500 text-xs mb-5">Opciono — možeš dodati kasnije iz profila</p>

            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

            <Button
              onClick={handleFinish}
              disabled={saving}
              className="w-full h-14 text-base font-bold bg-orange-600 hover:bg-orange-500 rounded-2xl shadow-lg shadow-orange-600/30 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Nastavi <ArrowRight className="ml-2 h-5 w-5" /></>}
            </Button>

            {!hasGoogleName && (
              <button
                onClick={() => setStep(1)}
                disabled={saving}
                className="w-full text-center text-slate-500 text-sm mt-5 hover:text-slate-300 transition-colors disabled:opacity-50"
              >
                ← Nazad
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
