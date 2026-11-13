import { useEffect, useState } from 'react';
import { LineChart, type LineChartSeries } from '@/components/arc/line-chart/line-chart';
import { SegmentedControl } from '@/components/segmented-control';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type TrendMetric,
  type TrendRange,
  axisEvery,
  longDate,
  percentChange,
  shortDate,
  trendMetricKeys,
  trendMetrics,
  trendRanges,
} from '@/lib/dashboard-trend';
import { RollingNumber } from '@/components/rolling-number';
import { formatInteger } from '@/lib/format';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { type DashboardTrend, getDashboardTrend } from '@/server/dashboard-trend';

// The library's default colour is our pale hover grey, so name them.
const SERIES: LineChartSeries[] = [
  { key: 'current', label: 'This period', color: 'var(--primary)', area: true },
  { key: 'previous', label: 'Previous period', color: 'var(--muted-foreground)', dashed: true },
];

const RANGE_OPTIONS = trendRanges.map((days) => ({ value: String(days), label: `${days} days` }));
const STORED = 'dashboard-trend';

const sum = (values: number[]) => values.reduce((n, v) => n + v, 0);

function readStored(metrics: TrendMetric[]): { metric: TrendMetric; days: TrendRange } {
  const fallback = { metric: metrics[0]!, days: 30 as TrendRange };
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const saved = JSON.parse(localStorage.getItem(STORED) ?? '{}') as Partial<typeof fallback>;
    return {
      metric: saved.metric && metrics.includes(saved.metric) ? saved.metric : fallback.metric,
      days: trendRanges.includes(saved.days as TrendRange) ? saved.days! : fallback.days,
    };
  } catch {
    return fallback;
  }
}

/**
 * The website's unique visitors or page views over the last 7, 30 or 90 days, against the same
 * span before. It needs the website's analytics to be connected, and says so when they are not.
 */
export function TrendCard({ analytics }: { analytics: boolean }) {
  const metrics = trendMetricKeys;
  const [{ metric, days }, setChoice] = useState(() => readStored(metrics));
  const [trend, setTrend] = useState<DashboardTrend | null>(null);
  // Without analytics there is nothing to wait for.
  const [loading, setLoading] = useState(analytics);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!analytics) return;
    localStorage.setItem(STORED, JSON.stringify({ metric, days }));
    let live = true;
    setLoading(true);
    setFailed(false);
    getDashboardTrend({ data: { metric, days } })
      .then((next) => live && setTrend(next))
      .catch((error: unknown) => {
        if (!live) return;
        setFailed(true);
        notify.error('Could not load the chart', error);
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [analytics, metric, days]);

  const { label, total: totalLabel } = trendMetrics[metric];
  // Unique visitors come counted over the whole period; the rest add up their days.
  const totals = trend
    ? (trend.distinct ?? { current: sum(trend.current), previous: sum(trend.previous) })
    : null;
  const total = totals?.current ?? null;
  const change = totals ? percentChange(totals.current, totals.previous) : null;
  const every = axisEvery(days);
  const data =
    trend?.days.map((key, i) => ({
      key,
      label: longDate(key),
      // Counted back from today, so the latest date is always labelled.
      axisLabel: (trend.days.length - 1 - i) % every === 0 ? shortDate(key) : undefined,
      values: { current: trend.current[i] ?? 0, previous: trend.previous[i] ?? 0 },
    })) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <Select
          items={metrics.map((key) => ({ value: key, label: trendMetrics[key].label }))}
          value={metric}
          onValueChange={(value) => value && setChoice({ metric: value as TrendMetric, days })}
        >
          <SelectTrigger
            aria-label="What the chart shows"
            className="-ml-2.5 border-transparent bg-transparent font-medium shadow-none dark:bg-transparent"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {metrics.map((key) => (
              <SelectItem key={key} value={key}>
                {trendMetrics[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SegmentedControl
          label="Range"
          value={String(days)}
          onValueChange={(value) => setChoice({ metric, days: Number(value) as TrendRange })}
          options={RANGE_OPTIONS}
          className="max-md:order-last"
        />
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">{totalLabel}</p>
          <p className="text-3xl font-medium tracking-tight tabular-nums">
            {total === null ? '–' : <RollingNumber value={total} />}
          </p>
          <Change change={change} days={days} known={trend !== null} />
        </div>
        <LineChart
          label={label}
          series={SERIES}
          data={data}
          height={220}
          loading={loading}
          formatValue={(value) => formatInteger(value)}
          // Counts are whole, so a small range keeps only its whole-number lines labelled.
          formatTick={(value) => (Number.isInteger(value) ? formatInteger(value) : '')}
          emptyLabel={
            !analytics
              ? "Website analytics aren't connected to the CMS yet"
              : failed
                ? 'Could not load website traffic'
                : 'Loading'
          }
          categoryLabel="Day"
        />
      </CardContent>
    </Card>
  );
}

function Change({ change, days, known }: { change: number | null; days: number; known: boolean }) {
  const against = `vs previous ${days} days`;
  if (!known) return <p className="text-muted-foreground text-sm">&nbsp;</p>;
  if (change === null) {
    return (
      <p className="text-muted-foreground text-sm">
        Nothing in the previous {days} days to compare
      </p>
    );
  }
  const up = change >= 0;
  return (
    <p
      className={cn(
        'text-sm tabular-nums',
        up ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
      )}
    >
      <RollingNumber value={change} decimals={1} signed />% {against}
    </p>
  );
}
