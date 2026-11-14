import { createFileRoute } from '@tanstack/react-router';
import { rangeSearch } from '@/components/analytics/analytics-page';
import { TrafficPage } from '@/components/analytics/traffic-page';
import { DEFAULT_RANGE, analyticsSearch } from '@/lib/analytics';
import { getAnalyticsTraffic } from '@/server/analytics';

export const Route = createFileRoute('/_app/analytics/traffic')({
  validateSearch: analyticsSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getAnalyticsTraffic({ data: { days: deps.days ?? DEFAULT_RANGE } }),
  head: () => ({ meta: [{ title: 'Traffic | Living Legacy CMS' }] }),
  component: AnalyticsRoute,
});

function AnalyticsRoute() {
  const result = Route.useLoaderData();
  const navigate = Route.useNavigate();
  return (
    <TrafficPage
      result={result}
      onRangeChange={(days) => navigate({ search: rangeSearch(days) })}
    />
  );
}
