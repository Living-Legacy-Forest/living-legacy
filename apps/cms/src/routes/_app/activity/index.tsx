import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { ActivityPage } from '@/components/activity/activity-page';
import { pageSizeParam } from '@/lib/page-size';
import { ACTIVITY_PAGE_SIZES, activityKinds, listActivity } from '@/server/activity-log';

const searchSchema = z.object({
  page: z.number().int().min(1).optional().catch(undefined),
  /** Entries a page, when not the usual 15. */
  rows: pageSizeParam(ACTIVITY_PAGE_SIZES),
  /** One kind of change: posts, events, people and so on. */
  kind: z.enum(activityKinds).optional().catch(undefined),
  /** One person, by user id. */
  who: z.string().max(64).optional().catch(undefined),
  /** One day picked on the calendar, YYYY-MM-DD in the site's time zone. */
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute('/_app/activity/')({
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (!can(context.user, 'posts:publish')) throw redirect({ to: '/' });
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listActivity({ data: { ...deps, page: deps.page ?? 1 } }),
  head: () => ({ meta: [{ title: 'Activity | Living Legacy CMS' }] }),
  component: ActivityRoute,
});

function ActivityRoute() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const { user } = Route.useRouteContext();
  return <ActivityPage data={data} search={search} canClearLog={user.isSuperAdmin} />;
}
