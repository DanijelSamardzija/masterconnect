'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Users, Briefcase, Wrench, Star } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

export default function JoinPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

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
        <p className="text-slate-400 text-sm mb-6">
          Besplatno. Bez obaveza. Direktan kontakt.
        </p>

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

        {/* Main CTA */}
        <Button
          size="lg"
          onClick={() => {
            trackEvent('click_register_cta', { source: 'join_page' });
            router.push('/login?tab=register');
          }}
          className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold text-lg h-14 rounded-2xl shadow-lg shadow-orange-600/30 mb-3"
        >
          Registruj se besplatno
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
