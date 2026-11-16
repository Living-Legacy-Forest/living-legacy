import { createFileRoute } from '@tanstack/react-router';
import { WhatsNewPage } from '@/components/whats-new/whats-new-page';

export const Route = createFileRoute('/_app/whats-new/')({
  head: () => ({ meta: [{ title: "What's new | Living Legacy CMS" }] }),
  component: WhatsNewPage,
});
