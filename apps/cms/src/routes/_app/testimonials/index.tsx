import { can } from '@llf/content';
import { createFileRoute } from '@tanstack/react-router';
import { TestimonialsPage } from '@/components/testimonials/testimonials-page';
import { listTestimonials } from '@/server/testimonials';

export const Route = createFileRoute('/_app/testimonials/')({
  loader: () => listTestimonials(),
  head: () => ({ meta: [{ title: 'Testimonials | Living Legacy Forest CMS' }] }),
  component: TestimonialsRoute,
});

function TestimonialsRoute() {
  const data = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  return <TestimonialsPage data={data} canWrite={can(user.role, 'content:write')} />;
}
