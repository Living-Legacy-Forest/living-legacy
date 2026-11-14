import { createFileRoute } from '@tanstack/react-router';
import { rangeSearch } from '@/components/analytics/analytics-page';
import { AudiencePage } from '@/components/analytics/audience-page';
import { DEFAULT_RANGE, analyticsSearch } from '@/lib/analytics';
import { getAnalyticsAudience } from '@/server/analytics';

export const Route = createFileRoute('/_app/analytics/audience')({
  validateSearch: analyticsSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getAnalyticsAudience({ data: { days: deps.days ?? DEFAULT_RANGE } }),
  head: () => ({ meta: [{ title: 'Audience | Living Legacy CMS' }] }),
  component: AnalyticsRoute,
});

function AnalyticsRoute() {
  const result = Route.useLoaderData();
  const navigate = Route.useNavigate();
  return (
    <AudiencePage
      result={result}
      onRangeChange={(days) => navigate({ search: rangeSearch(days) })}
    />
  );
}
