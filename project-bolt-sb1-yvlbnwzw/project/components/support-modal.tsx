'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Coins, Sparkles, Crown, Zap, X, Clock } from 'lucide-react';

interface SupportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupportModal({ open, onOpenChange }: SupportModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 shadow-2xl">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 p-6 text-white">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-transparent" />
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative flex items-center gap-3 mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg">
              <Coins className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-orange-100 uppercase tracking-widest">GigZone</p>
              <h2 className="text-2xl font-bold leading-tight">Krediti</h2>
            </div>
          </div>
          <div className="relative inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold">
            <Clock className="h-3 w-3" />
            Dolazi uskoro
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 bg-card">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Uskoro ćete moći koristiti <strong className="text-foreground">GigZone Kredite</strong> — virtualnu valutu platforme za nagrađivanje kvalitetnih profesionalaca i sadržaja.
          </p>

          <div className="space-y-3">
            {[
              {
                icon: <Sparkles className="h-4 w-4 text-orange-500" />,
                title: 'Podržite profesionalce',
                desc: 'Pošaljite kredite majstorima čiji vam je rad impresionirao — direktno s feeda.',
              },
              {
                icon: <Zap className="h-4 w-4 text-amber-500" />,
                title: 'Istaknite oglas',
                desc: 'Koristite kredite da se vaš oglas pojavi na vrhu pretrage i u sponzorisanim spotovima.',
              },
              {
                icon: <Crown className="h-4 w-4 text-yellow-500" />,
                title: 'Premium nalog',
                desc: 'Pretplatite se na Premium od 4,99 €/mj i dobijte bonus kredite svaki mjesec.',
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm">
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => onOpenChange(false)}
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-2.5 text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            Razumijem, čekam!
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
