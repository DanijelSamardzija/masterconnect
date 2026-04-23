'use client';

import { useRouter } from 'next/navigation';
import { X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GuestAction } from '@/lib/guest-intent';
import { trackEvent } from '@/lib/analytics';

const ACTION_TEXT: Record<GuestAction, string> = {
  like: 'lajkuješ',
  comment: 'ostaviš komentar',
  message: 'pošalješ poruku',
  apply: 'se prijaviš na oglas',
  follow: 'pratiš profil',
  post: 'objaviš oglas',
  phone: 'vidiš kontakt informacije',
  save: 'sačuvaš oglas',
  contact: 'stupiš u kontakt',
};

interface Props {
  open: boolean;
  onClose: () => void;
  action?: GuestAction;
}

export function GuestGateModal({ open, onClose, action }: Props) {
  const router = useRouter();

  if (!open) return null;

  const actionText = action ? ACTION_TEXT[action] : null;

  const goToJoin = () => {
    trackEvent('click_register_cta', { source: 'guest_gate', action: action ?? '' });
    localStorage.setItem('signup_source', 'guest_gate');
    router.push('/join');
    onClose();
  };

  const goToLogin = () => {
    router.push('/login');
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[100] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[101] animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl px-6 pt-5 pb-8 max-w-lg mx-auto relative">

          {/* Pull indicator */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Logo */}
          <div className="flex justify-center mt-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-black text-white" style={{ fontFamily: 'Georgia, serif' }}>G</span>
            </div>
          </div>

          {/* Text */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1.5">
              Registruj se da nastaviš
            </h2>
            {actionText && (
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">
                Da bi <strong>{actionText}</strong>, potreban je nalog.
              </p>
            )}
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Napravi nalog besplatno i otključaj sve opcije.
            </p>
          </div>

          {/* CTAs */}
          <div className="space-y-3">
            <Button
              className="w-full h-13 bg-orange-600 hover:bg-orange-700 text-white font-bold text-base rounded-xl shadow-md shadow-orange-600/20"
              onClick={goToJoin}
            >
              Registruj se besplatno
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <button
              onClick={goToLogin}
              className="w-full text-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors py-1"
            >
              Već imam nalog → Prijavi se
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
