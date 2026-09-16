'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, Zap } from 'lucide-react';
import { acceptInquiry, declineInquiry } from '@/lib/inquiries/actions';
import { toast } from 'sonner';
import type { Inquiry, InquiryStatus } from '@/lib/inquiries/types';

export const INQUIRY_STATUS_CONFIG: Record<InquiryStatus, { label: string; classes: string }> = {
  pending:   { label: 'Pending',   classes: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
  accepted:  { label: 'Accepted',  classes: 'bg-green-500/10 text-green-500 border-green-500/30' },
  declined:  { label: 'Declined',  classes: 'bg-red-500/10 text-red-500 border-red-500/30' },
  expired:   { label: 'Expired',   classes: 'bg-muted/50 text-muted-foreground border-muted' },
  completed: { label: 'Completed', classes: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  cancelled: { label: 'Cancelled', classes: 'bg-muted/50 text-muted-foreground border-muted' },
};

type Props = {
  inquiry: Inquiry;
  currentUserId: string;
  onStatusChange?: () => void;
  className?: string;
};

export function InquiryCard({ inquiry, currentUserId, onStatusChange, className }: Props) {
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);

  const isReceiver = currentUserId === inquiry.receiverId;
  const isPending  = inquiry.status === 'pending';
  const status     = INQUIRY_STATUS_CONFIG[inquiry.status] ?? INQUIRY_STATUS_CONFIG.pending;
  const meta       = inquiry.subjectMeta;

  const handle = async (action: 'accept' | 'decline') => {
    setBusy(action);
    const result = action === 'accept'
      ? await acceptInquiry(inquiry.id)
      : await declineInquiry(inquiry.id);
    setBusy(null);

    if (!result.ok) {
      if (result.error === 'insufficient_balance') {
        toast.error('Client has insufficient credits. The inquiry will remain pending.');
      } else if (result.error === 'not_pending') {
        toast.error('This inquiry was already responded to.');
      } else {
        toast.error('Action failed — please try again.');
      }
      return;
    }

    toast.success(action === 'accept' ? 'Inquiry accepted! Credits transferred.' : 'Inquiry declined.');
    onStatusChange?.();
  };

  return (
    <Card
      className={`${className ?? ''}`}
      style={{ border: '1.5px solid var(--adult-border)', background: 'rgba(139,30,63,0.04)' }}
    >
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Zap className="h-3 w-3" style={{ color: 'var(--adult-accent-2)' }} aria-hidden />
            Service Inquiry
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] px-2 py-0 h-5 ${status.classes}`}
            aria-label={`Status: ${status.label}`}
          >
            {status.label}
          </Badge>
        </div>

        {/* Subject snapshot */}
        <div
          className="rounded-xl p-3 mb-3"
          style={{ background: 'var(--adult-surface)', border: '1px solid var(--adult-border)' }}
          aria-label="Requested service"
        >
          <p className="text-sm font-semibold text-foreground leading-tight">{meta.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {meta.category != null && (
              <span className="text-[11px] text-muted-foreground">{String(meta.category)}</span>
            )}
            {meta.price != null && (
              <span className="text-[11px] font-bold" style={{ color: 'var(--adult-accent-2)' }}>
                {String(meta.price)} cr
                {meta.priceType === 'hourly' ? '/hr' : meta.priceType === 'starting_from' ? '+' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Message */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-4 italic">
          &ldquo;{inquiry.message}&rdquo;
        </p>

        {/* Accept / Decline — receiver only, pending only */}
        {isReceiver && isPending && (
          <div className="flex gap-2" role="group" aria-label="Respond to inquiry">
            <Button
              size="sm"
              className="flex-1 gap-1.5 btn-adult-gradient"
              onClick={() => handle('accept')}
              disabled={busy !== null}
              aria-busy={busy === 'accept'}
            >
              <CheckCircle className="h-3.5 w-3.5" aria-hidden />
              {busy === 'accept' ? 'Accepting…' : 'Accept'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-1.5"
              onClick={() => handle('decline')}
              disabled={busy !== null}
              aria-busy={busy === 'decline'}
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden />
              {busy === 'decline' ? 'Declining…' : 'Decline'}
            </Button>
          </div>
        )}

        {isPending && (
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground/80 mt-2" aria-live="polite">
            <Clock className="h-2.5 w-2.5" aria-hidden />
            Expires in 48 hours
          </p>
        )}
      </CardContent>
    </Card>
  );
}
