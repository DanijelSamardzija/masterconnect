'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type GigSelectOption = { value: string; label: string };

type GigSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: GigSelectOption[];
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
  placeholder?: string;
};

export function GigSelect({
  value,
  onChange,
  options,
  disabled,
  className,
  size = 'md',
  placeholder,
}: GigSelectProps) {
  const sm = size === 'sm';

  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        className={cn(
          'inline-flex items-center justify-between gap-1 rounded-md border border-border bg-card text-foreground',
          'transition-colors cursor-pointer',
          'hover:border-primary/60',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary',
          'data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/30',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          '[&>span]:line-clamp-1',
          sm ? 'text-xs px-1.5 py-0.5' : 'text-sm px-3 py-2 h-10 w-full',
          className
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder}>
          {options.find(o => o.value === value)?.label ?? placeholder}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className={cn('opacity-50 shrink-0', sm ? 'h-3 w-3' : 'h-4 w-4')} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'z-50 overflow-hidden rounded-md border border-border bg-card text-foreground shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
            'data-[side=bottom]:translate-y-1 min-w-[var(--radix-select-trigger-width)] max-h-72'
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  'relative flex w-full cursor-default select-none items-center rounded-sm outline-none',
                  'transition-colors',
                  'focus:bg-primary/10 focus:text-primary dark:focus:bg-primary/20',
                  'data-[state=checked]:text-primary data-[state=checked]:font-medium',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                  sm ? 'text-xs py-1 pl-6 pr-2' : 'text-sm py-1.5 pl-8 pr-2'
                )}
              >
                <span className={cn(
                  'absolute flex items-center justify-center',
                  sm ? 'left-1 h-3 w-3' : 'left-2 h-3.5 w-3.5'
                )}>
                  <SelectPrimitive.ItemIndicator>
                    <Check className={cn('text-primary', sm ? 'h-3 w-3' : 'h-4 w-4')} />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
