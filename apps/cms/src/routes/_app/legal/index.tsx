import { createFileRoute } from '@tanstack/react-router';
import { LegalPagesList } from '@/components/legal/legal-pages-list';
import { listLegalPages } from '@/server/legal-pages';

export const Route = createFileRoute('/_app/legal/')({
  loader: () => listLegalPages(),
  head: () => ({ meta: [{ title: 'Legal pages | Living Legacy CMS' }] }),
  component: () => <LegalPagesList pages={Route.useLoaderData()} />,
});
