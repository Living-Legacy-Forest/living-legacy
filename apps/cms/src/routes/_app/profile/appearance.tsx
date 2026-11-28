import { createFileRoute } from '@tanstack/react-router';
import { AppearancePage } from '@/components/profile/appearance-page';

export const Route = createFileRoute('/_app/profile/appearance')({
  head: () => ({ meta: [{ title: 'Appearance | Living Legacy CMS' }] }),
  component: AppearancePage,
});
