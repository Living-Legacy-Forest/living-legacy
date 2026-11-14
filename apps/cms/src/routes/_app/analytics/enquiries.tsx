import { createFileRoute } from '@tanstack/react-router';
import { rangeSearch } from '@/components/analytics/analytics-page';
import { EnquiriesPage } from '@/components/analytics/enquiries-page';
import { DEFAULT_RANGE, analyticsSearch } from '@/lib/analytics';
import { getAnalyticsEnquiries } from '@/server/analytics';

export const Route = createFileRoute('/_app/analytics/enquiries')({
  validateSearch: analyticsSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getAnalyticsEnquiries({ data: { days: deps.days ?? DEFAULT_RANGE } }),
  head: () => ({ meta: [{ title: 'Enquiries | Living Legacy CMS' }] }),
  component: AnalyticsRoute,
});

function AnalyticsRoute() {
  const result = Route.useLoaderData();
  const navigate = Route.useNavigate();
  return (
    <EnquiriesPage
      result={result}
      onRangeChange={(days) => navigate({ search: rangeSearch(days) })}
    />
  );
}
