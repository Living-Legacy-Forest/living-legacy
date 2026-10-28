import { createFileRoute } from '@tanstack/react-router';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/_app/')({
  head: () => ({ meta: [{ title: 'Dashboard | Living Legacy Forest CMS' }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const firstName = user.name.split(' ')[0];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-3xl">Welcome, {firstName}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Content</CardTitle>
          <CardDescription>
            Posts, media, FAQs, testimonials and team members will appear here as each section of
            the CMS is built.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
