import { type AnalyticsRange, channelLabels } from '@/lib/analytics';
import type { AnalyticsResult, Traffic } from '@/server/analytics';
import { AnalyticsPage } from './analytics-page';
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
          <RankedCard
            title="Channels"
            counted="visits"
            total={data.visits}
            rows={data.channels.map((c) => ({
              key: c.key,
              label: channelLabels[c.key],
              value: c.value,
            }))}
          />
          <RankedCard
            title="Websites that sent visits"
            counted="visits"
            total={data.visits}
            limit={15}
            emptyLabel="Every visit came straight to the website."
            rows={data.referrers.map((r) => ({
              key: r.key,
              label: r.label,
              detail: channelLabels[r.channel],
              value: r.value,
            }))}
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
