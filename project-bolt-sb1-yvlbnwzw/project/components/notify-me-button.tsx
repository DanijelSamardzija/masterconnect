'use client';

import { useState } from 'react';
import { Bell, BellOff, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

type Props = {
  category: string;
  city: string;
};

export function NotifyMeButton({ category, city }: Props) {
  const { user, profile } = useAuth();
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async (emailToUse: string) => {
    setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      }

      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: emailToUse,
          category: category || null,
          city: city || null,
          language,
        }),
      });

      if (!res.ok) throw new Error('Failed');

      setSubscribed(true);
      setOpen(false);
      toast.success(t('notify.success'));
    } catch {
      toast.error(t('notify.error'));
    } finally {
      setLoading(false);
    }
  };

  const onClick = () => {
    if (user && profile?.email) {
      handleSubscribe(profile.email);
    } else if (user) {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user?.email) handleSubscribe(data.user.email);
        else setOpen(true);
      });
    } else {
      setOpen(true);
    }
  };

  const filterLabel = [category, city].filter(Boolean).join(', ');

  if (subscribed) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-green-100 text-green-700">
        <Check className="h-3 w-3" />
        {t('notify.active')}
      </span>
    );
  }

  return (
    <>
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors border border-orange-200"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
        {t('notify.button')}
        {filterLabel && <span className="text-orange-400">· {filterLabel}</span>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-500" />
              {t('notify.dialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('notify.dialog.desc')}
              {filterLabel && <span className="block mt-1 font-medium text-foreground">{filterLabel}</span>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>{t('notify.dialog.email')}</Label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && email.includes('@') && handleSubscribe(email)}
                className="mt-1"
              />
            </div>
            <Button
              onClick={() => handleSubscribe(email)}
              disabled={!email.includes('@') || loading}
              className="w-full bg-orange-600 hover:bg-orange-500"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
              {t('notify.dialog.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
