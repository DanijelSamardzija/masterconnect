interface Props {
  label: string;
  count: number;
  maxCount: number;
  color?: string;
  suffix?: string;
}

export function AnalyticsBarRow({ label, count, maxCount, color = 'bg-orange-500', suffix = '' }: Props) {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{count}{suffix}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
