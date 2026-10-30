import { can } from '@llf/content';
import { createFileRoute } from '@tanstack/react-router';
import { AnnouncementsPage } from '@/components/announcements/announcements-page';
import { listAnnouncements } from '@/server/announcements';

export const Route = createFileRoute('/_app/announcements/')({
  loader: () => listAnnouncements(),
  head: () => ({ meta: [{ title: 'Announcements | Living Legacy CMS' }] }),
  component: AnnouncementsRoute,
});

function AnnouncementsRoute() {
  const data = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  return <AnnouncementsPage data={data} canWrite={can(user.role, 'content:write')} />;
}
