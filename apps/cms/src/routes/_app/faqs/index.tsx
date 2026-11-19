import { can } from '@ll/content';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { FaqsPage } from '@/components/faqs/faqs-page';
import { listFaqs } from '@/server/faqs';

export const Route = createFileRoute('/_app/faqs/')({
  validateSearch: z.object({
    // An FAQ to open on arrival, from Content checks.
    edit: z.string().max(40).optional().catch(undefined),
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
      canWrite={can(user.role, 'content:write')}
      initialEdit={edit}
      // Once it is open the address goes back to /faqs, so a reload does not reopen it.
      onOpenedInitial={() => void navigate({ search: {}, replace: true })}
    />
  );
}
