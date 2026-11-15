import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts';
import { DonutChart } from '@/components/arc/donut-chart/donut-chart';
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
import { axisEvery, longDate, shortDate } from '@/lib/dashboard-trend';
import { type Part, type Range, type Trend, dayMonth, sum, weekName, weekStart } from './shared';

// The chart library is loaded with these, after the card's figures are on screen.

/**
 * One point per day (the last `range`) or per week: its name for the tooltip, a short label for
 * the date axis, and its count, or the running total at the end of it when `total` is given.
 */
function trendData(trend: Trend, range: Range, timeZone: string) {
  const { total, endsAt, days } = trend;
  const counts = days?.counts ?? trend.weeks ?? [];
  const compare = days ? days.compare : trend.compare?.weeks;
  const last = counts.length - 1;
  const values = [...counts];
  if (total) {
    // Walk back from today: each period ends at the total less what came after it.
    let running = total.value;
    for (let i = last; i >= 0; i--) {
      values[i] = running;
      running -= counts[i] ?? 0;
    }
  }
  const every = axisEvery(range);
  const name = (i: number) =>
    days ? longDate(days.keys[i]!) : weekName(i, counts.length, endsAt, timeZone);
  const axis = (i: number) =>
    days
      ? (last - i) % every === 0
        ? shortDate(days.keys[i]!)
        : undefined
      : endsAt === undefined
        ? undefined
        : dayMonth(weekStart(i, counts.length, endsAt), timeZone);
  // The days shown are the latest `range` of them; the rest only feed the comparison.
  const from = days ? Math.max(0, counts.length - range) : 0;
  return values.slice(from).map((count, at) => {
    const i = from + at;
    return {
      name: name(i),
      axis: axis(i),
      count,
      ...(compare && { compare: compare[i] ?? 0 }),
    };
  });
}

// The bars' hidden x-axis names each day or week for the tooltip.
// The y-axis leaves a little air above the highest bar.
const axes = (
  <>
    <XAxis dataKey="name" hide />
    <YAxis hide domain={[0, (max: number) => Math.max(max, 1) * 1.15]} />
  </>
);
const tooltipContent = <ChartTooltipContent indicator="line" />;
// A faint column under the pointer.
const barCursor = { fill: 'color-mix(in oklch, var(--muted-foreground) 10%, transparent)' };

const tint = (share: number) => `color-mix(in oklch, var(--color-count) ${share}%, transparent)`;
/** The trend's 128px (h-32) less the 26px date row. */
const PLOT_HEIGHT = 102;
const compact = new Intl.NumberFormat('en-AU', { notation: 'compact', maximumFractionDigits: 1 });
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The span as a line chart, or as bars. Hover or scrub for each day's or week's figure. */
export function TrendChart({ trend, range }: { trend: Trend; range: Range }) {
  const timeZone = useTimeZone();
  const data = trendData(trend, range, timeZone);
  const label = sentence(trend.total?.label ?? trend.counted);

  if (trend.kind === 'bar')
    return (
      <PeriodBars trend={trend} data={data} label={label} unit={trend.days ? 'days' : 'weeks'} />
    );

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
        categoryLabel={trend.days ? 'Day' : 'Week'}
        formatValue={(value) => formatInteger(value)}
        // Counts are whole, so a small range keeps only its whole-number lines labelled. Big ones
        // are short ("1.5K"), as the axis column is narrow.
        formatTick={(value) => (Number.isInteger(value) ? compact.format(value) : '')}
        data={data.map((d, i) => ({
          key: String(i),
          label: d.name,
          // Every point can be labelled; the chart keeps as many as fit, always the latest.
          axisLabel: d.axis,
          values: { count: d.count, ...(d.compare !== undefined && { compare: d.compare }) },
        }))}
      />
    </div>
  );
}

/** Counts as bars: the latest in full, the ones before sit back. */
function PeriodBars({
  trend,
  data,
  label,
  unit,
}: {
  trend: Trend;
  data: ReturnType<typeof trendData>;
  label: string;
  unit: 'days' | 'weeks';
}) {
  const config = { count: { label, color: 'var(--primary)' } } satisfies ChartConfig;
  const description = `${formatInteger(sum(data.map((d) => d.count)))} ${trend.counted} in the last ${data.length} ${unit}.`;
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
                key={d.name}
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

/**
 * A small donut of the parts, with a legend beside it: the same chart as the Analytics pages,
 * scaled to a card. Its own legend and centre readout are too big for this, so the card keeps
 * its compact list and the ring shows the total, or a part while it is hovered.
 */
export function PartsChart({ parts }: { parts: Part[] }) {
  return (
    // Shorter than the trend charts; the card's figure still sits at its foot.
    <div className="flex h-28 items-center gap-3 md:gap-4">
      {parts.some((p) => p.value > 0) && (
        <DonutChart
          className="donut-compact w-16 shrink-0 md:w-28"
          label={parts.map((p) => p.label).join(', ')}
          data={parts.map((p) => ({ key: p.key, label: p.label, value: p.value }))}
          formatValue={formatInteger}
          legend={false}
          size={112}
          thickness={14}
          groupBelow={0}
          maxSegments={parts.length}
        />
      )}
      <ul className="text-muted-foreground grid min-w-0 gap-1 text-xs">
        {parts.map((p, i) => (
          <li key={p.key} className="flex items-center gap-1.5 leading-tight">
            {/* The ring's own colour for this part: the chart palette, in order. */}
            <span
              className="size-2 shrink-0 rounded-xs"
              style={{ background: `var(--chart-${(i % 4) + 1})` }}
            />
            <span className="text-foreground tabular-nums">{formatInteger(p.value)}</span>
            {p.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
