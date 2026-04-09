'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserCircle, Wrench, Mail, Lock, User, AlertCircle, Home, LogOut, CheckCircle } from 'lucide-react';
import { CityAutocomplete } from '@/components/city-autocomplete';
import { CategoryCombobox } from '@/components/category-combobox';
import { Checkbox } from '@/components/ui/checkbox';
import { setRateLimitHit, isInRateLimitCooldown, getRemainingCooldownSeconds, clearRateLimitCooldown } from '@/lib/rate-limit-handler';
import { useLanguage } from '@/lib/contexts/language-context';
import { countries } from '@/lib/countries';

type UserRole = 'customer' | 'professional';

// Briše localStorage ali čuva ključeve koji ne smiju biti obrisani
function clearLocalStorageSafe() {
  const KEEP_KEYS = ['pwa_install_dismissed_v2'];
  const saved: Record<string, string> = {};
  for (const key of KEEP_KEYS) {
    const val = localStorage.getItem(key);
    if (val !== null) saved[key] = val;
  }
  clearLocalStorageSafe();
  for (const [key, val] of Object.entries(saved)) {
    localStorage.setItem(key, val);
  }
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, language } = useLanguage();
  const redirectTo = searchParams.get('redirect') || '/feed';
  const resetSuccess = searchParams.get('reset') === 'success';
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Ako je korisnik već ulogovan, preusmjeri na feed
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) router.replace('/feed');
    });
  }, []);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showResetSuccess, setShowResetSuccess] = useState(resetSuccess);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  useEffect(() => {
    if (rateLimitSeconds > 0) {
      const timer = setTimeout(() => {
        const newSeconds = rateLimitSeconds - 1;
        setRateLimitSeconds(newSeconds);

        if (newSeconds === 0) {
          clearRateLimitCooldown();
          setLoginError('');
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [rateLimitSeconds]);

  const handleClearSession = async () => {
    try {
      console.log('[Clear Session] Clearing all storage WITHOUT calling signOut');

      if (typeof window !== 'undefined') {
        try {
          clearLocalStorageSafe();
          sessionStorage.clear();
        } catch (storageError) {
          console.warn('[Clear Session] Storage access blocked:', storageError);
        }

        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i];
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        }
      }

      setLoginError('');
      setRateLimitSeconds(0);

      console.log('[Clear Session] Storage cleared, reloading...');
      await new Promise(resolve => setTimeout(resolve, 500));

      window.location.reload();
    } catch (error) {
      console.error('Error clearing session:', error);
      window.location.reload();
    }
  };

  const handleTabChange = async (tab: string) => {
    if (tab === 'register') {
      if (typeof window !== 'undefined') {
        try {
          clearLocalStorageSafe();
          sessionStorage.clear();
        } catch (storageError) {
          console.warn('[Tab Change] Storage access blocked:', storageError);
        }
      }
    }
    setActiveTab(tab as 'login' | 'register');
  };

  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerRole, setRegisterRole] = useState<UserRole>('customer');
  const [registerCity, setRegisterCity] = useState('');
  const [registerCountry, setRegisterCountry] = useState('');
  const [registerCustomCountry, setRegisterCustomCountry] = useState('');
  const [registerCategory, setRegisterCategory] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    const remaining = getRemainingCooldownSeconds();
    if (remaining > 0) {
      setRateLimitSeconds(remaining);
      setLoginError(`Previše pokušaja. Molimo sačekajte ${remaining} sekundi.`);
    }
  }, []);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        const data = await response.json();
        if (data.categories) {
          setCategories(data.categories);
        }
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };

    if (activeTab === 'register') {
      loadCategories();
    }
  }, [activeTab]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    console.log('[Login] Starting login attempt...');
    console.log('[Login] Checking rate limit cooldown...');

    if (isInRateLimitCooldown()) {
      const remaining = getRemainingCooldownSeconds();
      console.log('[Login] BLOCKED by cooldown, remaining:', remaining);
      setLoginError(`Molimo sačekajte još ${remaining} sekundi pre ponovnog pokušaja.`);
      setRateLimitSeconds(remaining);
      setLoginLoading(false);
      return;
    }

    console.log('[Login] Not in cooldown, proceeding with login...');

    try {
      console.log('[Login] Calling signInWithPassword...');

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      console.log('[Login] Response received:', { hasData: !!data, hasError: !!signInError });

      if (signInError) throw signInError;

      if (!data.user) {
        throw new Error('Failed to authenticate. Please try again.');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, is_banned')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Profile error:', profileError);
        throw new Error('Failed to load profile. Please contact support.');
      }

      if (!profile) {
        throw new Error('Profile not found. Please contact support.');
      }

      if (profile.is_banned) {
        await supabase.auth.signOut();
        throw new Error(t('login.bannedError'));
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      router.push(redirectTo);
    } catch (err: any) {
      console.error('=== FULL LOGIN ERROR ===');
      console.error('Error object:', err);
      console.error('Error message:', err.message);
      console.error('Error status:', err.status);
      console.error('Error code:', err.code);
      console.error('Error name:', err.name);
      console.error('=======================');

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');
    setRegisterLoading(true);

    try {
      if (!registerName.trim()) {
        throw new Error('Please enter your full name');
      }

      if (registerPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      if (!registerCity.trim()) {
        throw new Error('Please select your city');
      }

      if (!registerCountry.trim()) {
        throw new Error('Please select your country');
      }

      if (!registerCategory.trim()) {
        throw new Error('Please select a category');
      }

      if (!agreedToTerms) {
        throw new Error('You must agree to the Privacy Policy and Terms of Service');
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: registerEmail,
        password: registerPassword,
        options: {
          data: {
            full_name: registerName,
            account_type: registerRole,
            city: registerCity,
            country: registerCountry === 'Ostalo' ? registerCustomCountry.trim() || 'Ostalo' : registerCountry,
            category: registerCategory,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (!data.user) {
        throw new Error('Failed to create account. Please try again.');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      router.push(redirectTo);
    } catch (err: any) {
      console.error('=== FULL REGISTRATION ERROR ===');
      console.error('Error object:', err);
      console.error('Error message:', err.message);
      console.error('Error status:', err.status);
      console.error('Error code:', err.code);
      console.error('===============================');

      if (err.message.includes('already registered') || err.message.includes('User already registered')) {
        setRegisterError('This email is already registered. Please sign in instead.');
      } else if (err.message.includes('Invalid email')) {
        setRegisterError('Please enter a valid email address.');
      } else {
        setRegisterError(err.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMTU1LDAsMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-60"></div>

      <Card className="w-full max-w-md relative shadow-2xl border-slate-700">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="flex justify-center mb-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
              <span className="text-3xl font-black text-white" style={{ fontFamily: 'Georgia, serif' }}>M</span>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-slate-800">
            MasterConnect
          </CardTitle>
          <CardDescription className="text-base">
            Connect with professionals or offer your services
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-6">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2 mb-6 h-11">
              <TabsTrigger value="login" className="text-base">Sign In</TabsTrigger>
              <TabsTrigger value="register" className="text-base">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-0">
              <form onSubmit={handleLogin} className="space-y-5">
                {showResetSuccess && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Password reset successful! You can now sign in with your new password.
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
                          <span className="font-bold ml-1 text-lg">
                            {rateLimitSeconds}s
                          </span>
                        )}
                      </div>
                      {loginError.includes('Previše pokušaja') && (
                        <div className="space-y-2 pt-2 border-t border-red-200">
                          <p className="text-xs text-red-700">
                            <strong>Šta uraditi:</strong>
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              clearRateLimitCooldown();
                              try {
                                clearLocalStorageSafe();
                              } catch (storageError) {
                                console.warn('[Reset] Storage access blocked:', storageError);
                              }
                              setLoginError('');
                              setRateLimitSeconds(0);
                              window.location.reload();
                            }}
                            className="mt-2 w-full"
                          >
                            Resetuj Session i Pokušaj Ponovo
                          </Button>
                          <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                            <li>Kliknite dugme iznad da resetujete sesiju</li>
                            <li>Promenite mrežu (WiFi → mobilni podaci)</li>
                            <li>Koristite VPN</li>
                          </ul>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleClearSession}
                              className="flex-1 border-red-300 hover:bg-red-100"
                            >
                              Očisti keš
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setRateLimitSeconds(0)}
                              className="flex-1 border-blue-300 hover:bg-blue-100 text-blue-700"
                            >
                              Resetuj odmah
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleClearSession}
                            className="hidden w-full border-red-300 hover:bg-red-100"
                          >
                            <LogOut className="h-3 w-3 mr-2" />
                            Očisti keš i reload stranicu
                          </Button>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-sm font-medium">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="Enter your email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password" className="text-sm font-medium">
                      Password
                    </Label>
                    <Link
                      href="/forgot-password"
                      className="text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium bg-orange-600 hover:bg-orange-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loginLoading || rateLimitSeconds > 0}
                >
                  {loginLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Prijavljivanje...
                    </span>
                  ) : rateLimitSeconds > 0 ? (
                    `Sačekajte ${rateLimitSeconds}s`
                  ) : (
                    'Prijavi se'
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="mt-0">
              <form onSubmit={handleRegister} className="space-y-5">
                {registerError && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{registerError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="register-name" className="text-sm font-medium">
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Enter your full name"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email" className="text-sm font-medium">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="Enter your email"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password" className="text-sm font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Create a password"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      className="pl-10 h-11"
                      required
                      minLength={6}
                    />
                  </div>
                  <p className="text-xs text-slate-500 pl-1">Minimum 6 characters</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-city" className="text-sm font-medium">
                    City
                  </Label>
                  <CityAutocomplete
                    value={registerCity}
                    onChange={setRegisterCity}
                    placeholder="Select your city"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-country" className="text-sm font-medium">
                    {language === 'en' ? 'Country' : 'Država'}
                  </Label>
                  <select
                    id="register-country"
                    value={registerCountry}
                    onChange={(e) => { setRegisterCountry(e.target.value); setRegisterCustomCountry(''); }}
                    className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    required
                  >
                    <option value="">{language === 'en' ? 'Select your country' : 'Odaberite državu'}</option>
                    {countries.map((c) => (
                      <option key={c.value} value={c.value}>
                        {language === 'en' ? c.en : c.sr}
                      </option>
                    ))}
                  </select>
                  {registerCountry === 'Ostalo' && (
                    <Input
                      placeholder={language === 'en' ? 'Enter your country' : 'Unesite vašu državu'}
                      value={registerCustomCountry}
                      onChange={(e) => setRegisterCustomCountry(e.target.value)}
                      className="h-11"
                      required
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-category" className="text-sm font-medium">
                    Category
                  </Label>
                  <CategoryCombobox
                    value={registerCategory}
                    onChange={setRegisterCategory}
                    suggestions={categories}
                    placeholder="Select a category"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Account Type</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRegisterRole('customer')}
                      className={`group flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${
                        registerRole === 'customer'
                          ? 'border-orange-500 bg-orange-50 shadow-md scale-[1.02]'
                          : 'border-slate-200 hover:border-orange-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${
                        registerRole === 'customer' ? 'bg-orange-100' : 'bg-slate-100 group-hover:bg-orange-50'
                      }`}>
                        <UserCircle className={`h-7 w-7 ${
                          registerRole === 'customer' ? 'text-orange-600' : 'text-slate-600'
                        }`} />
                      </div>
                      <div className="text-center">
                        <span className="font-semibold text-sm block">Customer</span>
                        <span className="text-xs text-slate-500 mt-1 block">
                          Find services
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegisterRole('professional')}
                      className={`group flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${
                        registerRole === 'professional'
                          ? 'border-orange-500 bg-orange-50 shadow-md scale-[1.02]'
                          : 'border-slate-200 hover:border-orange-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${
                        registerRole === 'professional' ? 'bg-orange-100' : 'bg-slate-100 group-hover:bg-orange-50'
                      }`}>
                        <Wrench className={`h-7 w-7 ${
                          registerRole === 'professional' ? 'text-orange-600' : 'text-slate-600'
                        }`} />
                      </div>
                      <div className="text-center">
                        <span className="font-semibold text-sm block">Professional</span>
                        <span className="text-xs text-slate-500 mt-1 block">
                          Offer services
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border rounded-lg bg-slate-50">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                    className="mt-1"
                  />
                  <label
                    htmlFor="terms"
                    className="text-sm text-slate-700 cursor-pointer leading-relaxed"
                  >
                    {t('login.agreeToTermsPart1')}{' '}
                    <Link
                      href="/privacy"
                      target="_blank"
                      className="text-orange-600 hover:text-orange-700 font-medium underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t('login.privacyPolicy')}
                    </Link>
                    {' '}{t('login.and')}{' '}
                    <Link
                      href="/terms"
                      target="_blank"
                      className="text-orange-600 hover:text-orange-700 font-medium underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t('login.termsOfService')}
                    </Link>
                  </label>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium bg-orange-600 hover:bg-orange-700 shadow-md"
                  disabled={registerLoading || !agreedToTerms}
                >
                  {registerLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>

        <CardFooter className="border-t bg-slate-50 py-4">
          <div className="flex items-center justify-center gap-6 w-full text-sm">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-slate-600 hover:text-orange-600 transition-colors font-medium"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
            <div className="h-4 w-px bg-slate-300" />
            <button
              onClick={handleClearSession}
              className="flex items-center gap-1.5 text-slate-600 hover:text-orange-600 transition-colors font-medium"
            >
              <LogOut className="h-4 w-4" />
              Clear Session
            </button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
