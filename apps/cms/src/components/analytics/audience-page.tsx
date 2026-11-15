import type { AnalyticsRange } from '@/lib/analytics';
import type { AnalyticsResult, AudiencePage as AudienceData } from '@/server/analytics';
import { AnalyticsPage } from './analytics-page';
import { DonutCard } from './donut-card';
import { PlacesCard } from './places-card';
import { StreamCard } from './stream-card';

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
        <div className="grid gap-4 max-md:gap-3 lg:grid-cols-3">
          <PlacesCard className="lg:col-span-3" data={data} />
          <DonutCard title="Devices" unit="visits" rows={data.devices} />
          <DonutCard title="Browsers" unit="visits" rows={data.browsers} />
          <DonutCard title="Operating systems" unit="visits" rows={data.systems} />
          <StreamCard
            className="lg:col-span-3"
            title="Visits over time, by device"
            unit="visits"
            split={data.devicesDaily}
          />
        </div>
      )}
    </AnalyticsPage>
  );
}
