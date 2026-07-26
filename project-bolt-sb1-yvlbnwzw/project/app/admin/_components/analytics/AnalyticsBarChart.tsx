export interface BarChartItem {
  key: string;
  label?: string;
  tooltip: string;
  count: number;
  minHeightPct?: number;
}

interface Props {
  data: BarChartItem[];
  color?: string;
  barHeightPx?: number;
  gap?: string;
  showLabels?: boolean;
}

export function AnalyticsBarChart({
  data,
  color = 'bg-orange-500',
  barHeightPx = 90,
  gap = 'gap-1',
  showLabels = true,
}: Props) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  return (
    <div className={`flex items-end ${gap}`} style={{ height: `${barHeightPx + (showLabels ? 20 : 8)}px` }}>
      {data.map(({ key, label, tooltip, count, minHeightPct = 2 }) => {
        const heightPct = Math.max((count / maxCount) * 100, count > 0 ? minHeightPct : 0);
        return (
          <div key={key} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] rounded px-1 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {tooltip}
            </div>
            <div
              className="w-full bg-muted rounded-t-lg overflow-hidden flex items-end"
              style={{ height: `${barHeightPx}px` }}
            >
              <div
                className={`w-full ${color} rounded-t-lg transition-all`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
            {showLabels && label && (
              <span className="text-[9px] text-muted-foreground text-center leading-tight">{label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
