import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { ActivityPage } from '@/components/activity/activity-page';
import { activityKinds, listActivity } from '@/server/activity-log';

const searchSchema = z.object({
  page: z.number().int().min(1).optional().catch(undefined),
  /** One kind of change: posts, events, people and so on. */
  kind: z.enum(activityKinds).optional().catch(undefined),
  /** One person, by user id. */
  who: z.string().max(64).optional().catch(undefined),
});

export const Route = createFileRoute('/_app/activity/')({
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'posts:publish')) throw redirect({ to: '/' });
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listActivity({ data: { ...deps, page: deps.page ?? 1 } }),
  head: () => ({ meta: [{ title: 'Activity | Living Legacy CMS' }] }),
  component: ActivityRoute,
});

function ActivityRoute() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  return <ActivityPage data={data} search={search} />;
}
