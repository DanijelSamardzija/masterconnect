'use client';

import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/contexts/language-context';

type Props = {
  open: boolean;
  onClose: () => void;
  variant?: 'action' | 'auto';
};

export function GuestSignupModal({ open, onClose, variant = 'action' }: Props) {
  const router = useRouter();
  const { t } = useLanguage();

  const title = variant === 'auto' ? t('home.autoPopup.title') : t('home.popup.title');
  const desc = variant === 'auto' ? t('home.autoPopup.desc') : t('home.popup.desc');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm w-full p-0 overflow-hidden rounded-2xl">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 text-center text-white">
          <div className="text-4xl mb-3">🔥</div>
          <h2 className="text-xl font-black leading-tight">{title}</h2>
        </div>
        <div className="p-6 text-center space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
          <div className="flex flex-col gap-2 pt-1">
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700 h-12 text-base font-semibold rounded-xl"
              onClick={() => { onClose(); router.push('/login?tab=register'); }}
            >
              {t('home.popup.cta')}
            </Button>
            <Button
              variant="ghost"
              className="w-full h-10 text-muted-foreground"
              onClick={() => { onClose(); router.push('/login'); }}
            >
              {t('home.popup.login')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
