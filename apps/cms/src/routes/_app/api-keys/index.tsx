import { can } from '@llf/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { ApiKeysPage } from '@/components/api-keys/api-keys-page';
import { listApiKeys } from '@/server/api-keys';

export const Route = createFileRoute('/_app/api-keys/')({
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'settings:write')) throw redirect({ to: '/' });
  },
  loader: () => listApiKeys(),
  head: () => ({ meta: [{ title: 'API keys | Living Legacy CMS' }] }),
  component: ApiKeysRoute,
});

function ApiKeysRoute() {
  const keys = Route.useLoaderData();
  return <ApiKeysPage keys={keys} />;
}
