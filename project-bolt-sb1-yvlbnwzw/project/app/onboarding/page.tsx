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
import { detectGeo } from '@/lib/geo';
import { CATEGORY_SLUGS, getCategoryLabel } from '@/lib/seo/categories';

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const { user, loading, refreshProfile } = useAuth();
  const { t, language } = useLanguage();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [hasGoogleName, setHasGoogleName] = useState(false);
  const [city, setCity] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
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
    if (!name.trim()) { setError(t('onboarding.nameRequired')); return; }
    setError('');
    trackEvent('onboarding_step_1_completed', { name_length: name.trim().length });
    setStep(2);
  };

  const handleStep2 = () => {
    trackEvent('onboarding_step_2_completed', { role: 'customer' });
    setStep(3);
  };

  const toggleInterest = (slug: string) => {
    setInterests(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  };

  const handleFinish = async (skipInterests = false) => {
    setSaving(true);
    setError('');
    try {
      await supabase.auth.updateUser({ data: { full_name: name, account_type: 'customer' } });

      const signupSource = localStorage.getItem('signup_source') || 'direct';
      localStorage.removeItem('signup_source');

      const geo = await detectGeo();

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
          feed_interests: skipInterests ? [] : interests,
          ...(city.trim() ? { city: city.trim() } : {}),
          ...(geo.country  ? { country: geo.country } : {}),
        }, { onConflict: 'id' });

      if (profileError) throw profileError;

      trackEvent('onboarding_complete', { role: 'customer', interests_count: skipInterests ? 0 : interests.length });
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
          <div className={`h-2 w-8 rounded-full transition-all ${step >= 3 ? 'bg-orange-500' : 'bg-white/10'}`} />
        </div>
      )}
      {hasGoogleName && (
        <div className="flex gap-2 mb-8">
          <div className={`h-2 w-8 rounded-full transition-all ${step >= 2 ? 'bg-orange-500' : 'bg-white/10'}`} />
          <div className={`h-2 w-8 rounded-full transition-all ${step >= 3 ? 'bg-orange-500' : 'bg-white/10'}`} />
        </div>
      )}

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
              {t('onboarding.continue')}
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
            <p className="text-slate-500 text-xs mb-5">{t('onboarding.cityOptional')}</p>

            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

            <Button
              onClick={handleStep2}
              disabled={saving}
              className="w-full h-14 text-base font-bold bg-orange-600 hover:bg-orange-500 rounded-2xl shadow-lg shadow-orange-600/30 disabled:opacity-50"
            >
              {t('onboarding.continue')} <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            {!hasGoogleName && (
              <button
                onClick={() => setStep(1)}
                disabled={saving}
                className="w-full text-center text-slate-500 text-sm mt-5 hover:text-slate-300 transition-colors disabled:opacity-50"
              >
                {t('onboarding.back')}
              </button>
            )}
          </div>
        )}

        {/* ── STEP 3: Interests ── */}
        {step === 3 && (
          <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-7 shadow-2xl">
            <h1 className="text-2xl font-black text-white mb-1">{t('interests.title')}</h1>
            <p className="text-slate-400 text-sm mb-5">{t('interests.subtitle')}</p>

            <div className="flex flex-wrap gap-2 mb-6">
              {CATEGORY_SLUGS.filter(s => s !== 'other').map((slug) => {
                const selected = interests.includes(slug);
                return (
                  <button
                    key={slug}
                    onClick={() => toggleInterest(slug)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                      selected
                        ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/30'
                    }`}
                  >
                    {getCategoryLabel(slug, language)}
                  </button>
                );
              })}
            </div>

            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

            <Button
              onClick={() => handleFinish(false)}
              disabled={saving || interests.length === 0}
              className="w-full h-14 text-base font-bold bg-orange-600 hover:bg-orange-500 rounded-2xl shadow-lg shadow-orange-600/30 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{t('onboarding.continue')} <ArrowRight className="ml-2 h-5 w-5" /></>}
            </Button>

            <button
              onClick={() => handleFinish(true)}
              disabled={saving}
              className="w-full text-center text-slate-500 text-sm mt-4 hover:text-slate-300 transition-colors disabled:opacity-50"
            >
              {t('interests.skip')} →
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
