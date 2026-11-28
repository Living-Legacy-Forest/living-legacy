import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { SecurityPage } from '@/components/profile/security-page';
import { getPasskeysEnabled } from '@/lib/session';

export const Route = createFileRoute('/_app/profile/security')({
  validateSearch: z.object({ emailConfirmed: z.string().optional() }),
  loader: async () => ({ passkeys: await getPasskeysEnabled() }),
  head: () => ({ meta: [{ title: 'Sign-in & devices | Living Legacy CMS' }] }),
  component: SecurityRoute,
});

function SecurityRoute() {
  const { user } = Route.useRouteContext();
  const { emailConfirmed } = Route.useSearch();
  const { passkeys } = Route.useLoaderData();
  return (
    <SecurityPage user={user} justConfirmedEmail={Boolean(emailConfirmed)} passkeys={passkeys} />
  );
}
