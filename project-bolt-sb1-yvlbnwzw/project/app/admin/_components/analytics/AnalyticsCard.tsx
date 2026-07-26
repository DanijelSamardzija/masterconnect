import { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  value: number | string;
  label: string;
  color: string;
}

export function AnalyticsCard({ icon: Icon, value, label, color }: Props) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
      <Icon className={`h-5 w-5 ${color}`} />
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
