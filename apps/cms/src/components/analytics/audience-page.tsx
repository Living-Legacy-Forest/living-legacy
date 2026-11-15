import type { AnalyticsRange } from '@/lib/analytics';
import { flagEmoji } from '@/lib/visitors';
import type { AnalyticsResult, Audience } from '@/server/analytics';
import { AnalyticsPage } from './analytics-page';
import { DonutCard } from './donut-card';
import { RankedCard } from './ranked-card';

const flag = (code: string | null) => (
  <span aria-hidden className="text-base leading-none">
    {flagEmoji(code) || '🌐'}
  </span>
);

export function AudiencePage({
  result,
  onRangeChange,
}: {
  result: AnalyticsResult<Audience>;
  onRangeChange: (days: AnalyticsRange) => void;
}) {
  return (
    <AnalyticsPage
      title="Audience"
      description="Where visitors are, worked out from their network, and the devices and browsers they use. No IP addresses are kept here."
      result={result}
      onRangeChange={onRangeChange}
      isEmpty={(data) => data.visits === 0}
    >
      {(data) => (
        <div className="grid gap-4 max-md:gap-3 lg:grid-cols-2">
          <RankedCard
            title="Countries"
            counted="visits"
            total={data.visits}
            limit={15}
            rows={data.countries.map((c) => ({ ...c, leading: flag(c.code) }))}
          />
          <RankedCard
            title="Cities"
            counted="visits"
            total={data.visits}
            limit={15}
            rows={data.cities.map((c) => ({ ...c, leading: flag(c.code) }))}
          />
          <DonutCard title="Devices" unit="visits" rows={data.devices} />
          <RankedCard
            title="Browsers"
            counted="visits"
            total={data.visits}
            limit={10}
            rows={data.browsers}
          />
          <RankedCard
            className="lg:col-span-2"
            title="Operating systems"
            counted="visits"
            total={data.visits}
            limit={10}
            rows={data.systems}
          />
        </div>
      )}
    </AnalyticsPage>
  );
}
