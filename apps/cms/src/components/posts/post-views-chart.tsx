import { useId } from 'react';
import { Area, AreaChart } from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

const config = { views: { label: 'Views', color: 'var(--chart-1)' } } satisfies ChartConfig;

/** Last 30 days of page views for one post, oldest first. */
export function PostViewsChart({
  series,
  showTotal = false,
}: {
  series: number[];
  /** The 30-day total beside the chart; the compact row leaves it to the tooltip. */
  showTotal?: boolean;
}) {
  const fillId = useId();
  const data = series.map((views, i) => ({ day: series.length - 1 - i, views }));
  const total = series.reduce((sum, n) => sum + n, 0);
  return (
    <span className="flex shrink-0 items-center gap-2" title="Page views, last 30 days">
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
        <span className="text-muted-foreground w-12 text-right text-xs tabular-nums">
          {total.toLocaleString('en-AU')}
          <span className="block text-[0.6875rem]">views</span>
        </span>
      )}
    </span>
  );
}
