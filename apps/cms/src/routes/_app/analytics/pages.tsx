import { createFileRoute } from '@tanstack/react-router';
import { rangeSearch } from '@/components/analytics/analytics-page';
import { PagesPage } from '@/components/analytics/pages-page';
import { DEFAULT_PAGE_SIZE, DEFAULT_RANGE, type PageSize, pagesSearch } from '@/lib/analytics';
import { getAnalyticsPages } from '@/server/analytics';

export const Route = createFileRoute('/_app/analytics/pages')({
  validateSearch: pagesSearch,
  // Paging happens in the browser, so only the period asks the server again.
  loaderDeps: ({ search }) => ({ days: search.days }),
  loader: ({ deps }) => getAnalyticsPages({ data: { days: deps.days ?? DEFAULT_RANGE } }),
  head: () => ({ meta: [{ title: 'Pages | Living Legacy CMS' }] }),
  component: AnalyticsRoute,
});

function AnalyticsRoute() {
  const result = Route.useLoaderData();
  const { page = 1, rows = DEFAULT_PAGE_SIZE } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PagesPage
      result={result}
      page={page}
      rows={rows as PageSize}
      // A new period starts again from the first page, keeping the rows chosen.
      onRangeChange={(days) =>
        navigate({ search: (s) => ({ ...s, ...rangeSearch(days), page: undefined }) })
      }
    />
  );
}
