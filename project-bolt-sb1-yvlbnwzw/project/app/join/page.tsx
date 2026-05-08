'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Users, Briefcase, Wrench, Star, Loader2 } from 'lucide-react';
import { trackEvent, saveAnonymousId } from '@/lib/analytics';

export default function JoinPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [userCount, setUserCount] = useState<number | null>(null);

  useEffect(() => {
    supabase.from('profiles').select('id', { count: 'exact', head: true }).then(({ count }) => {
      if (count) setUserCount(count);
    });
  }, []);

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    trackEvent('click_google_signup', { source: 'join_page' });
    trackEvent('click_google_login', { source: 'join_page' });
    saveAnonymousId();
    localStorage.setItem('signup_source', 'join_page');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setGoogleLoading(false);
  };

  useEffect(() => {
    if (!loading && user) {
      router.replace('/feed');
      return;
    }
    trackEvent('view_join_page');
  }, [user, loading]);

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
      <div className="mb-6 text-center">
        <span className="text-2xl font-black text-white tracking-tight">
          Gig<span className="text-orange-500">Zone</span>
        </span>
      </div>

      {/* Main card */}
      <div className="w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-3xl p-7 text-center shadow-2xl">

        {/* Headline */}
        <h1 className="text-3xl font-black text-white leading-tight mb-1">
          Napravi nalog<br />za 30 sekundi
        </h1>
        <p className="text-slate-400 text-sm mb-3">
          Besplatno. Bez obaveza. Direktan kontakt.
        </p>
        {userCount && (
          <div className="flex items-center justify-center gap-2 mb-5">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 border-2 border-[#1a1a1a]" />
              ))}
            </div>
            <span className="text-slate-300 text-sm">
              <span className="text-white font-bold">{userCount}+</span> korisnika već na platformi
            </span>
          </div>
        )}

        {/* Benefits */}
        <div className="space-y-2.5 mb-5 text-left">
          {[
            { icon: <Wrench className="h-4 w-4 text-orange-400 shrink-0" />, text: 'Objavi usluge i pronađi klijente' },
            { icon: <Briefcase className="h-4 w-4 text-orange-400 shrink-0" />, text: 'Nađi posao u svojoj oblasti' },
            { icon: <Users className="h-4 w-4 text-orange-400 shrink-0" />, text: 'Komuniciraj direktno, bez posrednika' },
            { icon: <Star className="h-4 w-4 text-orange-400 shrink-0" />, text: 'Gradi reputaciju kroz ocene' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5">
              {item.icon}
              <span className="text-slate-300 text-sm">{item.text}</span>
            </div>
          ))}
        </div>

        {/* Google CTA */}
        <Button
          size="lg"
          onClick={handleGoogleSignup}
          disabled={googleLoading}
          className="w-full bg-white hover:bg-gray-100 text-gray-800 font-bold text-base h-14 rounded-2xl shadow-lg mb-3 flex items-center justify-center gap-3"
        >
          {googleLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Nastavi sa Google
        </Button>

        {/* Email CTA */}
        <Button
          size="lg"
          onClick={() => {
            trackEvent('click_register_cta', { source: 'join_page' });
            localStorage.setItem('signup_source', 'join_page');
            router.push('/login?tab=register');
          }}
          className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold text-base h-12 rounded-2xl shadow-lg shadow-orange-600/30 mb-3"
        >
          Registruj se emailom
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>

        <button
          onClick={() => router.push('/login')}
          className="text-slate-500 text-sm hover:text-slate-300 transition-colors"
        >
          Već imam nalog → Prijavi se
        </button>
      </div>

      {/* Trust badges */}
      <div className="mt-7 flex flex-wrap items-center justify-center gap-4 text-slate-600 text-xs">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span>Bez kreditne kartice</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span>30 sekundi</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span>100% besplatno</span>
        </div>
      </div>

    </div>
  );
}
