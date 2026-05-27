'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { BookOpen, X, ChevronRight } from 'lucide-react';

export function OnboardingModal() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const key = `onboarding_done_${profile.id}`;
    if (!localStorage.getItem(key) || !profile.city) {
      setOpen(true);
    }
  }, [profile]);

  const handleClose = () => {
    if (!profile) return;
    localStorage.setItem(`onboarding_done_${profile.id}`, '1');
    setOpen(false);
  };

  const missingCity = !profile?.city;

  const handleGuide = () => {
    handleClose();
    router.push(missingCity ? '/profile/edit' : '/help');
  };

  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-8 text-center relative">
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-white/20 rounded-2xl">
              <BookOpen className="h-12 w-12 text-white" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white">
            {missingCity ? t('onboarding.missingCityTitle') : t('onboarding.welcome')}
          </h2>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-muted-foreground text-center leading-relaxed">
            {missingCity ? t('onboarding.missingCityPrompt') : t('onboarding.guidePrompt')}
          </p>

          <div className="space-y-2">
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-11"
              onClick={handleGuide}
            >
              {missingCity ? t('onboarding.missingCityAction') : t('onboarding.guideAction')}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <Button
              variant="ghost"
              className="w-full rounded-xl h-11 text-muted-foreground"
              onClick={handleClose}
            >
              {t('onboarding.guideLater')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
