import type { AnalyticsRange, Ranked } from '@/lib/analytics';
import { flagEmoji } from '@/lib/visitors';
import type { AnalyticsResult, AudiencePage as AudienceData } from '@/server/analytics';
import { AnalyticsPage } from './analytics-page';
import { DonutCard } from './donut-card';
import { StreamCard } from './stream-card';

/** "🇦🇺 Australia": the flag in the label, so it shows in the legend and the ring's centre. */
const flagged = <Row extends Ranked & { code: string | null }>(row: Row): Ranked => ({
  key: row.key,
  label: `${flagEmoji(row.code) || '🌐'} ${row.label}`,
  value: row.value,
});

// An odd card out in the last row takes the whole row, rather than leave half of it empty.
export function AudiencePage({
  result,
  onRangeChange,
}: {
  result: AnalyticsResult<AudienceData>;
  onRangeChange: (days: AnalyticsRange) => void;
}) {
  return (
    <AnalyticsPage
      kind="audience"
      title="Audience"
      description="Where visitors are, worked out from their network, and the devices and browsers they use. No IP addresses are kept here."
      result={result}
      onRangeChange={onRangeChange}
      isEmpty={(data) => data.visits === 0}
    >
      {(data) => (
        <div className="grid gap-4 max-md:gap-3 lg:grid-cols-2 lg:[&>:last-child:nth-child(odd)]:col-span-2">
          <DonutCard title="Countries" unit="visits" rows={data.countries.map(flagged)} />
          <DonutCard title="Cities" unit="visits" rows={data.cities.map(flagged)} />
          <DonutCard title="Devices" unit="visits" rows={data.devices} />
          <DonutCard title="Browsers" unit="visits" rows={data.browsers} />
          <StreamCard
            className="lg:col-span-2"
            title="Visits over time, by device"
            unit="visits"
            split={data.devicesDaily}
          />
          <DonutCard
            className="lg:col-span-2"
            title="Operating systems"
            unit="visits"
            rows={data.systems}
          />
        </div>
      )}
    </AnalyticsPage>
  );
}
