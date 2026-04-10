'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Share, Plus } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/language-context';

const PWA_DISMISSED_KEY = 'pwa_install_dismissed_v2';

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
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const { language } = useLanguage();

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

    try {
      if (localStorage.getItem(PWA_DISMISSED_KEY)) return;
    } catch {}

    // iOS — pokaži ručna uputstva
    if (isIOS() && !isInStandaloneMode()) {
      setShowIOSPrompt(true);
      return;
    }

    // Android/Desktop — standardni baner
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      try { if (localStorage.getItem(PWA_DISMISSED_KEY)) return; } catch {}
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    try { localStorage.setItem(PWA_DISMISSED_KEY, 'true'); } catch {}
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    try { localStorage.setItem(PWA_DISMISSED_KEY, 'true'); } catch {}
    setShowInstallPrompt(false);
    setShowIOSPrompt(false);
  };

  const sr = language === 'sr';

  // ── iOS uputstva ──────────────────────────────────────────────────────────
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

  // ── Android / Desktop baner ───────────────────────────────────────────────
  return (
    <Dialog open={showInstallPrompt} onOpenChange={handleDismiss}>
      <DialogContent className="max-w-md bg-gradient-to-br from-orange-600 via-orange-500 to-orange-600 border-orange-400/50">
        <button onClick={handleDismiss} className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
          <X className="h-4 w-4 text-white" />
        </button>

        <div className="flex flex-col items-center text-center py-6">
          <div className="w-24 h-24 rounded-3xl bg-white flex items-center justify-center shadow-2xl mb-6">
            <span className="text-6xl font-bold text-orange-600">G</span>
          </div>

          <h2 className="text-4xl font-bold mb-3 text-white">GigZone</h2>

          <p className="text-white/90 text-base mb-8 px-6 max-w-md mx-auto leading-relaxed">
            {sr
              ? 'Instalirajte aplikaciju za direktan pristup sa početnog ekrana. Brži pristup i rad bez interneta.'
              : 'Install the app to access GigZone directly from your home screen. Get faster access and offline capabilities.'}
          </p>

          <div className="flex gap-3 w-full px-6">
            <Button onClick={handleDismiss} variant="outline" className="flex-1 bg-white/95 hover:bg-white text-orange-600 border-2 border-white font-semibold py-6 text-base">
              {sr ? 'Preskoči' : 'Skip'}
            </Button>
            <Button onClick={handleInstall} className="flex-1 bg-white hover:bg-white/90 text-orange-600 font-bold text-base py-6 shadow-lg">
              {sr ? 'Instaliraj' : 'Install'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
