import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { DonutChart } from '@/components/arc/donut-chart/donut-chart';
import { LineChart, type LineChartSeries } from '@/components/arc/line-chart/line-chart';
import { UsageMeter } from '@/components/arc/usage-meter/usage-meter';
import { RangeSelect } from '@/components/range-select';
import type { Range } from '@/components/stat-card/shared';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { chartReveal } from '@/lib/chart-motion';
import { formatBytes, formatDuration, formatInteger } from '@/lib/format';
import { addedIn, describeMonths, monthsUntilFull } from '@/lib/media-growth';
import { databaseMeter, libraryMeter } from '@/lib/storage-meter';
import { useTimeZone } from '@/lib/use-time-zone';
import type { SystemStatus } from '@/server/system';

// Loaded on its own, so the chart library doesn't hold up the checks above.

const HOUR_MS = 3_600_000;
const DAYS = 14;

type Hour = SystemStatus['history'][number];
type Usage = SystemStatus['usage'];

const runsConfig = {
  ok: { label: 'Worked', color: 'var(--primary)' },
  failed: { label: 'Failed', color: 'var(--destructive)' },
} satisfies ChartConfig;
// The library's default colour is our pale hover grey, so name them.
const timeSeries: LineChartSeries[] = [
  { key: 'averageMs', label: 'Average', color: 'var(--primary)', area: true },
  { key: 'slowestMs', label: 'Slowest', color: 'var(--muted-foreground)', dashed: true },
];

const dayKey = (timestamp: number, timeZone: string) =>
  new Date(timestamp).toLocaleDateString('en-CA', { timeZone });
