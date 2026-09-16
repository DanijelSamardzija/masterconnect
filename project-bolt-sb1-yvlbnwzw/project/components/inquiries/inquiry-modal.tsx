'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Zap, CreditCard } from 'lucide-react';
import type { InquirySubjectMeta } from '@/lib/inquiries/types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectMeta: InquirySubjectMeta;
  // onSubmit handles create + any module-specific logic; returns ok flag
  onSubmit: (message: string) => Promise<{ ok: boolean }>;
};

const MIN_LENGTH = 10;

export function InquiryModal({ open, onOpenChange, subjectMeta, onSubmit }: Props) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = message.trim().length >= MIN_LENGTH;

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    const result = await onSubmit(message.trim());
    setLoading(false);
    if (result.ok) {
      setMessage('');
      onOpenChange(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!loading) onOpenChange(v); }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4" style={{ color: 'var(--adult-accent-2)' }} aria-hidden />
            Send Inquiry
          </DialogTitle>
        </DialogHeader>

        {/* Subject snapshot */}
        <div
          className="rounded-xl p-3"
          style={{ background: 'var(--adult-surface)', border: '1px solid var(--adult-border)' }}
          aria-label="Service you are inquiring about"
        >
          <p className="text-sm font-semibold text-foreground leading-tight">{subjectMeta.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {subjectMeta.category != null && (
              <span className="text-[11px] text-muted-foreground">{String(subjectMeta.category)}</span>
            )}
          </div>
        </div>

        {/* Payment notice — shown only if price exists in snapshot */}
        {typeof subjectMeta.price === 'number' && subjectMeta.price > 0 && (
          <div
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}
            role="note"
            aria-label={`${subjectMeta.price} credits will be charged when the creator accepts`}
          >
            <CreditCard className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
            <span className="text-[12px] text-emerald-600 dark:text-emerald-400 leading-snug">
              <strong>{subjectMeta.price} credits</strong> charged when creator accepts.
              Sending this inquiry is free.
            </span>
          </div>
        )}

        <div>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you're looking for, your timeline, any specific requirements…"
            className="min-h-[110px] text-sm resize-none"
            maxLength={1000}
            aria-label="Inquiry message"
            aria-describedby="inquiry-char-count"
            disabled={loading}
          />
          <p
            id="inquiry-char-count"
            className="text-[11px] text-muted-foreground text-right mt-1"
            aria-live="polite"
          >
            {message.length}/1000{message.trim().length < MIN_LENGTH && message.length > 0
              ? ` — ${MIN_LENGTH - message.trim().length} more characters needed`
              : ''}
          </p>
        </div>

        <Button
          className="w-full btn-adult-gradient"
          onClick={handleSubmit}
          disabled={!canSubmit || loading}
          aria-busy={loading}
        >
          {loading ? 'Sending…' : 'Send Inquiry'}
        </Button>

        <p className="text-[11px] text-center text-muted-foreground/80">
          Creator will be notified and has 48 hours to respond. Press Ctrl+Enter to send.
        </p>
      </DialogContent>
    </Dialog>
  );
}
