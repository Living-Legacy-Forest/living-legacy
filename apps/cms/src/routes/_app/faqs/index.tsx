import { can } from '@ll/content';
import { createFileRoute } from '@tanstack/react-router';
import { FaqsPage } from '@/components/faqs/faqs-page';
import { listFaqs } from '@/server/faqs';

export const Route = createFileRoute('/_app/faqs/')({
  loader: () => listFaqs(),
  head: () => ({ meta: [{ title: 'FAQs | Living Legacy CMS' }] }),
  component: FaqsRoute,
});

function FaqsRoute() {
  const data = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  return <FaqsPage data={data} canWrite={can(user.role, 'content:write')} />;
}
