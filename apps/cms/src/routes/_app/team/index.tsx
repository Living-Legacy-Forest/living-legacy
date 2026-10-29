import { can } from '@llf/content';
import { createFileRoute } from '@tanstack/react-router';
import { TeamPage } from '@/components/team/team-page';
import { listTeamMembers } from '@/server/team';

export const Route = createFileRoute('/_app/team/')({
  loader: () => listTeamMembers(),
  head: () => ({ meta: [{ title: 'Team | Living Legacy Forest CMS' }] }),
  component: TeamRoute,
});

function TeamRoute() {
  const data = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  return <TeamPage data={data} canWrite={can(user.role, 'content:write')} />;
}
