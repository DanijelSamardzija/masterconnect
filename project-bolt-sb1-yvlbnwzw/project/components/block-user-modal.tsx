'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
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
  const [blocking, setBlocking] = useState(false);

  const handleBlock = async () => {
    setBlocking(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error('Please sign in to block users');
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
        body: JSON.stringify({
          blockedUserId: userId
        })
      });

      if (response.status === 409) {
        toast.error('User already blocked');
        onOpenChange(false);
        return;
      }

      if (response.ok) {
        toast.success('User blocked');
        onOpenChange(false);
        if (onBlockSuccess) {
          onBlockSuccess();
        }
      } else {
        const { error } = await response.json();
        toast.error(error || 'Failed to block user');
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user');
    } finally {
      setBlocking(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Block {userName}?</AlertDialogTitle>
          <AlertDialogDescription>
            You won't see their posts or comments and they can't message you.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={blocking}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleBlock}
            disabled={blocking}
            className="bg-red-600 hover:bg-red-700"
          >
            {blocking ? 'Blocking...' : 'Block'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
