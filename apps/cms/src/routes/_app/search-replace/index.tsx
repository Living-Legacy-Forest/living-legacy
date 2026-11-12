import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { SearchReplacePage } from '@/components/search-replace/search-replace-page';

export const Route = createFileRoute('/_app/search-replace/')({
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'content:replace')) throw redirect({ to: '/' });
  },
  head: () => ({ meta: [{ title: 'Search & replace | Living Legacy CMS' }] }),
  component: SearchReplacePage,
});
