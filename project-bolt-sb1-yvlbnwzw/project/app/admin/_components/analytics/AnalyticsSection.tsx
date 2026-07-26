import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface Props {
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

export function AnalyticsSection({ icon: Icon, iconColor = 'text-orange-500', title, action, children }: Props) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <h3 className="font-semibold text-sm text-foreground">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
