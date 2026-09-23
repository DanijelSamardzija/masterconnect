'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

function TimeUnit({
  value,
  options,
  onChange,
  cols = 4,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  cols?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-sm font-mono font-medium hover:bg-accent transition-colors"
      >
        {value}
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="absolute z-50 bottom-full mb-1 bg-card border border-border rounded-xl shadow-lg p-1.5"
          style={{ minWidth: `${cols * 2.5}rem` }}
        >
          <div className={`grid gap-0.5`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`py-1 rounded text-xs font-mono font-medium transition-colors ${
                  value === opt
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TimePicker24h({ value, onChange, className = '' }: Props) {
  const [hh, mm] = (value || '00:00').split(':');
  const hour = (hh ?? '00').padStart(2, '0');
  const min = (mm ?? '00').slice(0, 2).padStart(2, '0');

  return (
    <div className={`inline-flex items-center ${className}`}>
      <TimeUnit value={hour} options={HOURS} onChange={(h) => onChange(`${h}:${min}`)} cols={4} />
      <span className="select-none text-sm font-mono text-muted-foreground mx-0.5">:</span>
      <TimeUnit value={min} options={MINUTES} onChange={(m) => onChange(`${hour}:${m}`)} cols={4} />
    </div>
  );
}