const fullDayLabel = (timestamp: number, timeZone: string) =>
  new Date(timestamp).toLocaleDateString('en-AU', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
const dayLabel = (timestamp: number, timeZone: string) =>
  new Date(timestamp).toLocaleDateString('en-AU', { timeZone, day: 'numeric', month: 'short' });

/** The last 14 days in the viewer's time zone, oldest first, with each hour's runs added in. */
function byDay(history: Hour[], timeZone: string, now = Date.now()) {
  const days = new Map<
    string,
    {
      key: string;
      label: string;
      fullLabel: string;
      runs: number;
      failed: number;
      totalMs: number;
      slowestMs: number;
    }
  >();
  // Walk the hours rather than add days, so a daylight saving change never skips or repeats one.
  for (let t = now - DAYS * 24 * HOUR_MS; t <= now; t += HOUR_MS) {
    const key = dayKey(t, timeZone);
    if (!days.has(key)) {
      days.set(key, {
        key,
        label: dayLabel(t, timeZone),
        fullLabel: fullDayLabel(t, timeZone),
        runs: 0,
        failed: 0,
        totalMs: 0,
        slowestMs: 0,
      });
    }
  }
  for (const hour of history) {
    const day = days.get(dayKey(hour.hourStart, timeZone));
    if (!day) continue;
    day.runs += hour.runs;
    day.failed += hour.failed;
    day.totalMs += hour.totalMs;
    day.slowestMs = Math.max(day.slowestMs, hour.slowestMs);
  }
  return [...days.values()].slice(-DAYS).map((day) => ({
    ...day,
    ok: day.runs - day.failed,
    averageMs: day.runs ? Math.round(day.totalMs / day.runs) : 0,
  }));
}

const dayAxis = (
  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
);

/** Runs per day, worked and failed, and how long they took on average. */
export function JobCharts({ history }: { history: Hour[] }) {
  const timeZone = useTimeZone();
  const days = byDay(history, timeZone);
  const runs = days.reduce((n, d) => n + d.runs, 0);
  const failed = days.reduce((n, d) => n + d.failed, 0);
  const slowest = days.reduce((top, d) => (d.slowestMs > top.slowestMs ? d : top), days[0]!);
  const share = runs ? (100 * (runs - failed)) / runs : 100;

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:col-span-2">
      <Card>
        <CardHeader>
          <CardTitle>Job runs</CardTitle>
          <CardDescription>
            {runs === 0
              ? 'No runs in the last 14 days.'
              : `${formatInteger(runs)} in 14 days, ${failed === 0 ? 'none failed' : `${formatInteger(failed)} failed`}. ${share.toLocaleString('en-AU', { maximumFractionDigits: 1 })}% worked.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={runsConfig} className="aspect-auto h-44 w-full">
            <BarChart data={days} margin={{ left: 0, right: 0 }}>
              <CartesianGrid vertical={false} />
              {dayAxis}
              <YAxis hide allowDecimals={false} domain={[0, (max: number) => Math.max(max, 1)]} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="ok" stackId="runs" fill="var(--color-ok)" {...chartReveal} />
              <Bar
                dataKey="failed"
                stackId="runs"
                fill="var(--color-failed)"
                radius={[3, 3, 0, 0]}
                {...chartReveal}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
          <p className="sr-only">
            {days
              .map(
                (d) =>
                  `${d.label}: ${formatInteger(d.runs)} runs, ${formatInteger(d.failed)} failed`
              )
              .join('. ')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Run time</CardTitle>
          <CardDescription>
            {runs === 0 || slowest.slowestMs === 0
              ? 'Each day’s average, once jobs have run.'
              : `Each day’s average. The slowest run took ${formatDuration(slowest.slowestMs)}, on ${slowest.label}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LineChart
            label="Job run time"
            height={150}
            series={timeSeries}
            // Slowest dwarfs the average, so it starts hidden; the scale refits when it is shown.
            defaultHiddenSeries={['slowestMs']}
            data={days.map((d) => ({
              key: d.key,
              label: d.fullLabel,
              axisLabel: d.label,
              values: { averageMs: d.averageMs, slowestMs: d.slowestMs },
            }))}
            formatValue={formatDuration}
            formatTick={formatDuration}
            emptyLabel="No runs in the last 14 days"
            categoryLabel="Day"
          />
        </CardContent>
      </Card>
    </div>
  );
}

/** How full the database is, what the media library holds, and the biggest tables. */
export function UsageCard({ usage }: { usage: Usage }) {
  const { databaseBytes, databaseLimitBytes, mediaAllowanceBytes, files, records, growth } = usage;
  const sortedRecords = [...records].sort((a, b) => b.rows - a.rows);
  const [range, setRange] = useState<Range>(30);
  const added = addedIn(growth, range);
  const usedBytes = files.reduce((n, f) => n + f.bytes, 0);
  const months = monthsUntilFull(mediaAllowanceBytes, usedBytes, added.bytes, range);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage</CardTitle>
        <CardDescription>What the database and the media library hold right now.</CardDescription>
        <CardAction>
          <RangeSelect label="Storage growth" value={range} onChange={setRange} />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          <section>
            {databaseBytes === null ? (
              <p className="text-muted-foreground text-sm">Database size unknown.</p>
            ) : (
              <UsageMeter {...databaseMeter(databaseBytes, databaseLimitBytes)} />
            )}
          </section>
          <section className="space-y-2">
            <UsageMeter {...libraryMeter(files, mediaAllowanceBytes)} />
            <p className="text-sm tabular-nums">
              {added.files === 0
                ? `Nothing added in the last ${range} days.`
                : `${formatInteger(added.files)} ${added.files === 1 ? 'file' : 'files'}, ${formatBytes(added.bytes)} added in the last ${range} days.`}
              {months !== null && (
                <span className="text-muted-foreground">
                  {months === 0
                    ? ' The allowance is already used up.'
                    : ` At this pace the allowance lasts ${describeMonths(months)}.`}
                </span>
              )}
            </p>
            <p className="text-muted-foreground text-xs">
              Originals only; the smaller copies made for each image are not counted. The allowance
              is the 10 GB of storage included each month.
            </p>
          </section>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Rows by table</h3>
          {/* The chart puts its legend beside the ring when there is room, measured by a container
              query, so this wrapper is that container. */}
          <div className="@container">
            <DonutChart
              label="Rows by table"
              unit="rows"
              totalLabel="Rows"
              formatValue={formatInteger}
              data={sortedRecords.map((r) => ({ key: r.label, label: r.label, value: r.rows }))}
              size={184}
              thickness={22}
              maxSegments={7}
              emptyLabel="No rows"
            />
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
