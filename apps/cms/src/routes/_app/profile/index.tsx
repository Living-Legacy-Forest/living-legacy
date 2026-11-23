import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ProfilePage } from '@/components/profile/profile-page';
import { getPasskeysEnabled } from '@/lib/session';
import { getMyActivity } from '@/server/activity-log';

export const Route = createFileRoute('/_app/profile/')({
  validateSearch: z.object({ emailConfirmed: z.string().optional() }),
  loader: async () => {
    const [activity, passkeys] = await Promise.all([getMyActivity(), getPasskeysEnabled()]);
    return { activity, passkeys };
  },
  head: () => ({ meta: [{ title: 'Your profile | Living Legacy CMS' }] }),
  component: ProfileRoute,
});

function ProfileRoute() {
  const { user } = Route.useRouteContext();
  const { emailConfirmed } = Route.useSearch();
  const { activity, passkeys } = Route.useLoaderData();
  return (
    <ProfilePage
      user={user}
      activity={activity}
      justConfirmedEmail={Boolean(emailConfirmed)}
      passkeys={passkeys}
    />
  );
}
