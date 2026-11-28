import { Flag } from '@/components/flag';
import { LineChart, type LineChartSeries } from '@/components/arc/line-chart/line-chart';
import { RollingNumber } from '@/components/rolling-number';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type AnalyticsRange,
  channelLabels,
  formatPercent,
  formatSeconds,
  pageName,
  percentOf,
} from '@/lib/analytics';
import { axisEvery, longDate, percentChange, shortDate } from '@/lib/dashboard-trend';
import { formatCompact, formatInteger } from '@/lib/format';
import { siteUrl } from '@/lib/site';
import { cn } from '@/lib/utils';
import type { AnalyticsResult, Overview, PeriodTotals } from '@/server/analytics';
import { AnalyticsPage, rangeSearch } from './analytics-page';
import { DonutCard } from './donut-card';
import { RankedCard } from './ranked-card';

const SERIES: LineChartSeries[] = [
  { key: 'visitors', label: 'Unique visitors', color: 'var(--primary)', area: true },
  { key: 'views', label: 'Page views', color: 'var(--muted-foreground)' },
];

const bounceRate = (t: PeriodTotals) => percentOf(t.bounces, t.visits);

export function OverviewPage({
  result,
  onRangeChange,
}: {
  result: AnalyticsResult<Overview>;
  onRangeChange: (days: AnalyticsRange) => void;
}) {
  return (
    <AnalyticsPage
      kind=""
      title="Analytics"
      description="How many people visit the website, how long they stay, and what brings them."
      result={result}
      onRangeChange={onRangeChange}
      isEmpty={(data) => data.current.views === 0 && data.previous.views === 0}
    >
      {(data, days) => <OverviewBody data={data} days={days} />}
    </AnalyticsPage>
  );
}

function OverviewBody({ data, days }: { data: Overview; days: AnalyticsRange }) {
  const { current, previous } = data;
  const search = rangeSearch(days);
  const every = axisEvery(days);
  const chart = data.daily.days.map((key, i) => ({
    key,
    label: longDate(key),
    axisLabel: (data.daily.days.length - 1 - i) % every === 0 ? shortDate(key) : undefined,
    values: { visitors: data.daily.visitors[i] ?? 0, views: data.daily.views[i] ?? 0 },
  }));
  const perVisit = current.visits > 0 ? current.views / current.visits : null;

  return (
    <div className="space-y-4 max-md:space-y-3">
      <div className="grid gap-4 max-md:gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Unique visitors"
          value={<RollingNumber value={current.visitors} />}
          hint={`${formatInteger(current.visits)} ${current.visits === 1 ? 'visit' : 'visits'}`}
          change={percentChange(current.visitors, previous.visitors)}
          days={days}
        />
        <Tile
          label="Page views"
          value={<RollingNumber value={current.views} />}
          hint={
            perVisit === null
              ? 'No visits'
              : `${perVisit.toLocaleString('en-AU', { maximumFractionDigits: 1 })} per visit`
          }
          change={percentChange(current.views, previous.views)}
          days={days}
        />
        <Tile
          label="Bounce rate"
          value={formatPercent(bounceRate(current))}
          hint="Visits that left after one page"
          change={pointsChange(bounceRate(current), bounceRate(previous))}
          unit="points"
          lowerIsBetter
          days={days}
        />
        <Tile
          label="Average visit"
          value={formatSeconds(current.seconds)}
          hint="From the first page to leaving"
          change={
            current.seconds !== null && previous.seconds
              ? percentChange(current.seconds, previous.seconds)
              : null
          }
          days={days}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Visitors and page views</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart
            label="Unique visitors and page views per day"
            series={SERIES.map((s) => ({
              ...s,
              total: formatInteger(s.key === 'visitors' ? current.visitors : current.views),
            }))}
            data={chart}
            height={240}
            formatValue={(value) => formatInteger(value)}
            formatTick={(value) => (Number.isInteger(value) ? formatCompact(value) : '')}
            categoryLabel="Day"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 max-md:gap-3 lg:grid-cols-3">
        <RankedCard
          title="Top pages"
          counted="page views"
          rows={data.pages.map((p) => ({
            key: p.path,
            label: pageName(p),
            value: p.views,
            href: siteUrl(p.path),
          }))}
          total={current.views}
          more={{ to: '/analytics/pages', search }}
        />
        <DonutCard
          title="Channels"
          unit="visits"
          rows={data.channels.map((c) => ({ ...c, label: channelLabels[c.key] }))}
          more={{ to: '/analytics/traffic', search }}
        />
        <RankedCard
          title="Countries"
          counted="visits"
          rows={data.countries.map((c) => ({
            key: c.key,
            label: c.label,
            value: c.value,
            leading: <Flag code={c.code} />,
          }))}
          total={current.visits}
          more={{ to: '/analytics/audience', search }}
        />
      </div>
    </div>
  );
}

/** The change in a rate, in percentage points, or null with nothing to compare. */
const pointsChange = (now: number | null, before: number | null) =>
  now === null || before === null ? null : now - before;

function Tile({
  label,
  value,
  hint,
  change,
  days,
  unit = 'percent',
  lowerIsBetter = false,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  change: number | null;
  days: number;
  unit?: 'percent' | 'points';
  lowerIsBetter?: boolean;
}) {
  const good = change !== null && (lowerIsBetter ? change <= 0 : change >= 0);
  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent className="mt-3 space-y-1">
        <p className="text-muted-foreground text-xs text-pretty">{hint}</p>
        <p className="text-3xl font-medium tracking-tight tabular-nums">{value}</p>
        <p
          className={cn(
            'text-xs tabular-nums',
            change === null
              ? 'text-muted-foreground'
              : good
                ? 'text-success-text'
                : 'text-destructive'
          )}
        >
          {change === null ? (
            `Nothing to compare in the ${days} days before`
          ) : (
            <>
              <RollingNumber value={change} decimals={1} signed />
              {unit === 'percent' ? '%' : ' pts'} vs previous {days} days
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
