'use client';

import { Bell, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  target: { id: string; name: string } | null;
  title: string;
  body: string;
  link: string;
  sending: boolean;
  onClose: () => void;
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onLinkChange: (v: string) => void;
  onSend: () => void;
}

export function SendNotifModal({
  target,
  title,
  body,
  link,
  sending,
  onClose,
  onTitleChange,
  onBodyChange,
  onLinkChange,
  onSend,
}: Props) {
  if (!target) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-500" />
            Pošalji notifikaciju
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Korisnik: <strong className="text-foreground">{target.name}</strong>
        </p>
        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={e => onTitleChange(e.target.value)}
            placeholder="Naslov notifikacije..."
            className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition-colors"
          />
          <textarea
            value={body}
            onChange={e => onBodyChange(e.target.value)}
            placeholder="Tekst notifikacije..."
            rows={3}
            className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition-colors resize-none"
          />
          <input
            type="text"
            value={link}
            onChange={e => onLinkChange(e.target.value)}
            placeholder="Link (npr. /services)"
            className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition-colors"
          />
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Otkaži
          </Button>
          <Button
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
            onClick={onSend}
            disabled={sending || !title.trim() || !body.trim()}
          >
            {sending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Slanje...</>
            ) : (
              <><Bell className="h-4 w-4 mr-2" />Pošalji</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
