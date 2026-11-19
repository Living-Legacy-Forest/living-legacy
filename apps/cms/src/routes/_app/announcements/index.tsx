import { can } from '@ll/content';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { AnnouncementsPage } from '@/components/announcements/announcements-page';
import { listAnnouncements } from '@/server/announcements';

export const Route = createFileRoute('/_app/announcements/')({
  validateSearch: z.object({
    // An announcement to open on arrival, from Content checks.
    edit: z.string().max(40).optional().catch(undefined),
    // The list's order, read by useListSort; a schema drops any key it does not name.
    sort: z.string().max(30).optional().catch(undefined),
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
      // Once it is open, `edit` leaves the address so a reload does not reopen it; the sort stays.
      onOpenedInitial={() =>
        void navigate({ search: (s) => ({ ...s, edit: undefined }), replace: true })
      }
    />
  );
}
