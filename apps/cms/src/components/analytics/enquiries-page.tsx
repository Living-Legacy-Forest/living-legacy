import { LineChart } from '@/components/arc/line-chart/line-chart';
import { RollingNumber } from '@/components/rolling-number';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type AnalyticsRange, formatPercent, pageName, percentOf } from '@/lib/analytics';
import { axisEvery, longDate, shortDate } from '@/lib/dashboard-trend';
import { formatInteger } from '@/lib/format';
import { siteUrl } from '@/lib/site';
import type { AnalyticsResult, Enquiries } from '@/server/analytics';
import { AnalyticsPage } from './analytics-page';
import { DonutCard } from './donut-card';
import { RankedCard } from './ranked-card';

export function EnquiriesPage({
  result,
  onRangeChange,
}: {
  result: AnalyticsResult<Enquiries>;
  onRangeChange: (days: AnalyticsRange) => void;
}) {
  return (
    <AnalyticsPage
      kind="enquiries"
      title="Enquiries"
      description="Forms sent through the website: which ones, about which location, and where those visits started. Counted from mid-November 2026."
      result={result}
      onRangeChange={onRangeChange}
      isEmpty={(data) => data.total === 0}
      emptyTitle="No enquiries yet"
      emptyDescription={(days) =>
        `Nobody has sent a form through the website in the last ${days} days. The website started counting enquiries here in mid-November 2026.`
      }
    >
      {(data, days) => <EnquiriesBody data={data} days={days} />}
    </AnalyticsPage>
  );
}

function EnquiriesBody({ data, days }: { data: Enquiries; days: AnalyticsRange }) {
  const every = axisEvery(days);
  const chart = data.daily.days.map((key, i) => ({
    key,
    label: longDate(key),
    axisLabel: (data.daily.days.length - 1 - i) % every === 0 ? shortDate(key) : undefined,
    values: { enquiries: data.daily.counts[i] ?? 0 },
  }));
  const rate = percentOf(data.enquiringVisits, data.visits);

  return (
    <div className="space-y-4 max-md:space-y-3">
      <div className="grid gap-4 max-md:gap-3 md:grid-cols-2">
        <Figure label="Enquiries" hint={`Sent in the last ${days} days`}>
          <RollingNumber value={data.total} />
        </Figure>
        <Figure
          label="Visits that enquired"
          hint={`${formatInteger(data.enquiringVisits)} of ${formatInteger(data.visits)} visits`}
        >
          {formatPercent(rate)}
        </Figure>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Enquiries per day</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart
            label="Enquiries per day"
            series={[{ key: 'enquiries', label: 'Enquiries', color: 'var(--primary)', area: true }]}
            data={chart}
            height={200}
            formatValue={(value) => formatInteger(value)}
            formatTick={(value) => (Number.isInteger(value) ? formatInteger(value) : '')}
            categoryLabel="Day"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 max-md:gap-3 lg:grid-cols-2">
        <DonutCard title="Forms" unit="enquiries" rows={data.forms} />
        <RankedCard title="Locations" counted="enquiries" rows={data.locations} />
        <RankedCard
          title="Sent from"
          counted="enquiries"
          rows={data.pages.map((p) => ({
            key: p.key,
            label: pageName({ path: p.key, title: p.title }),
            value: p.value,
            href: siteUrl(p.key),
          }))}
        />
        <RankedCard
          title="Where those visits started"
          counted="visits that enquired"
          rows={data.entries.map((e) => ({
            key: e.path,
            label: pageName(e),
            detail: `${formatPercent(percentOf(e.enquired, e.visits))} of the ${formatInteger(e.visits)} visits starting here enquired`,
            value: e.enquired,
            href: siteUrl(e.path),
          }))}
        />
      </div>
    </div>
  );
}

function Figure({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent className="mt-3 space-y-1">
        <p className="text-muted-foreground text-xs text-pretty">{hint}</p>
        <p className="text-3xl font-medium tracking-tight tabular-nums">{children}</p>
      </CardContent>
    </Card>
  );
}
