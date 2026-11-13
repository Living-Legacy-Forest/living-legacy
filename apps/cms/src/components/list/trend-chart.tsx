import { useId } from 'react';
import { Area, AreaChart } from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

const colour = 'var(--chart-1)';

/** The last 30 days of one number (views, bookings), oldest first, as a small area chart. */
export function TrendChart({
  series,
  label = 'Views',
  showTotal = false,
}: {
  series: number[];
  /** What the numbers count, in the tooltip and under the total. */
  label?: string;
  /** The 30-day total beside the chart; the compact row leaves it to the tooltip. */
  showTotal?: boolean;
}) {
  const fillId = useId();
  const config = { views: { label, color: colour } } satisfies ChartConfig;
  const data = series.map((views, i) => ({ day: series.length - 1 - i, views }));
  const total = series.reduce((sum, n) => sum + n, 0);
  return (
    <span className="flex shrink-0 items-center gap-2" title={`${label}, last 30 days`}>
      <ChartContainer config={config} className="aspect-auto h-8 w-28">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-views)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-views)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideIndicator
                labelFormatter={(_, payload) => {
                  const ago = Number(payload?.[0]?.payload?.day ?? 0);
                  return ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : `${ago} days ago`;
                }}
              />
            }
          />
          <Area
            dataKey="views"
            type="monotone"
            stroke="var(--color-views)"
            strokeWidth={1.5}
            fill={`url(#${fillId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
      {showTotal && (
        <span className="text-muted-foreground hidden w-12 text-right text-xs tabular-nums lg:block">
          {total.toLocaleString('en-AU')}
          <span className="block text-[0.6875rem] lowercase">{label}</span>
        </span>
      )}
    </span>
  );
}
