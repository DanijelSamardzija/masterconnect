'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Lock, AlertCircle, Home, LogOut, CheckCircle } from 'lucide-react';
import { setRateLimitHit, isInRateLimitCooldown, getRemainingCooldownSeconds, clearRateLimitCooldown } from '@/lib/rate-limit-handler';
import { useLanguage } from '@/lib/contexts/language-context';
import { trackEvent } from '@/lib/analytics';

// Briše localStorage ali čuva ključeve koji ne smiju biti obrisani
function clearLocalStorageSafe() {
  const KEEP_KEYS = ['pwa_install_dismissed_v2', 'lang'];
  const saved: Record<string, string> = {};
  for (const key of KEEP_KEYS) {
    const val = localStorage.getItem(key);
    if (val !== null) saved[key] = val;
  }
  localStorage.clear();
  for (const [key, val] of Object.entries(saved)) {
    localStorage.setItem(key, val);
  }
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const redirectTo = searchParams.get('redirect') || '/feed';
  const resetSuccess = searchParams.get('reset') === 'success';
  const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'login';
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);

  useEffect(() => {
    const tab = searchParams.get('tab') === 'register' ? 'register' : 'login';
    setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) router.replace('/feed');
    });
    trackEvent('view_login_page', { tab: initialTab });
  }, []);

  // ── Login state ────────────────────────────────────────────────────────────
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showResetSuccess, setShowResetSuccess] = useState(resetSuccess);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  // ── Register state ─────────────────────────────────────────────────────────
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const remaining = getRemainingCooldownSeconds();
    if (remaining > 0) {
      setRateLimitSeconds(remaining);
      setLoginError(`Previše pokušaja. Molimo sačekajte ${remaining} sekundi.`);
    }
  }, []);

  useEffect(() => {
    if (rateLimitSeconds > 0) {
      const timer = setTimeout(() => {
        const newSeconds = rateLimitSeconds - 1;
        setRateLimitSeconds(newSeconds);
        if (newSeconds === 0) { clearRateLimitCooldown(); setLoginError(''); }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [rateLimitSeconds]);

  const handleTabChange = async (tab: string) => {
    if (tab === 'register') {
      try { clearLocalStorageSafe(); sessionStorage.clear(); } catch {}
      trackEvent('view_register_tab');
    }
    setActiveTab(tab as 'login' | 'register');
  };

  const handleClearSession = async () => {
    try {
      try { clearLocalStorageSafe(); sessionStorage.clear(); } catch {}
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const name = cookie.split('=')[0].trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      }
      setLoginError('');
      setRateLimitSeconds(0);
      await new Promise(r => setTimeout(r, 500));
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    if (isInRateLimitCooldown()) {
      const remaining = getRemainingCooldownSeconds();
      setLoginError(`Molimo sačekajte još ${remaining} sekundi pre ponovnog pokušaja.`);
      setRateLimitSeconds(remaining);
      setLoginLoading(false);
      return;
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (signInError) throw signInError;
      if (!data.user) throw new Error('Failed to authenticate. Please try again.');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, is_banned')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) throw new Error('Failed to load profile. Please contact support.');
      if (!profile) throw new Error('Profile not found. Please contact support.');
      if (profile.is_banned) {
        await supabase.auth.signOut();
        throw new Error(t('login.bannedError'));
      }

      await new Promise(r => setTimeout(r, 500));
      router.push(redirectTo);
    } catch (err: any) {
      if (err.message.includes('Invalid login credentials')) {
        setLoginError('Pogrešan email ili lozinka. Pokušajte ponovo.');
      } else if (err.message.includes('Email not confirmed')) {
        setLoginError('Molimo vas potvrdite vašu email adresu pre prijave.');
      } else if (err.message.includes('rate limit') || err.message.includes('Too many requests') || err.status === 429) {
        setRateLimitHit();
        const cooldown = getRemainingCooldownSeconds();
        setLoginError(`Previše pokušaja. Molimo sačekajte ${cooldown} sekundi.`);
        setRateLimitSeconds(cooldown);
      } else {
        setLoginError(err.message || 'Greška prilikom prijave. Pokušajte ponovo.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    trackEvent('click_google_signup');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setRegisterError(error.message);
      setGoogleLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');
    setRegisterLoading(true);
    trackEvent('submit_register');

    try {
      if (registerPassword.length < 6) {
        throw new Error(t('login.minChars'));
      }

      if (!agreedToTerms) {
        throw new Error('Morate prihvatiti uslove korišćenja.');
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: registerEmail,
        password: registerPassword,
      });

      if (signUpError) throw signUpError;
      if (!data.user) throw new Error('Failed to create account. Please try again.');

      const signupSource = localStorage.getItem('signup_source') || 'direct';
      localStorage.removeItem('signup_source');
      trackEvent('register_success', { source: signupSource });
      await new Promise(r => setTimeout(r, 500));
      router.push('/onboarding');
    } catch (err: any) {
      if (err.message.includes('already registered') || err.message.includes('User already registered')) {
        setRegisterError('Ovaj email je već registrovan. Prijavite se umesto toga.');
      } else if (err.message.includes('Invalid email')) {
        setRegisterError('Unesite ispravnu email adresu.');
      } else {
        setRegisterError(err.message || 'Greška pri kreiranju naloga. Pokušajte ponovo.');
      }
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMTU1LDAsMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-60" />

      <Card className="w-full max-w-md relative shadow-2xl border-slate-700">
        <CardHeader className="space-y-1 text-center pb-5">
          <div className="flex justify-center mb-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-black text-white" style={{ fontFamily: 'Georgia, serif' }}>G</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-slate-800">GigZone</CardTitle>
        </CardHeader>

        <CardContent className="pb-6">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2 mb-5 h-11">
              <TabsTrigger value="login" className="text-base">{t('login.signIn')}</TabsTrigger>
              <TabsTrigger value="register" className="text-base">{t('login.signUp')}</TabsTrigger>
            </TabsList>

            {/* ── PRIJAVA ────────────────────────────────────────────────── */}
            <TabsContent value="login" className="mt-0">
              <form onSubmit={handleLogin} className="space-y-4">

                {showResetSuccess && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      {t('login.resetSuccess')}
                    </AlertDescription>
                  </Alert>
                )}

                {loginError && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="space-y-3">
                      <div>
                        {loginError}
                        {rateLimitSeconds > 0 && (
                          <span className="font-bold ml-1 text-lg">{rateLimitSeconds}s</span>
                        )}
                      </div>
                      {loginError.includes('Previše pokušaja') && (
                        <div className="space-y-2 pt-2 border-t border-red-200">
                          <Button
                            type="button" size="sm" variant="outline"
                            onClick={() => {
                              clearRateLimitCooldown();
                              try { clearLocalStorageSafe(); } catch {}
                              setLoginError('');
                              setRateLimitSeconds(0);
                              window.location.reload();
                            }}
                            className="w-full"
                          >
                            Resetuj Session i Pokušaj Ponovo
                          </Button>
                          <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                            <li>Kliknite dugme iznad da resetujete sesiju</li>
                            <li>Promenite mrežu (WiFi → mobilni podaci)</li>
                          </ul>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-sm font-medium">
                    {t('login.emailLabel')}
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder={t('login.emailPlaceholder')}
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password" className="text-sm font-medium">
                      {t('login.passwordLabel')}
                    </Label>
                    <Link href="/forgot-password" className="text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors">
                      {t('login.forgotPassword')}
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder={t('login.passwordPlaceholder')}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold bg-orange-600 hover:bg-orange-700 shadow-md disabled:opacity-50"
                  disabled={loginLoading || rateLimitSeconds > 0}
                >
                  {loginLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t('login.signingIn')}
                    </span>
                  ) : rateLimitSeconds > 0 ? (
                    t('login.waitSeconds').replace('{s}', String(rateLimitSeconds))
                  ) : (
                    t('login.signInButton')
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* ── REGISTRACIJA ───────────────────────────────────────────── */}
            <TabsContent value="register" className="mt-0">

              {/* Tagline */}
              <div className="text-center mb-5">
                <p className="text-sm font-semibold text-slate-700">{t('login.tagline')}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t('login.taglineSubtitle')}</p>
              </div>

              <div className="space-y-3">

                {registerError && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{registerError}</AlertDescription>
                  </Alert>
                )}

                {/* Google button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="w-full h-12 flex items-center justify-center gap-3 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all font-semibold text-slate-700 text-sm shadow-sm disabled:opacity-60"
                >
                  {googleLoading ? (
                    <div className="h-5 w-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <GoogleIcon />
                  )}
                  {t('login.continueWithGoogle')}
                </button>

                {/* Divider */}
                <div className="relative flex items-center py-1">
                  <div className="flex-1 border-t border-slate-200" />
                  <span className="px-3 text-xs text-slate-400 uppercase tracking-wider">{t('login.orDivider')}</span>
                  <div className="flex-1 border-t border-slate-200" />
                </div>

                <form onSubmit={handleRegister} className="space-y-3">

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email" className="text-sm font-medium">{t('login.emailLabel')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input
                        id="reg-email"
                        type="email"
                        placeholder={t('login.emailPlaceholder')}
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        className="pl-10 h-11"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-password" className="text-sm font-medium">{t('login.passwordLabel')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input
                        id="reg-password"
                        type="password"
                        placeholder={t('login.newPasswordPlaceholder')}
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        className="pl-10 h-11"
                        required
                        minLength={6}
                      />
                    </div>
                    <p className="text-xs text-slate-400 pl-1">{t('login.minChars')}</p>
                  </div>

                  {/* Terms checkbox — kompaktan */}
                  <label className="flex items-start gap-2.5 cursor-pointer select-none py-1">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-600 accent-orange-600 shrink-0"
                    />
                    <span className="text-xs text-slate-500 leading-relaxed">
                      {t('login.agreementText')}{' '}
                      <Link href="/privacy" target="_blank" className="text-orange-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                        {t('login.privacyPolicy')}
                      </Link>
                      {' '}{t('login.agreementAnd')}{' '}
                      <Link href="/terms" target="_blank" className="text-orange-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                        {t('login.termsOfService')}
                      </Link>
                    </span>
                  </label>

                  {/* Submit */}
                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-bold bg-orange-600 hover:bg-orange-700 shadow-md shadow-orange-600/20 rounded-xl"
                    disabled={registerLoading || !agreedToTerms}
                    onClick={() => trackEvent('click_register_cta')}
                  >
                    {registerLoading ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t('login.creatingAccount')}
                      </span>
                    ) : (
                      t('login.createAccount')
                    )}
                  </Button>

                </form>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>

        <CardFooter className="border-t bg-slate-50 py-3">
          <div className="flex items-center justify-center gap-6 w-full text-sm">
            <Link href="/" className="flex items-center gap-1.5 text-slate-600 hover:text-orange-600 transition-colors font-medium">
              <Home className="h-4 w-4" />
              {t('login.homeLink')}
            </Link>
            <div className="h-4 w-px bg-slate-300" />
            <button
              onClick={handleClearSession}
              className="flex items-center gap-1.5 text-slate-600 hover:text-orange-600 transition-colors font-medium"
            >
              <LogOut className="h-4 w-4" />
              {t('login.clearSession')}
            </button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
