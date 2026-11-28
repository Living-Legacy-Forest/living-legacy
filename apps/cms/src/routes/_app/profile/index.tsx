import { createFileRoute } from '@tanstack/react-router';
import { ProfilePage } from '@/components/profile/profile-page';
import { getMyActivity } from '@/server/activity-log';

export const Route = createFileRoute('/_app/profile/')({
  loader: async () => ({ activity: await getMyActivity() }),
  head: () => ({ meta: [{ title: 'Your profile | Living Legacy CMS' }] }),
  component: ProfileRoute,
});

function ProfileRoute() {
  const { user } = Route.useRouteContext();
  const { activity } = Route.useLoaderData();
  return <ProfilePage user={user} activity={activity} />;
}
