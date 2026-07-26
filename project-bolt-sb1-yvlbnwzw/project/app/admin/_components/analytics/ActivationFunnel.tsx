'use client';

import { Lock } from 'lucide-react';
import type { FunnelStep } from '../types';

interface Props {
  steps: FunnelStep[];
}

export function ActivationFunnel({ steps }: Props) {
  const baseStep  = steps.find(s => s.available);
  const baseCount = baseStep?.count ?? 0;

  // Pre-compute display values in one pass so each bar is monotonically ≤ previous.
  // This prevents visual confusion if e.g. MAU temporarily exceeds usersWithPost.
  let prevPct = 100;
  const display = steps.map(step => {
    if (!step.available || baseCount === 0) {
      // Locked step OR no registered users yet — no bar, no percentage shown.
      return { pct: null as number | null, barWidth: 0 };
    }
    if (step.key === baseStep!.key) {
      // Base step is always 100 % and full bar, no percentage label needed.
      prevPct = 100;
      return { pct: null as number | null, barWidth: 100 };
    }
    const rawPct    = Math.round((step.count / baseCount) * 100);
    const cappedPct = Math.min(rawPct, prevPct);  // never exceed previous step
    prevPct         = cappedPct;
    const barWidth  = cappedPct > 0 ? Math.max(cappedPct, 1.5) : 0; // min visible sliver
    return { pct: cappedPct, barWidth };
  });

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const { pct, barWidth } = display[i];
        return (
          <div key={step.key} className="flex items-center gap-3">
            {/* Label */}
            <div className="w-32 shrink-0">
              <p className={`text-xs font-semibold leading-snug ${step.available ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                {step.label}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">{step.sublabel}</p>
            </div>

            {/* Bar */}
            <div className="flex-1 h-8 bg-muted rounded-xl overflow-hidden relative">
              {step.available ? (
                <div
                  className={`h-full ${step.color} rounded-xl transition-all duration-500`}
                  style={{ width: `${barWidth}%` }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center gap-1.5">
                  <Lock className="h-3 w-3 text-muted-foreground/40" />
                  <span className="text-[10px] text-muted-foreground/50">Dolazi uskoro</span>
                </div>
              )}
            </div>

            {/* Count + % of base */}
            <div className="w-24 text-right shrink-0">
              {step.available ? (
                baseCount === 0 ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <>
                    <span className="text-sm font-bold text-foreground tabular-nums">
                      {step.count.toLocaleString()}
                    </span>
                    {pct !== null && (
                      <span className="text-[10px] text-muted-foreground ml-1">({pct}%)</span>
                    )}
                  </>
                )
              ) : (
                <span className="text-xs text-muted-foreground/40">—</span>
              )}
            </div>
          </div>
        );
      })}

      <p className="text-[10px] text-muted-foreground text-right pt-0.5">
        % = udio u odnosu na registrovane korisnike (baza)
      </p>
    </div>
  );
}
