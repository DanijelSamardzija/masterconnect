'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

type BlockUserModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  onBlockSuccess?: () => void;
};

export function BlockUserModal({
  open,
  onOpenChange,
  userId,
  userName,
  onBlockSuccess,
}: BlockUserModalProps) {
  const { t } = useLanguage();
  const [blocking, setBlocking] = useState(false);

  const handleBlock = async () => {
    setBlocking(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error(t('block.failed'));
        setBlocking(false);
        return;
      }

      const response = await fetch('/api/block', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ blockedUserId: userId })
      });

      if (response.status === 409) {
        toast.error(t('block.alreadyBlocked'));
        onOpenChange(false);
        return;
      }

      if (response.ok) {
        toast.success(t('block.blocked'));
        onOpenChange(false);
        if (onBlockSuccess) onBlockSuccess();
      } else {
        const { error } = await response.json();
        toast.error(error || t('block.failed'));
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error(t('block.failed'));
    } finally {
      setBlocking(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('block.blockUserTitle').replace('{name}', userName)}</AlertDialogTitle>
          <AlertDialogDescription>{t('block.blockUserDesc')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={blocking}>{t('block.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleBlock}
            disabled={blocking}
            className="bg-red-600 hover:bg-red-700"
          >
            {blocking ? t('block.blocking') : t('block.block')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
