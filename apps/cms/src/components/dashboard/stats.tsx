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
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { formatBytes, formatInteger } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DashboardData } from '@/server/dashboard';

type Trend = {
  /** Each card draws its trend differently, so the row doesn't read as four copies. */
  kind: 'area' | 'bar' | 'line';
  /** Counts per week, oldest first. */
  weeks: number[];
  /** What was counted, for the tooltip and screen readers ("posts published"). */
  counted: string;
  /** Draw the running total, ending at this, instead of each week's count. */
  total?: number;
};

type Part = { key: string; label: string; value: number; color: string };

type Stat = {
  label: string;
  value: number;
  hint: string;
  trend?: Trend;
  /** Parts of the value, drawn as a donut. */
  parts?: Part[];
};

const MUTED = 'color-mix(in oklch, var(--muted-foreground) 35%, transparent)';

/** "2 open to visitors, 1 coming soon": the stages that matter for visitors, as a short line. */
function locationHint(locations: DashboardData['locations']) {
  if (locations.length === 0) return 'None added yet';
  const live = locations.filter((l) => l.stage !== 'coming_soon').length;
  const soon = locations.length - live;
  return [live > 0 && `${live} open to visitors`, soon > 0 && `${soon} coming soon`]
    .filter(Boolean)
    .join(', ');
}

function buildStats({ posts, media, locations }: DashboardData): Stat[] {
  const open = locations.filter((l) => l.stage !== 'coming_soon').length;
  return [
    {
      label: 'Published posts',
      value: posts.published,
      hint: `${formatInteger(posts.publishedLast30)} in the last 30 days`,
      trend: { kind: 'area', weeks: posts.publishedWeekly, counted: 'posts published' },
    },
    {
      label: 'Drafts',
      value: posts.drafts,
      hint: 'Not on the website yet',
      trend: { kind: 'bar', weeks: posts.startedWeekly, counted: 'posts started' },
    },
    {
      label: 'Media files',
      value: media.files,
      hint:
        media.missingAlt > 0
          ? `${formatInteger(media.missingAlt)} ${media.missingAlt === 1 ? 'needs' : 'need'} alt text`
          : `${formatBytes(media.bytes)} stored`,
      trend: {
        kind: 'line',
        weeks: media.uploadedWeekly,
        counted: 'files uploaded',
        total: media.files,
      },
    },
    {
      label: 'Locations',
      value: locations.length,
      hint: locationHint(locations),
      parts: [
        { key: 'open', label: 'Open', value: open, color: 'var(--primary)' },
        { key: 'soon', label: 'Coming soon', value: locations.length - open, color: MUTED },
      ],
    },
  ];
}

const sum = (values: number[]) => values.reduce((total, n) => total + n, 0);

/** The last four weeks against the four before, as "+2"; null when nothing changed. */
function change(weeks: number[]) {
  const diff = sum(weeks.slice(-4)) - sum(weeks.slice(-8, -4));
  if (diff === 0) return null;
  return { diff, text: `${diff > 0 ? '+' : '−'}${formatInteger(Math.abs(diff))}` };
}

function weeksAgo(i: number, total: number) {
  const ago = total - 1 - i;
  return ago === 0 ? 'This week' : ago === 1 ? 'Last week' : `${ago} weeks ago`;
}

/** Each week's count, or the running total at the end of each week when `total` is given. */
function trendData({ weeks, total }: Trend) {
  const values = [...weeks];
  if (total !== undefined) {
    // Walk back from today: each week ends at the total less what came after it.
    let running = total;
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
function TrendChart(trend: Trend) {
  const gradient = useId();
  const data = trendData(trend);
  const label = trend.total === undefined ? trend.counted : 'files in the library';
  const config = { count: { label, color: 'var(--primary)' } } satisfies ChartConfig;
  const description =
    trend.total === undefined
      ? `${formatInteger(sum(trend.weeks))} ${trend.counted} in the last ${trend.weeks.length} weeks.`
      : `${formatInteger(sum(trend.weeks))} ${trend.counted} in the last ${trend.weeks.length} weeks, ${formatInteger(trend.total)} in all.`;

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
function PartsChart({ parts }: { parts: Part[] }) {
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

export function DashboardStats({ data }: { data: DashboardData }) {
  return (
    <>
      {buildStats(data).map((stat) => (
        <StatCard key={stat.label} stat={stat} />
      ))}
    </>
  );
}

function StatCard({ stat }: { stat: Stat }) {
  const { label, value, hint, trend, parts } = stat;
  const delta = trend && change(trend.weeks);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-normal">{label}</CardTitle>
        {delta && (
          <CardAction
            className="text-muted-foreground row-span-1 text-xs leading-none tabular-nums"
            title={`${delta.text} ${trend.counted} in the last 4 weeks, against the 4 before`}
          >
            <span className={cn(delta.diff > 0 && 'text-foreground')}>{delta.text}</span>
            <span className="sr-only">
              {' '}
              {trend.counted} in the last 4 weeks, against the 4 before
            </span>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight text-balance tabular-nums">
          {formatInteger(value)}
        </p>
        {trend && <TrendChart {...trend} />}
        {parts && <PartsChart parts={parts} />}
      </CardContent>
      <CardFooter className="mt-auto gap-1.5 text-xs">
        <span className="text-muted-foreground text-pretty">{hint}</span>
      </CardFooter>
    </Card>
  );
}
