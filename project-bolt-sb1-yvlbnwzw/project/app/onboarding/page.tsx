'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserCircle, Wrench, ArrowRight, Loader2 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { resumeAfterAuth } from '@/lib/guest-intent';

type Step = 1 | 2;
type UserRole = 'customer' | 'professional';

export default function OnboardingPage() {
  const { user, loading, refreshProfile } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole | null>(null);
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
      if (meta?.full_name) setName(meta.full_name);
      else if (meta?.name) setName(meta.name);

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

  const handleFinish = async (selectedRole: UserRole) => {
    setSaving(true);
    setError('');
    trackEvent('onboarding_step_2_completed', { role: selectedRole });
    try {
      await supabase.auth.updateUser({ data: { full_name: name, account_type: selectedRole } });

      const signupSource = localStorage.getItem('signup_source') || 'direct';
      localStorage.removeItem('signup_source');

      let detectedCity: string | undefined;
      let detectedCountry: string | undefined;
      try {
        const geo = await fetch('https://ipapi.co/json/').then(r => r.json());
        if (geo.city) detectedCity = geo.city;
        if (geo.country_name) detectedCountry = geo.country_name;
      } catch {}

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          account_type: selectedRole,
          signup_source: signupSource,
          onboarding_completed: true,
          ...(detectedCity ? { city: detectedCity } : {}),
          ...(detectedCountry ? { country: detectedCountry } : {}),
        })
        .eq('id', user!.id);

      if (profileError) throw profileError;

      trackEvent('onboarding_complete', { role: selectedRole });
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
      <div className="flex gap-2 mb-8">
        <div className={`h-2 w-8 rounded-full transition-all ${step >= 1 ? 'bg-orange-500' : 'bg-white/10'}`} />
        <div className={`h-2 w-8 rounded-full transition-all ${step >= 2 ? 'bg-orange-500' : 'bg-white/10'}`} />
      </div>

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

        {/* ── STEP 2: Role ── */}
        {step === 2 && (
          <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-7 shadow-2xl">
            <h1 className="text-2xl font-black text-white mb-1">Šta želiš?</h1>
            <p className="text-slate-400 text-sm mb-6">Izaberi kako ćeš koristiti GigZone.</p>

            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

            <div className="space-y-3">
              <button
                onClick={() => !saving && handleFinish('customer')}
                disabled={saving}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-white/10 hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left group disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500/20 transition-colors">
                  {saving && role === 'customer' ? (
                    <Loader2 className="h-6 w-6 text-orange-400 animate-spin" />
                  ) : (
                    <UserCircle className="h-6 w-6 text-orange-400" />
                  )}
                </div>
                <div>
                  <p className="text-white font-bold text-base">Klijent</p>
                  <p className="text-slate-400 text-sm">Tražim usluge i majstore</p>
                </div>
              </button>

              <button
                onClick={() => !saving && handleFinish('professional')}
                disabled={saving}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-white/10 hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left group disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500/20 transition-colors">
                  {saving && role === 'professional' ? (
                    <Loader2 className="h-6 w-6 text-orange-400 animate-spin" />
                  ) : (
                    <Wrench className="h-6 w-6 text-orange-400" />
                  )}
                </div>
                <div>
                  <p className="text-white font-bold text-base">Profesionalac</p>
                  <p className="text-slate-400 text-sm">Nudim usluge i tražim posao</p>
                </div>
              </button>
            </div>

            <button
              onClick={() => setStep(1)}
              disabled={saving}
              className="w-full text-center text-slate-500 text-sm mt-5 hover:text-slate-300 transition-colors disabled:opacity-50"
            >
              ← Nazad
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
