import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { VisitorsPage } from '@/components/visitors/visitors-page';
import { VISITOR_RANGES } from '@/lib/visitors';
import { listVisitors } from '@/server/visitors';

const searchSchema = z.object({
  page: z.number().int().min(1).optional().catch(undefined),
  /** 7, 30 or 90 days; 30 when left out. */
  days: z
    .number()
    .refine((d) => (VISITOR_RANGES as readonly number[]).includes(d))
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute('/_app/visitors/')({
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'posts:publish')) throw redirect({ to: '/' });
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    listVisitors({ data: { days: (deps.days ?? 30) as 7 | 30 | 90, page: deps.page ?? 1 } }),
  head: () => ({ meta: [{ title: 'Visitors | Living Legacy CMS' }] }),
  component: VisitorsRoute,
});

function VisitorsRoute() {
  const data = Route.useLoaderData();
  return <VisitorsPage data={data} />;
}
