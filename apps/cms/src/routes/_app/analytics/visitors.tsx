import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { VisitorsPage } from '@/components/visitors/visitors-page';
import { VISITOR_PAGE_SIZES, VISITOR_RANGES, type VisitorPageSize } from '@/lib/visitors';
import { listVisitors } from '@/server/visitors';

const searchSchema = z.object({
  page: z.number().int().min(1).optional().catch(undefined),
  /** 7, 30 or 90 days; 30 when left out. */
  days: z
    .number()
    .refine((d) => (VISITOR_RANGES as readonly number[]).includes(d))
    .optional()
    .catch(undefined),
  /** Visits a page; 50 when left out. */
  rows: z
    .number()
    .refine((n) => (VISITOR_PAGE_SIZES as readonly number[]).includes(n))
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute('/_app/analytics/visitors')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    listVisitors({
      data: {
        days: (deps.days ?? 30) as 7 | 30 | 90,
        page: deps.page ?? 1,
        rows: (deps.rows ?? 50) as VisitorPageSize,
      },
    }),
  head: () => ({ meta: [{ title: 'Visitors | Living Legacy CMS' }] }),
  component: VisitorsRoute,
});

function VisitorsRoute() {
  const data = Route.useLoaderData();
  return <VisitorsPage data={data} />;
}
