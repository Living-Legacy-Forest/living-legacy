import { useId } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { formatInteger } from '@/lib/format';
import { MUTED, type Part, type Trend, sum } from './shared';

// The chart library is loaded with these, after the card's figures are on screen.

function weeksAgo(i: number, total: number) {
  const ago = total - 1 - i;
  return ago === 0 ? 'This week' : ago === 1 ? 'Last week' : `${ago} weeks ago`;
}

/** Each week's count, or the running total at the end of each week when `total` is given. */
function trendData({ weeks, total }: Trend) {
  const values = [...weeks];
  if (total) {
    // Walk back from today: each week ends at the total less what came after it.
    let running = total.value;
    for (let i = weeks.length - 1; i >= 0; i--) {
      values[i] = running;
      running -= weeks[i] ?? 0;
    }
  }
  return values.map((count, i) => ({ week: weeksAgo(i, weeks.length), count }));
}

const MARGIN = { top: 2, right: 2, bottom: 2, left: 2 };
// The hidden x-axis names each point, so the tooltip reads "3 weeks ago".
const axes = (
  <>
    <XAxis dataKey="week" hide />
    <YAxis hide allowDecimals={false} domain={[0, (max: number) => Math.max(max, 1)]} />
  </>
);
const tooltip = <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />;

/** The last twelve weeks as an area, bars or a line. Hover for each week's figure. */
export function TrendChart(trend: Trend) {
  const gradient = useId();
  const data = trendData(trend);
  const label = trend.total?.label ?? trend.counted;
  const config = { count: { label, color: 'var(--primary)' } } satisfies ChartConfig;
  const description = !trend.total
    ? `${formatInteger(sum(trend.weeks))} ${trend.counted} in the last ${trend.weeks.length} weeks.`
    : `${formatInteger(sum(trend.weeks))} ${trend.counted} in the last ${trend.weeks.length} weeks, ${formatInteger(trend.total.value)} in all.`;

  return (
    <div className="mt-3">
      <ChartContainer config={config} className="aspect-auto h-10 w-full">
        {trend.kind === 'area' ? (
          <AreaChart data={data} margin={MARGIN}>
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-count)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-count)" stopOpacity={0} />
              </linearGradient>
            </defs>
            {axes}
            {tooltip}
            <Area
              dataKey="count"
              type="monotone"
              stroke="var(--color-count)"
              strokeWidth={1.5}
              fill={`url(#${gradient})`}
              isAnimationActive={false}
            />
          </AreaChart>
        ) : trend.kind === 'line' ? (
          <LineChart data={data} margin={MARGIN}>
            {axes}
            {tooltip}
            <Line
              dataKey="count"
              type="monotone"
              stroke="var(--color-count)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
            />
          </LineChart>
        ) : (
          <BarChart
            data={data}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            barCategoryGap={2}
          >
            {axes}
            {tooltip}
            <Bar dataKey="count" radius={[3, 3, 0, 0]} minPointSize={1} isAnimationActive={false}>
              {/* This week stands out; the weeks before sit back. */}
              {data.map((d, i) => (
                <Cell key={d.week} fill={i === data.length - 1 ? 'var(--color-count)' : MUTED} />
              ))}
            </Bar>
          </BarChart>
        )}
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
    // The same height as the trend charts, so the four cards line up.
    <div className="mt-3 flex h-10 items-center gap-3">
      {shown.length > 0 && (
        <ChartContainer config={config} className="aspect-square h-10 shrink-0">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel nameKey="key" />}
            />
            <Pie
              data={shown.map((p) => ({ ...p, fill: `var(--color-${p.key})` }))}
              dataKey="value"
              nameKey="key"
              innerRadius={12}
              outerRadius={20}
              paddingAngle={shown.length > 1 ? 4 : 0}
              stroke="none"
              isAnimationActive={false}
            />
          </PieChart>
        </ChartContainer>
      )}
      <ul className="text-muted-foreground grid gap-0.5 text-xs">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-[2px]" style={{ background: p.color }} />
            <span className="text-foreground tabular-nums">{formatInteger(p.value)}</span>
            {p.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
