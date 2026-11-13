import { Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { LineChart, type LineChartSeries } from '@/components/arc/line-chart/line-chart';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { chartReveal } from '@/lib/chart-motion';
import { formatInteger } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import { monthName, monthShort } from '@/lib/month-trend';
import { type Part, type Period, type Trend, dayMonth, sum, weekName, weekStart } from './shared';

// The chart library is loaded with these, after the card's figures are on screen.

/**
 * One point per week or month: its name for the tooltip, a short label for the date axis, and
 * its count, or the running total at the end of it when `total` is given.
 */
function trendData(trend: Trend, period: Period, timeZone: string) {
  const { total, endsAt } = trend;
  const months = period === 'months' ? trend.months : undefined;
  const counts = months?.counts ?? trend.weeks;
  const compare = months ? months.compare : trend.compare?.weeks;
  const last = counts.length - 1;
  const name = (i: number) =>
    months
      ? i === last
        ? 'This month'
        : monthName(months.keys[i]!)
      : weekName(i, counts.length, endsAt, timeZone);
  const axis = (i: number) =>
    months
      ? monthShort(months.keys[i]!)
      : endsAt === undefined
        ? undefined
        : dayMonth(weekStart(i, counts.length, endsAt), timeZone);
  const values = [...counts];
  if (total) {
    // Walk back from today: each period ends at the total less what came after it.
    let running = total.value;
    for (let i = last; i >= 0; i--) {
      values[i] = running;
      running -= counts[i] ?? 0;
    }
  }
  return values.map((count, i) => ({
    week: name(i),
    axis: axis(i),
    count,
    ...(compare && { compare: compare[i] ?? 0 }),
  }));
}

// The bars' hidden x-axis names each week, so the tooltip reads "Week of 3 Nov".
// The y-axis leaves a little air above the highest week.
const axes = (
  <>
    <XAxis dataKey="week" hide />
    <YAxis hide domain={[0, (max: number) => Math.max(max, 1) * 1.15]} />
  </>
);
const tooltipContent = <ChartTooltipContent indicator="line" />;
// A faint column under the pointer.
const barCursor = { fill: 'color-mix(in oklch, var(--muted-foreground) 10%, transparent)' };

const tint = (share: number) => `color-mix(in oklch, var(--color-count) ${share}%, transparent)`;
/** The trend's 128px (h-32) less the 26px date row. */
const PLOT_HEIGHT = 102;
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The last twelve weeks or months as a line chart, or as bars. Hover or scrub for each week's figure. */
export function TrendChart({ trend, period }: { trend: Trend; period: Period }) {
  const timeZone = useTimeZone();
  const data = trendData(trend, period, timeZone);
  const label = sentence(trend.total?.label ?? trend.counted);

  if (trend.kind === 'bar')
    return <PeriodBars trend={trend} data={data} label={label} period={period} />;

  // As on the dashboard's trend card: this period leads with a tinted area, the comparison
  // follows as a dashed line, over gridlines and a value axis. No legend, to keep the card
  // short; the tooltip names each line.
  const series: LineChartSeries[] = [
    { key: 'count', label, color: 'var(--primary)', area: true },
    ...(data[0]?.compare !== undefined
      ? [
          {
            key: 'compare',
            label: sentence(trend.compare?.counted ?? ''),
            color: 'var(--muted-foreground)',
            dashed: true,
          },
        ]
      : []),
  ];

  return (
    <div className="h-32">
      <LineChart
        className="stat-chart"
        label={label}
        series={series}
        legend={false}
        height={PLOT_HEIGHT}
        categoryLabel={period === 'months' ? 'Month' : 'Week'}
        formatValue={(value) => formatInteger(value)}
        // Counts are whole, so a small range keeps only its whole-number lines labelled.
        formatTick={(value) => (Number.isInteger(value) ? formatInteger(value) : '')}
        data={data.map((d, i) => ({
          key: String(i),
          label: d.week,
          // Every point can be labelled; the chart keeps as many as fit, always the latest.
          axisLabel: d.axis,
          values: { count: d.count, ...(d.compare !== undefined && { compare: d.compare }) },
        }))}
      />
    </div>
  );
}

/** Counts as bars: this week or month in full, the ones before sit back. */
function PeriodBars({
  trend,
  data,
  label,
  period,
}: {
  trend: Trend;
  data: ReturnType<typeof trendData>;
  label: string;
  period: Period;
}) {
  const config = { count: { label, color: 'var(--primary)' } } satisfies ChartConfig;
  const description = `${formatInteger(sum(data.map((d) => d.count)))} ${trend.counted} in the last ${data.length} ${period}.`;
  return (
    <div className="flex h-32 flex-col">
      <ChartContainer config={config} className="aspect-auto min-h-0 w-full flex-1">
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap={3}>
          {axes}
          <ChartTooltip cursor={barCursor} content={tooltipContent} />
          <Bar dataKey="count" radius={4} minPointSize={3} {...chartReveal}>
            {/* Empty weeks barely show. */}
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
      </ChartContainer>
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
    // Shorter than the trend charts; the card's figure still sits at its foot.
    <div className="flex h-24 items-center gap-3 md:gap-4">
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
              {...chartReveal}
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
