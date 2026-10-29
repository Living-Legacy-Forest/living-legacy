import { can } from '@llf/content';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { TestimonialsPage } from '@/components/testimonials/testimonials-page';
import { listTestimonials } from '@/server/testimonials';

export const Route = createFileRoute('/_app/testimonials/')({
  validateSearch: z.object({ selected: z.string().optional().catch(undefined) }),
  loader: () => listTestimonials(),
  head: () => ({ meta: [{ title: 'Testimonials | Living Legacy Forest CMS' }] }),
  component: TestimonialsRoute,
});

function TestimonialsRoute() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const { user } = Route.useRouteContext();
  return (
    <TestimonialsPage data={data} search={search} canWrite={can(user.role, 'content:write')} />
  );
}
