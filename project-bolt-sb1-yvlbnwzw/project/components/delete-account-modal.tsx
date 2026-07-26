'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, ArrowRight, X } from 'lucide-react';

const CHURN_REASONS = [
  { key: 'nisam_nasao_posao',         label: 'Nisam pronašao posao' },
  { key: 'nema_oglasa',                label: 'Nema dovoljno oglasa' },
  { key: 'nema_korisnika',            label: 'Nema dovoljno korisnika' },
  { key: 'novi_nalog',                 label: 'Napravio sam novi nalog' },
  { key: 'presao_na_drugu_platformu', label: 'Prešao sam na drugu platformu' },
  { key: 'privremeno_odlazim',        label: 'Privremeno odlazim' },
  { key: 'komplikovana_aplikacija',   label: 'Aplikacija mi je komplikovana' },
  { key: 'tehnicki_problem',          label: 'Naišao sam na tehnički problem' },
  { key: 'privatnost',                 label: 'Zabrinutost za privatnost' },
  { key: 'ostalo',                     label: 'Drugo' },
] as const;

type ReasonKey = typeof CHURN_REASONS[number]['key'];

type DeleteAccountModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteAccountModal({ open, onOpenChange }: DeleteAccountModalProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [step,           setStep]          = useState<'reason' | 'confirm'>('reason');
  const [selectedReason, setSelectedReason]= useState<ReasonKey | null>(null);
  const [customComment,  setCustomComment] = useState('');
  const [confirmText,    setConfirmText]   = useState('');
  const [deleting,       setDeleting]      = useState(false);
  const [error,          setError]         = useState('');

  const handleDelete = async () => {
    if (confirmText.trim() !== 'DELETE') {
      setError('Upiši DELETE za potvrdu');
      return;
    }
    if (!user) {
      setError('Moraš biti prijavljen da obrišeš nalog');
      return;
    }
    setDeleting(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Nisi prijavljen');

      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          confirmText,
          reason:  selectedReason ?? undefined,
          comment: selectedReason === 'ostalo' ? (customComment || undefined) : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Brisanje nije uspjelo');

      await signOut();
      router.push('/account-deleted');
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setError(err.message || 'Brisanje nije uspjelo');
      setDeleting(false);
    }
  };

  const handleClose = () => {
    if (deleting) return;
    setStep('reason');
    setSelectedReason(null);
    setCustomComment('');
    setConfirmText('');
    setError('');
    onOpenChange(false);
  };

  const selectedLabel = CHURN_REASONS.find(r => r.key === selectedReason)?.label;

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md max-h-[82vh] flex flex-col p-4">

        {/* ── Step 1: Reason ─────────────────────────────────────────────── */}
        {step === 'reason' && (
          <>
            <AlertDialogHeader className="flex-shrink-0 space-y-1">
              <AlertDialogTitle className="text-base">Žao nam je što odlaziš</AlertDialogTitle>
              <p className="text-xs text-muted-foreground">
                Možeš li nam reći zašto? Tvoj odgovor nam pomaže da poboljšamo platformu. (opcionalno)
              </p>
            </AlertDialogHeader>

            <div className="overflow-y-auto flex-1 py-2">
              <div className="grid grid-cols-2 gap-2">
                {CHURN_REASONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedReason(prev => prev === key ? null : key)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-colors border ${
                      selectedReason === key
                        ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400'
                        : 'bg-muted border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {selectedReason === 'ostalo' && (
                <textarea
                  value={customComment}
                  onChange={e => setCustomComment(e.target.value)}
                  placeholder="Opiši razlog... (opcionalno)"
                  rows={3}
                  maxLength={500}
                  className="mt-3 w-full text-xs bg-muted border border-border rounded-xl p-3 outline-none focus:border-orange-500/50 transition-colors resize-none"
                />
              )}
            </div>

            <AlertDialogFooter className="flex-shrink-0 gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={handleClose} className="text-xs h-8">
                Odustani
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStep('confirm')}
                className="text-xs h-8 text-muted-foreground"
              >
                Preskoči
              </Button>
              {selectedReason && (
                <Button
                  onClick={() => setStep('confirm')}
                  className="text-xs h-8 bg-red-500 hover:bg-red-600 text-white gap-1"
                >
                  Nastavi <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </AlertDialogFooter>
          </>
        )}

        {/* ── Step 2: Confirmation ───────────────────────────────────────── */}
        {step === 'confirm' && (
          <>
            <AlertDialogHeader className="flex-shrink-0 space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                </div>
                <AlertDialogTitle className="text-base">Obriši nalog</AlertDialogTitle>
              </div>
              <p className="text-xs font-medium text-foreground">
                Ova akcija je permanentna i ne može se poništiti.
              </p>
            </AlertDialogHeader>

            <div className="space-y-3 py-2 overflow-y-auto flex-1">
              {selectedLabel && (
                <div className="flex items-center gap-2 text-xs bg-muted rounded-xl px-3 py-2">
                  <span className="text-muted-foreground font-medium shrink-0">Razlog:</span>
                  <span className="text-foreground flex-1">{selectedLabel}</span>
                  <button
                    onClick={() => { setSelectedReason(null); setStep('reason'); }}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              <div className="space-y-1 text-xs">
                <p className="font-medium text-foreground">Što će biti obrisano:</p>
                <ul className="list-disc list-inside space-y-0 text-muted-foreground pl-2 text-[11px]">
                  <li>Profil, avatar i naslovna slika</li>
                  <li>Sve objave, komentari i reakcije</li>
                  <li>Sve poruke i razgovori</li>
                  <li>Notifikacije i blokirani korisnici</li>
                  <li>Postavljeni i prijavljeni poslovi</li>
                </ul>
              </div>

              <Alert variant="destructive" className="py-1.5">
                <AlertTriangle className="h-3 w-3" />
                <AlertDescription className="text-[11px]">
                  <strong>Upozorenje:</strong> Ova akcija je trajna i ne može se poništiti.
                </AlertDescription>
              </Alert>

              <div className="space-y-1">
                <Label htmlFor="confirm-text" className="text-[11px] font-medium">
                  Upiši <span className="font-mono font-bold text-red-600">DELETE</span> za potvrdu
                </Label>
                <Input
                  id="confirm-text"
                  value={confirmText}
                  onChange={e => { setConfirmText(e.target.value); setError(''); }}
                  placeholder="Upiši DELETE ovdje"
                  disabled={deleting}
                  className={`font-mono text-sm h-8 ${
                    confirmText && confirmText.trim() !== 'DELETE' ? 'border-red-500'
                    : confirmText.trim() === 'DELETE'             ? 'border-green-500'
                    : ''
                  }`}
                  autoComplete="off"
                />
                {confirmText.trim() === 'DELETE' && (
                  <p className="text-[11px] text-green-600 flex items-center gap-1">✓ Potvrđeno</p>
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
                variant="ghost"
                onClick={() => setStep('reason')}
                disabled={deleting}
                className="text-xs h-8 mr-auto"
              >
                ← Nazad
              </Button>
              <Button variant="outline" onClick={handleClose} disabled={deleting} className="text-xs h-8">
                Odustani
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting || confirmText.trim() !== 'DELETE'}
                className="text-xs h-8"
              >
                {deleting ? (
                  <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Briše se...</>
                ) : (
                  'Obriši nalog'
                )}
              </Button>
            </AlertDialogFooter>
          </>
        )}

      </AlertDialogContent>
    </AlertDialog>
  );
}
