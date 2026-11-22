import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { IntegrationsPage } from '@/components/integrations/integrations-page';
import { getCmsOrigin, listApiKeys } from '@/server/api-keys';

export const Route = createFileRoute('/_app/integrations/')({
  beforeLoad: ({ context }) => {
    if (!can(context.user, 'settings:write')) throw redirect({ to: '/' });
  },
  loader: async () => {
    const [keys, origin] = await Promise.all([listApiKeys(), getCmsOrigin()]);
    return { keys, origin };
  },
  head: () => ({ meta: [{ title: 'API keys | Living Legacy CMS' }] }),
  component: IntegrationsRoute,
});

function IntegrationsRoute() {
  const { keys, origin } = Route.useLoaderData();
  return <IntegrationsPage keys={keys} origin={origin} />;
}
