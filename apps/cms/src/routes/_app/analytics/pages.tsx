import { createFileRoute } from '@tanstack/react-router';
import { rangeSearch } from '@/components/analytics/analytics-page';
import { PagesPage } from '@/components/analytics/pages-page';
import { DEFAULT_RANGE, analyticsSearch } from '@/lib/analytics';
import { getAnalyticsPages } from '@/server/analytics';

export const Route = createFileRoute('/_app/analytics/pages')({
  validateSearch: analyticsSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getAnalyticsPages({ data: { days: deps.days ?? DEFAULT_RANGE } }),
  head: () => ({ meta: [{ title: 'Pages | Living Legacy CMS' }] }),
  component: AnalyticsRoute,
});

function AnalyticsRoute() {
  const result = Route.useLoaderData();
  const navigate = Route.useNavigate();
  return (
    <PagesPage result={result} onRangeChange={(days) => navigate({ search: rangeSearch(days) })} />
  );
}
