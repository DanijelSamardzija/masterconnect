'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Share, Plus, Download } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';

// Saved permanently only after user clicks Install
const PWA_INSTALLED_KEY = 'pwa_installed_v1';
// Saved for current session only when user clicks X
const PWA_SESSION_KEY = 'pwa_dismissed_session';
// Counts how many sessions the user has visited (show banner only on 2nd+)
const PWA_VISIT_COUNT_KEY = 'pwa_visit_count';

function isIOS() {
  if (typeof window === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return ('standalone' in navigator && (navigator as any).standalone) ||
    window.matchMedia('(display-mode: standalone)').matches;
}

export function PWARegistration() {
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const { language } = useLanguage();
  const { user } = useAuth();
  const pathname = usePathname();

  // Ne prikazuj banner na landing/login stranicama — fokus na konverziji
  const hideOnPage = pathname === '/join' || pathname === '/login' || pathname === '/onboarding' || pathname?.startsWith('/auth');

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  window.location.reload();
                }
              });
            }
          });
          setInterval(() => { registration.update(); }, 60000);
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error);
        });
    }

    // Only show to logged-in users
    if (!user) return;

    // Already installed as PWA — never show
    if (isInStandaloneMode()) return;

    // User clicked Install — never show again
    try { if (localStorage.getItem(PWA_INSTALLED_KEY)) return; } catch {}

    // User clicked X this session — don't show again until next visit
    try { if (sessionStorage.getItem(PWA_SESSION_KEY)) return; } catch {}

    // Track visits — only show from the 2nd session onward
    try {
      const visitCount = parseInt(localStorage.getItem(PWA_VISIT_COUNT_KEY) || '0', 10);
      if (visitCount < 1) {
        // First visit — just record it, don't show
        localStorage.setItem(PWA_VISIT_COUNT_KEY, '1');
        return;
      }
    } catch {}

    if (isIOS()) {
      setTimeout(() => setShowIOSPrompt(true), 1000);
      return;
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowBanner(true), 1000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [user]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
    // Mark as installed permanently
    try { localStorage.setItem(PWA_INSTALLED_KEY, 'true'); } catch {}
    setShowBanner(false);
  };

  const handleDismiss = () => {
    // Only hide for this session — next visit shows again
    try { sessionStorage.setItem(PWA_SESSION_KEY, 'true'); } catch {}
    setShowBanner(false);
    setShowIOSPrompt(false);
  };

  const sr = language === 'sr';

  if (hideOnPage) return null;

  // ── iOS uputstva (dialog ostaje isti) ─────────────────────────────────────
  if (showIOSPrompt) {
    return (
      <Dialog open={showIOSPrompt} onOpenChange={handleDismiss}>
        <DialogContent className="max-w-md bg-gradient-to-br from-orange-600 via-orange-500 to-orange-600 border-orange-400/50">
          <button onClick={handleDismiss} className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
            <X className="h-4 w-4 text-white" />
          </button>

          <div className="flex flex-col items-center text-center py-6">
            <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center shadow-2xl mb-4">
              <span className="text-5xl font-bold text-orange-600">G</span>
            </div>

            <h2 className="text-3xl font-bold mb-2 text-white">GigZone</h2>
            <p className="text-white/90 text-sm mb-6 px-4">
              {sr ? 'Dodajte aplikaciju na početni ekran' : 'Add app to your home screen'}
            </p>

            <div className="bg-white/20 rounded-2xl p-4 w-full text-left space-y-4 mb-6">
              <div className="flex items-center gap-3 text-white">
                <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center shrink-0 font-bold">1</div>
                <div className="flex items-center gap-2 text-sm">
                  {sr ? 'Kliknite na dugme' : 'Tap the'}
                  <span className="inline-flex items-center gap-1 bg-white/30 rounded px-2 py-0.5 font-semibold">
                    <Share className="h-3.5 w-3.5" /> Share
                  </span>
                  {sr ? 'u browseru' : 'button in Safari'}
                </div>
              </div>

              <div className="flex items-center gap-3 text-white">
                <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center shrink-0 font-bold">2</div>
                <div className="flex items-center gap-2 text-sm">
                  {sr ? 'Odaberite' : 'Select'}
                  <span className="inline-flex items-center gap-1 bg-white/30 rounded px-2 py-0.5 font-semibold">
                    <Plus className="h-3.5 w-3.5" /> {sr ? 'Dodaj na početni ekran' : 'Add to Home Screen'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-white">
                <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center shrink-0 font-bold">3</div>
                <p className="text-sm">{sr ? 'Kliknite "Dodaj" u gornjem desnom uglu' : 'Tap "Add" in the top right corner'}</p>
              </div>
            </div>

            <Button
              onClick={handleDismiss}
              variant="outline"
              className="w-full bg-white/95 hover:bg-white text-orange-600 border-2 border-white font-semibold py-6 text-base"
            >
              {sr ? 'Zatvori' : 'Close'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Mali baner ispod headera ──────────────────────────────────────────────
  if (!showBanner) return null;

  return (
    <div className="fixed left-0 right-0 z-[90] flex justify-center px-3 pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 60px)' }}
    >
      <div className="pointer-events-auto w-full max-w-[430px] animate-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-3 rounded-2xl bg-orange-600 px-3 py-2.5 shadow-lg shadow-orange-900/30">
          {/* Logo */}
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
            <span className="text-lg font-black text-orange-600">G</span>
          </div>

          {/* Text */}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white leading-tight">GigZone</p>
            <p className="text-[11px] text-orange-100 leading-tight truncate">
              {sr ? 'Instaliraj aplikaciju na telefon' : 'Install app on your phone'}
            </p>
          </div>

          {/* Install button */}
          <button
            onClick={handleInstall}
            className="flex-shrink-0 flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-orange-600 shadow-sm hover:bg-orange-50 active:scale-95 transition-all"
          >
            <Download className="h-3 w-3" />
            {sr ? 'Instaliraj' : 'Install'}
          </button>

          {/* Close */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/15 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
