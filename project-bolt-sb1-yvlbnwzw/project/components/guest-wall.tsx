'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { saveAnonymousId } from '@/lib/analytics';

interface GuestWallProps {
  variant?: 'feed' | 'page';
}

export function GuestWall({ variant = 'page' }: GuestWallProps) {
  const [userCount, setUserCount] = useState<number | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.from('profiles').select('id', { count: 'exact', head: true }).then(({ count }) => {
      if (count) setUserCount(count);
    });
  }, []);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    saveAnonymousId();
    localStorage.setItem('signup_source', 'guest_wall');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setGoogleLoading(false);
  };

  const content = (
    <div className="flex flex-col items-center justify-center text-center px-6 py-10 gap-5 w-full h-full">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 border border-orange-500/20">
        <Lock className="h-8 w-8 text-orange-500" />
      </div>

      <div>
        <p className="text-xl font-black text-foreground mb-1">Registruj se besplatno</p>
        <p className="text-sm text-muted-foreground">
          {userCount ? (
            <>Pridruži se <span className="font-bold text-orange-500">{userCount}+</span> profesionalaca i klijenata</>
          ) : (
            'Pridruži se našoj zajednici'
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full h-12 bg-white hover:bg-gray-100 text-gray-800 font-bold rounded-xl shadow flex items-center justify-center gap-3"
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

        <Button
          onClick={() => { localStorage.setItem('signup_source', 'guest_wall'); router.push('/login?tab=register'); }}
          className="w-full h-11 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-600/30"
        >
          Registruj se emailom
        </Button>

        <button
          onClick={() => router.push('/login')}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Već imam nalog → Prijavi se
        </button>
      </div>
    </div>
  );

  if (variant === 'feed') {
    return (
      <div className="snap-start flex justify-center px-2 py-1" style={{ height: 'calc(100dvh - 60px)' }}>
        <div className="w-full max-w-md h-full flex flex-col rounded-2xl overflow-hidden bg-card border border-border shadow-sm">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-4">
      {content}
    </div>
  );
}
