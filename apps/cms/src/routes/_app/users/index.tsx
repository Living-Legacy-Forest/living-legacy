import { can } from '@llf/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { UsersPage } from '@/components/users/users-page';
import { listUsers } from '@/server/users';

export const Route = createFileRoute('/_app/users/')({
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'users:manage')) throw redirect({ to: '/' });
  },
  loader: () => listUsers(),
  head: () => ({ meta: [{ title: 'Users | Living Legacy CMS' }] }),
  component: UsersRoute,
});

function UsersRoute() {
  const data = Route.useLoaderData();
  return <UsersPage data={data} />;
}
