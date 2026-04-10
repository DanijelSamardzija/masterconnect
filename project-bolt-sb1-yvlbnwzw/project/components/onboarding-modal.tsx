'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import {
  UserCircle, Briefcase, MessageSquare, Search,
  Rss, Star, ChevronRight, X
} from 'lucide-react';

export function OnboardingModal() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const key = `onboarding_done_${profile.id}`;
    if (!localStorage.getItem(key)) {
      setOpen(true);
    }
  }, [profile]);

  const handleClose = () => {
    if (!profile) return;
    localStorage.setItem(`onboarding_done_${profile.id}`, '1');
    setOpen(false);
  };

  const handleAction = (path: string) => {
    handleClose();
    router.push(path);
  };

  if (!profile) return null;

  const isPro = profile.account_type === 'professional';

  const proSteps = [
    {
      icon: <UserCircle className="h-12 w-12 text-orange-500" />,
      title: t('onboarding.welcome'),
      desc: t('onboarding.proDesc'),
    },
    {
      icon: <Briefcase className="h-12 w-12 text-blue-500" />,
      title: t('onboarding.proStep2Title'),
      desc: t('onboarding.proStep2Desc'),
      action: { label: t('onboarding.proStep2Action'), path: `/profile/${profile.id}` },
    },
    {
      icon: <Search className="h-12 w-12 text-purple-500" />,
      title: t('onboarding.proStep3Title'),
      desc: t('onboarding.proStep3Desc'),
      action: { label: t('onboarding.proStep3Action'), path: '/jobs' },
    },
  ];

  const customerSteps = [
    {
      icon: <Star className="h-12 w-12 text-orange-500" />,
      title: t('onboarding.welcome'),
      desc: t('onboarding.customerDesc'),
    },
    {
      icon: <Briefcase className="h-12 w-12 text-blue-500" />,
      title: t('onboarding.customerStep2Title'),
      desc: t('onboarding.customerStep2Desc'),
      action: { label: t('onboarding.customerStep2Action'), path: '/jobs' },
    },
    {
      icon: <Search className="h-12 w-12 text-green-500" />,
      title: t('onboarding.customerStep3Title'),
      desc: t('onboarding.customerStep3Desc'),
      action: { label: t('onboarding.customerStep3Action'), path: '/services' },
    },
  ];

  const steps = isPro ? proSteps : customerSteps;
  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-8 text-center relative">
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-white/20 rounded-2xl">
              {current.icon}
            </div>
          </div>
          <h2 className="text-xl font-bold text-white">{current.title}</h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-muted-foreground text-center leading-relaxed">
            {current.desc}
          </p>

          {/* Step dots */}
          <div className="flex justify-center gap-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === step ? 'w-6 bg-orange-500' : 'w-2 bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="space-y-2">
            {current.action && (
              <Button
                className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-11"
                onClick={() => handleAction(current.action!.path)}
              >
                {current.action.label}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            <Button
              variant={current.action ? 'ghost' : 'default'}
              className={`w-full rounded-xl h-11 ${!current.action ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`}
              onClick={() => {
                if (isLast) handleClose();
                else setStep(s => s + 1);
              }}
            >
              {isLast ? t('onboarding.done') : t('onboarding.next')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
