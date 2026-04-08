'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';

type DeleteAccountModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteAccountModal({ open, onOpenChange }: DeleteAccountModalProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (confirmText.trim() !== 'DELETE') {
      setError('Please type DELETE to confirm');
      return;
    }

    if (!user) {
      setError('You must be logged in to delete your account');
      return;
    }

    setDeleting(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ confirmText }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to delete account');
      }

      await signOut();
      router.push('/account-deleted');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      setError(error.message || 'Failed to delete account');
      setDeleting(false);
    }
  };

  const handleClose = () => {
    if (!deleting) {
      setConfirmText('');
      setError('');
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md max-h-[75vh] flex flex-col p-4">
        <AlertDialogHeader className="flex-shrink-0 space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
            </div>
            <AlertDialogTitle className="text-base">Delete Account</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-xs">
            <p className="font-medium text-foreground">
              This action cannot be undone. This will permanently delete your account.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2.5 py-2 overflow-y-auto flex-1">
          <div className="space-y-1 text-xs">
            <p className="font-medium text-foreground">What will be deleted:</p>
            <ul className="list-disc list-inside space-y-0 text-muted-foreground pl-2 text-[11px]">
              <li>Profile, avatar, and cover image</li>
              <li>All posts, comments, and reactions</li>
              <li>All messages and conversations</li>
              <li>Notifications and blocked users</li>
              <li>Jobs posted or applied to</li>
            </ul>
          </div>

          <Alert variant="destructive" className="py-1.5">
            <AlertTriangle className="h-3 w-3" />
            <AlertDescription className="text-[11px]">
              <strong>Warning:</strong> This action is permanent.
            </AlertDescription>
          </Alert>

          <div className="space-y-1">
            <Label htmlFor="confirm-text" className="text-[11px] font-medium">
              Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
            </Label>
            <Input
              id="confirm-text"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value);
                setError('');
              }}
              placeholder="Type DELETE here"
              disabled={deleting}
              className={`font-mono text-sm h-8 ${
                confirmText && confirmText.trim() !== 'DELETE'
                  ? 'border-red-500'
                  : confirmText.trim() === 'DELETE'
                  ? 'border-green-500'
                  : ''
              }`}
              autoComplete="off"
            />
            {confirmText.trim() === 'DELETE' && (
              <p className="text-[11px] text-green-600 flex items-center gap-1">
                ✓ Confirmed
              </p>
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="py-1.5">
              <AlertDescription className="text-[11px]">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <AlertDialogFooter className="flex-shrink-0 gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={deleting}
            className="text-xs h-8"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting || confirmText.trim() !== 'DELETE'}
            className="text-xs h-8"
          >
            {deleting ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Account'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
