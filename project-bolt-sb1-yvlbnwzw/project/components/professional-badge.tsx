import { ShieldCheck, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfessionalBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  variant?: 'pro' | 'premium';
}

export function ProfessionalBadge({ size = 'md', className, variant = 'pro' }: ProfessionalBadgeProps) {
  const sizeClasses = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
    lg: 'h-3.5 w-3.5'
  };

  if (variant === 'premium') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold shadow-sm',
          size === 'sm' && 'text-[9px]',
          size === 'md' && 'text-[10px]',
          size === 'lg' && 'text-xs',
          className
        )}
        title="PRO Premium"
      >
        <Crown className={sizeClasses[size]} />
        <span>Premium</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold shadow-sm',
        size === 'sm' && 'text-[9px]',
        size === 'md' && 'text-[10px]',
        size === 'lg' && 'text-xs',
        className
      )}
      title="Verified Professional"
    >
      <ShieldCheck className={sizeClasses[size]} />
      <span>PRO</span>
    </div>
  );
}
