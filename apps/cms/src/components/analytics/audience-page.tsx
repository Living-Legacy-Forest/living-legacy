import type { AnalyticsRange } from '@/lib/analytics';
import type { AnalyticsResult, AudiencePage as AudienceData } from '@/server/analytics';
import { AnalyticsPage } from './analytics-page';
import { DonutCard } from './donut-card';
import { PlacesCard } from './places-card';
import { StreamCard } from './stream-card';

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
          <PlacesCard className="lg:col-span-2" data={data} />
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
