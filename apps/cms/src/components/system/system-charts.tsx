import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { LineChart, type LineChartSeries } from '@/components/arc/line-chart/line-chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useTimeZone } from '@/lib/use-time-zone';
import type { SystemStatus } from '@/server/system';
import type { FileKind } from '@/server/system-store';

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
const recordsConfig = { rows: { label: 'Rows', color: 'var(--primary)' } } satisfies ChartConfig;

const KIND: Record<FileKind, { label: string; color: string }> = {
  image: { label: 'Images', color: 'var(--chart-1)' },
  video: { label: 'Videos', color: 'var(--chart-2)' },
  pdf: { label: 'PDFs', color: 'var(--chart-3)' },
  other: { label: 'Other files', color: 'var(--chart-5)' },
};

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
    <div className="grid gap-6 sm:grid-cols-2">
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
  const { databaseBytes, databaseLimitBytes, files, records } = usage;
  const share = databaseBytes === null ? null : databaseBytes / databaseLimitBytes;
  const fileBytes = files.reduce((n, f) => n + f.bytes, 0);
  const fileCount = files.reduce((n, f) => n + f.files, 0);
  const sortedFiles = [...files].sort((a, b) => b.bytes - a.bytes);
  const sortedRecords = [...records].sort((a, b) => b.rows - a.rows);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage</CardTitle>
        <CardDescription>What the database and the media library hold right now.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <h3 className="font-medium">Database</h3>
            <span className="text-muted-foreground tabular-nums">
              {databaseBytes === null
                ? 'Size unknown'
                : `${formatBytes(databaseBytes)} of ${formatBytes(databaseLimitBytes)}`}
            </span>
          </div>
          <Meter
            label="Database used"
            share={share ?? 0}
            segments={[{ key: 'used', share: share ?? 0, color: 'var(--primary)' }]}
          />
        </section>

        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <h3 className="font-medium">Media library</h3>
            <span className="text-muted-foreground tabular-nums">
              {`${formatInteger(fileCount)} ${fileCount === 1 ? 'file' : 'files'}, ${formatBytes(fileBytes)}`}
            </span>
          </div>
          {fileBytes > 0 && (
            <>
              <Meter
                label="Media library by kind"
                share={1}
                segments={sortedFiles.map((f) => ({
                  key: f.kind,
                  share: f.bytes / fileBytes,
                  color: KIND[f.kind].color,
                }))}
              />
              <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {sortedFiles.map((f) => (
                  <li key={f.kind} className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-2 rounded-[2px]"
                      style={{ background: KIND[f.kind].color }}
                    />
                    {KIND[f.kind].label}: {formatInteger(f.files)}, {formatBytes(f.bytes)}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="text-muted-foreground text-xs">
            Originals only; the smaller copies made for each image are not counted.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Rows by table</h3>
          <ChartContainer
            config={recordsConfig}
            className="aspect-auto w-full"
            style={{ height: sortedRecords.length * 28 + 8 }}
          >
            <BarChart
              data={sortedRecords}
              layout="vertical"
              margin={{ left: 0, right: 48, top: 0, bottom: 0 }}
              barCategoryGap={6}
            >
              <XAxis type="number" hide domain={[0, (max: number) => Math.max(max, 1)]} />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar
                dataKey="rows"
                fill="var(--color-rows)"
                radius={3}
                minPointSize={2}
                {...chartReveal}
              >
                <LabelList
                  dataKey="rows"
                  position="right"
                  className="fill-muted-foreground tabular-nums"
                  fontSize={12}
                  formatter={(value: unknown) => formatInteger(Number(value))}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
          <p className="sr-only">
            {sortedRecords.map((r) => `${r.label}: ${formatInteger(r.rows)}`).join('. ')}
          </p>
        </section>
      </CardContent>
    </Card>
  );
}

/** A bar split into coloured shares of a whole. */
function Meter({
  label,
  share,
  segments,
}: {
  label: string;
  share: number;
  segments: { key: string; share: number; color: string }[];
}) {
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(share * 100)}
      className="bg-muted flex h-2 w-full overflow-hidden rounded-full"
    >
      {segments.map((s) => (
        <span
          key={s.key}
          className="h-full"
          // A sliver, not nothing, so a database that is barely used still shows.
          style={{
            width: `${Math.max(s.share * 100, s.share > 0 ? 0.75 : 0)}%`,
            background: s.color,
          }}
        />
      ))}
    </div>
  );
}
