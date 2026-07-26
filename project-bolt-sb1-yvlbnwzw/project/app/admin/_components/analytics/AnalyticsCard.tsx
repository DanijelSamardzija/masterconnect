'use client';

import { useState } from 'react';
import { Info, LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  value: number | string;
  label: string;
  color: string;
  tooltip?: string;
}

export function AnalyticsCard({ icon: Icon, value, label, color, tooltip }: Props) {
  const [tipOpen, setTipOpen] = useState(false);

  return (
    <div
      className="relative group bg-card border border-border rounded-2xl p-4 flex flex-col gap-2"
      onMouseLeave={() => setTipOpen(false)}
    >
      <div className="flex items-center justify-between">
        <Icon className={`h-5 w-5 ${color}`} />
        {tooltip && (
          <button
            type="button"
            onClick={() => setTipOpen(v => !v)}
            className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            aria-label="Više informacija"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {tooltip && (
        <div
          className={`pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-20 px-3 py-1.5 bg-popover border border-border text-xs text-foreground rounded-xl shadow-lg text-center transition-opacity max-w-52 ${
            tipOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}
