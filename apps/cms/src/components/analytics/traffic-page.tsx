import { type AnalyticsRange, channelLabels } from '@/lib/analytics';
import type { AnalyticsResult, Traffic } from '@/server/analytics';
import { AnalyticsPage } from './analytics-page';
import { DonutCard } from './donut-card';
import { RankedCard } from './ranked-card';

export function TrafficPage({
  result,
  onRangeChange,
}: {
  result: AnalyticsResult<Traffic>;
  onRangeChange: (days: AnalyticsRange) => void;
}) {
  return (
    <AnalyticsPage
      title="Traffic"
      description="Where visits come from: search engines, social media, other websites, campaign links, or straight to the address."
      result={result}
      onRangeChange={onRangeChange}
      isEmpty={(data) => data.visits === 0}
    >
      {(data) => (
        <div className="grid gap-4 max-md:gap-3 lg:grid-cols-2">
          <DonutCard
            title="Channels"
            unit="visits"
            rows={data.channels.map((c) => ({ ...c, label: channelLabels[c.key] }))}
          />
          <DonutCard
            title="Websites that sent visits"
            unit="visits"
            emptyLabel="All came direct"
            rows={data.referrers}
          />
          <RankedCard
            className="lg:col-span-2"
            title="Campaigns"
            counted="visits"
            total={data.visits}
            emptyLabel="No visits came from a campaign link (one with utm_source or utm_campaign in it)."
            rows={data.campaigns.map((c) => ({
              key: [c.source, c.medium, c.campaign].join('|'),
              label: c.campaign ?? c.source,
              detail: [c.campaign ? c.source : null, c.medium].filter(Boolean).join(' · '),
              value: c.visits,
            }))}
          />
        </div>
      )}
    </AnalyticsPage>
  );
}
