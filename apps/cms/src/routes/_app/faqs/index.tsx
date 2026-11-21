import { can } from '@ll/content';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { FaqsPage } from '@/components/faqs/faqs-page';
import { listFaqs } from '@/server/faqs';

export const Route = createFileRoute('/_app/faqs/')({
  validateSearch: z.object({
    // An FAQ to open on arrival, from Content checks.
    edit: z.string().max(40).optional().catch(undefined),
    // The list's order, read by useListSort; a schema drops any key it does not name.
    sort: z.string().max(30).optional().catch(undefined),
  }),
  loader: () => listFaqs(),
  head: () => ({ meta: [{ title: 'FAQs | Living Legacy CMS' }] }),
  component: FaqsRoute,
});

function FaqsRoute() {
  const data = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  const { edit } = Route.useSearch();
  const navigate = useNavigate({ from: '/faqs/' });
  return (
    <FaqsPage
      data={data}
      canWrite={can(user, 'content:write')}
      initialEdit={edit}
      // Once it is open, `edit` leaves the address so a reload does not reopen it; the sort stays.
      onOpenedInitial={() =>
        void navigate({ search: (s) => ({ ...s, edit: undefined }), replace: true })
      }
    />
  );
}
