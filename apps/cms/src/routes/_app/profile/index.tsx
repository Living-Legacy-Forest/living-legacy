import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ProfilePage } from '@/components/profile/profile-page';

export const Route = createFileRoute('/_app/profile/')({
  validateSearch: z.object({ emailConfirmed: z.string().optional() }),
  head: () => ({ meta: [{ title: 'Your profile | Living Legacy CMS' }] }),
  component: ProfileRoute,
});

function ProfileRoute() {
  const { user } = Route.useRouteContext();
  const { emailConfirmed } = Route.useSearch();
  return <ProfilePage user={user} justConfirmedEmail={Boolean(emailConfirmed)} />;
}
