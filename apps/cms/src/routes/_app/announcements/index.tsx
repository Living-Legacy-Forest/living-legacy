import { can } from '@ll/content';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { AnnouncementsPage } from '@/components/announcements/announcements-page';
import { listAnnouncements } from '@/server/announcements';

export const Route = createFileRoute('/_app/announcements/')({
  validateSearch: z.object({
    // An announcement to open on arrival, from Content checks.
    edit: z.string().max(40).optional().catch(undefined),
  }),
  loader: () => listAnnouncements(),
  head: () => ({ meta: [{ title: 'Announcements | Living Legacy CMS' }] }),
  component: AnnouncementsRoute,
});

function AnnouncementsRoute() {
  const data = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  const { edit } = Route.useSearch();
  const navigate = useNavigate({ from: '/announcements/' });
  return (
    <AnnouncementsPage
      data={data}
      canWrite={can(user.role, 'content:write')}
      initialEdit={edit}
      // Once it is open the address goes back to /announcements, so a reload does not reopen it.
      onOpenedInitial={() => void navigate({ search: {}, replace: true })}
    />
  );
}
