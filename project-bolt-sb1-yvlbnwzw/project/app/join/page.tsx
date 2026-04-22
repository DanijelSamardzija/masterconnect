'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Users, Briefcase, Wrench, Star } from 'lucide-react';

export default function JoinPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/feed');
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center px-4 py-12">

      {/* Logo */}
      <div className="mb-8 text-center">
        <span className="text-2xl font-black text-white tracking-tight">
          Gig<span className="text-orange-500">Zone</span>
        </span>
      </div>

      {/* Main card */}
      <div className="w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 text-center shadow-2xl">

        {/* Headline */}
        <h1 className="text-3xl md:text-4xl font-black text-white leading-tight mb-3">
          Tražiš posao<br />ili klijente?
        </h1>
        <p className="text-slate-400 text-base mb-8">
          Registruj se besplatno za 30 sekundi i počni danas.
        </p>

        {/* Benefits */}
        <div className="space-y-3 mb-4 text-left">
          {[
            { icon: <Wrench className="h-4 w-4 text-orange-400 flex-shrink-0" />, text: 'Objavi usluge i pronađi klijente' },
            { icon: <Briefcase className="h-4 w-4 text-orange-400 flex-shrink-0" />, text: 'Nađi posao u svojoj oblasti' },
            { icon: <Users className="h-4 w-4 text-orange-400 flex-shrink-0" />, text: 'Komuniciraj direktno, bez posrednika' },
            { icon: <Star className="h-4 w-4 text-orange-400 flex-shrink-0" />, text: 'Gradi reputaciju kroz ocene' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
              {item.icon}
              <span className="text-slate-300 text-sm">{item.text}</span>
            </div>
          ))}
        </div>

        {/* Trust text */}
        <p className="text-slate-500 text-xs text-center mb-6">
          Bez provizije. Bez posrednika. Direktan kontakt.
        </p>

        {/* CTA */}
        <Button
          size="lg"
          onClick={() => router.push('/login?tab=register')}
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

      {/* Trust */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-slate-600 text-xs">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span>Bez kreditne kartice</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span>Registracija za 30 sekundi</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span>100% besplatno</span>
        </div>
      </div>

    </div>
  );
}
