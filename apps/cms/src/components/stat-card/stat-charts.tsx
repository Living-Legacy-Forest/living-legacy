import { useId } from 'react';
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { formatInteger } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import { type Part, type Trend, dayMonth, sum, weekName, weekStart } from './shared';

// The chart library is loaded with these, after the card's figures are on screen.

/** Each week's count, or the running total at the end of each week when `total` is given. */
function trendData({ weeks, total, endsAt }: Trend, timeZone: string) {
  const name = (i: number) => weekName(i, weeks.length, endsAt, timeZone);
  const values = [...weeks];
  if (total) {
    // Walk back from today: each week ends at the total less what came after it.
    let running = total.value;
    for (let i = weeks.length - 1; i >= 0; i--) {
      values[i] = running;
      running -= weeks[i] ?? 0;
    }
  }
  return values.map((count, i) => ({ week: name(i), count }));
}

// Room for the hover dot and its ring, so a peak or a zero is never cut off.
const MARGIN = { top: 6, right: 5, bottom: 5, left: 5 };
// The hidden x-axis names each point, so the tooltip reads "Week of 3 Nov".
// The y-axis leaves a little air above the highest week.
const axes = (
  <>
    <XAxis dataKey="week" hide />
    <YAxis hide domain={[0, (max: number) => Math.max(max, 1) * 1.15]} />
  </>
);
const tooltipContent = <ChartTooltipContent indicator="line" />;
// A faint guide under the pointer: a line on the curves, a column on the bars.
const lineCursor = { stroke: 'var(--border)', strokeDasharray: '3 3' };
const barCursor = { fill: 'color-mix(in oklch, var(--muted-foreground) 10%, transparent)' };

const tint = (share: number) => `color-mix(in oklch, var(--color-count) ${share}%, transparent)`;
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The last twelve weeks as an area, bars or a dotted line. Hover for each week's figure. */
export function TrendChart({ color = 'var(--primary)', ...trend }: Trend & { color?: string }) {
  const gradient = useId();
  const timeZone = useTimeZone();
  const data = trendData(trend, timeZone);
  const label = sentence(trend.total?.label ?? trend.counted);
  const config = { count: { label, color } } satisfies ChartConfig;
  const description = !trend.total
    ? `${formatInteger(sum(trend.weeks))} ${trend.counted} in the last ${trend.weeks.length} weeks.`
    : `${formatInteger(sum(trend.weeks))} ${trend.counted} in the last ${trend.weeks.length} weeks, ${formatInteger(trend.total.value)} in all.`;

  const fill = (
    <defs>
      <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--color-count)" stopOpacity={0.3} />
        <stop offset="100%" stopColor="var(--color-count)" stopOpacity={0} />
      </linearGradient>
    </defs>
  );
  const activeDot = { r: 4, fill: 'var(--color-count)', stroke: 'var(--card)', strokeWidth: 2 };

  return (
    <div className="mt-3 flex h-24 flex-col">
      <ChartContainer config={config} className="aspect-auto min-h-0 w-full flex-1">
        {trend.kind === 'bar' ? (
          <BarChart
            data={data}
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
            barCategoryGap={3}
          >
            {axes}
            <ChartTooltip cursor={barCursor} content={tooltipContent} />
            <Bar dataKey="count" radius={4} minPointSize={3} isAnimationActive={false}>
              {/* This week in full; the weeks before sit back, and empty weeks barely show. */}
              {data.map((d, i) => (
                <Cell
                  key={d.week}
                  fill={
                    i === data.length - 1 ? 'var(--color-count)' : d.count > 0 ? tint(55) : tint(15)
                  }
                />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <AreaChart data={data} margin={MARGIN}>
            {fill}
            {axes}
            <ChartTooltip cursor={lineCursor} content={tooltipContent} />
            <Area
              dataKey="count"
              type="monotone"
              stroke="var(--color-count)"
              strokeWidth={2}
              fill={`url(#${gradient})`}
              fillOpacity={trend.kind === 'line' ? 0.6 : 1}
              // The line kind marks every week, so a running total reads as steps taken.
              dot={
                trend.kind === 'line'
                  ? { r: 2.5, fill: 'var(--card)', stroke: 'var(--color-count)', strokeWidth: 1.5 }
                  : false
              }
              activeDot={activeDot}
              isAnimationActive={false}
            />
          </AreaChart>
        )}
      </ChartContainer>
      {trend.endsAt !== undefined && (
        // Only the two ends: enough to say what span the chart covers.
        <div
          aria-hidden
          className="text-muted-foreground mt-1.5 flex justify-between text-[10px] leading-none tabular-nums"
        >
          <span>{dayMonth(weekStart(0, trend.weeks.length, trend.endsAt), timeZone)}</span>
          <span>This week</span>
        </div>
      )}
      <p className="sr-only">{description}</p>
    </div>
  );
}

/** A small donut of the parts, with a legend beside it. */
export function PartsChart({ parts }: { parts: Part[] }) {
  const shown = parts.filter((p) => p.value > 0);
  const config = Object.fromEntries(
    parts.map((p) => [p.key, { label: p.label, color: p.color }])
  ) satisfies ChartConfig;

  return (
    // The same height as the trend charts, so a row of cards lines up.
    <div className="mt-3 flex h-24 items-center gap-3 md:gap-4">
      {shown.length > 0 && (
        // Smaller in a phone's half-width card, so the legend keeps its room.
        <ChartContainer config={config} className="aspect-square h-14 shrink-0 md:h-20">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel nameKey="key" />}
            />
            <Pie
              data={shown.map((p) => ({ ...p, fill: `var(--color-${p.key})` }))}
              dataKey="value"
              nameKey="key"
              // Shares of the box, so the ring scales with it.
              innerRadius="68%"
              outerRadius="96%"
              paddingAngle={shown.length > 1 ? 4 : 0}
              cornerRadius={3}
              stroke="none"
              isAnimationActive={false}
            />
          </PieChart>
        </ChartContainer>
      )}
      <ul className="text-muted-foreground grid min-w-0 gap-1 text-xs">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5 leading-tight">
            <span className="size-2 shrink-0 rounded-xs" style={{ background: p.color }} />
            <span className="text-foreground tabular-nums">{formatInteger(p.value)}</span>
            {p.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
