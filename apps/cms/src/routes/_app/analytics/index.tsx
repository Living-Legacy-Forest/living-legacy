import { createFileRoute } from '@tanstack/react-router';
import { rangeSearch } from '@/components/analytics/analytics-page';
import { OverviewPage } from '@/components/analytics/overview-page';
import { DEFAULT_RANGE, analyticsSearch } from '@/lib/analytics';
import { getAnalyticsOverview } from '@/server/analytics';

export const Route = createFileRoute('/_app/analytics/')({
  validateSearch: analyticsSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getAnalyticsOverview({ data: { days: deps.days ?? DEFAULT_RANGE } }),
  head: () => ({ meta: [{ title: 'Analytics | Living Legacy CMS' }] }),
  component: AnalyticsRoute,
});

function AnalyticsRoute() {
  const result = Route.useLoaderData();
  const navigate = Route.useNavigate();
  return (
    <OverviewPage
      result={result}
      onRangeChange={(days) => navigate({ search: rangeSearch(days) })}
    />
  );
}
