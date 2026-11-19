import { createFileRoute } from '@tanstack/react-router';
import { CalendarPage } from '@/components/calendar/calendar-page';
import { calendarSearch, getCalendar } from '@/server/calendar';

export const Route = createFileRoute('/_app/calendar/')({
  validateSearch: calendarSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => ({ data: await getCalendar({ data: deps }), now: Date.now() }),
  head: () => ({ meta: [{ title: 'Content calendar | Living Legacy CMS' }] }),
  component: CalendarRoute,
});

function CalendarRoute() {
  const { data, now } = Route.useLoaderData();
  return <CalendarPage data={data} now={now} />;
}
