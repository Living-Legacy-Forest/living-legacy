import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ProfilePage } from '@/components/profile/profile-page';
import { getMyActivity } from '@/server/activity-log';

export const Route = createFileRoute('/_app/profile/')({
  validateSearch: z.object({ emailConfirmed: z.string().optional() }),
  loader: () => getMyActivity(),
  head: () => ({ meta: [{ title: 'Your profile | Living Legacy CMS' }] }),
  component: ProfileRoute,
});

function ProfileRoute() {
  const { user } = Route.useRouteContext();
  const { emailConfirmed } = Route.useSearch();
  const activity = Route.useLoaderData();
  return (
    <ProfilePage user={user} activity={activity} justConfirmedEmail={Boolean(emailConfirmed)} />
  );
}
