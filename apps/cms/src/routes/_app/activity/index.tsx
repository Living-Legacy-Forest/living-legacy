import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { ActivityPage } from '@/components/activity/activity-page';
import { listActivity } from '@/server/activity-log';

const searchSchema = z.object({
  page: z.number().int().min(1).optional().catch(undefined),
});

export const Route = createFileRoute('/_app/activity/')({
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'posts:publish')) throw redirect({ to: '/' });
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listActivity({ data: { page: deps.page ?? 1 } }),
  head: () => ({ meta: [{ title: 'Activity | Living Legacy CMS' }] }),
  component: ActivityRoute,
});

function ActivityRoute() {
  const data = Route.useLoaderData();
  return <ActivityPage data={data} />;
}
