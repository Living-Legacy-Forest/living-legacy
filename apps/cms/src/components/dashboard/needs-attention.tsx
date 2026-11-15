import { Link, type LinkProps } from '@tanstack/react-router';
import {
  CalendarClockIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  Link2Off,
  ListTodo,
  type LucideIcon,
  PencilLineIcon,
  SendIcon,
  TriangleAlertIcon,
} from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { formatInteger, formatLongDate } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import type { Attention } from '@/server/dashboard';

type Task = {
  key: string;
  icon: LucideIcon;
  title: string;
  description: string;
  link: LinkProps;
};

const plural = (n: number, one: string, many: string) =>
  `${formatInteger(n)} ${n === 1 ? one : many}`;

/** Turns what needs doing into rows, most pressing first. Empty parts are left out. */
function buildTasks(attention: Attention, timeZone: string): Task[] {
  const tasks: Task[] = [];
  const { reviews, scheduledThisWeek, contentIssues, missingPages, upcomingEvents, system } =
    attention;

  // First: while something is down, posts and bookings below may not be what they seem.
  if (system && (system.jobs > 0 || system.health > 0)) {
    tasks.push({
      key: 'system',
      icon: TriangleAlertIcon,
      title: 'System needs a look',
      description: [
        system.health > 0 &&
          `${plural(system.health, 'health check is', 'health checks are')} failing.`,
        system.jobs > 0 &&
          `${plural(system.jobs, 'scheduled job has', 'scheduled jobs have')} failed or stopped.`,
      ]
        .filter(Boolean)
        .join(' '),
      link: { to: '/system' },
    });
  }
  if (reviews && reviews.total > 0) {
    tasks.push({
      key: 'reviews',
      icon: PencilLineIcon,
      title:
        reviews.forYou > 0
          ? `${plural(reviews.forYou, 'post', 'posts')} waiting for your review`
          : `${plural(reviews.total, 'post', 'posts')} in review`,
      description:
        reviews.forYou > 0
          ? 'Read them, then publish or send them back to the author.'
          : 'Someone else was asked to review these.',
      link: { to: '/posts', search: { status: 'review' } },
    });
  }
  if (upcomingEvents?.next) {
    const { next, total, days } = upcomingEvents;
    tasks.push({
      key: 'events',
      icon: CalendarClockIcon,
      title: `${next.title}, ${formatLongDate(next.startsAt, timeZone)}`,
      description: [
        `${plural(next.guests, 'guest', 'guests')} booked`,
        total > 1 && `${plural(total - 1, 'more event', 'more events')} in the next ${days} days`,
      ]
        .filter(Boolean)
        .join(' · '),
      link: { to: '/events/$eventId', params: { eventId: next.id } },
    });
  }
  if (missingPages && missingPages.total > 0) {
    tasks.push({
      key: 'missing',
      icon: Link2Off,
      title: `${plural(missingPages.total, 'link leads', 'links lead')} nowhere`,
      description: missingPages.busiest
        ? `Busiest: ${missingPages.busiest.path} (${plural(missingPages.busiest.hits, 'visit', 'visits')}). Redirect it or dismiss it.`
        : 'Redirect them or dismiss them.',
      link: { to: '/redirects', search: { view: 'missing' } },
    });
  }
  if (contentIssues) {
    tasks.push({
      key: 'checks',
      icon: ListTodo,
      title: `${plural(contentIssues, 'gap', 'gaps')} in published content`,
      description:
        'Missing descriptions, share images or alt text that visitors and search engines notice.',
      link: { to: '/checks' },
    });
  }
  if (scheduledThisWeek) {
    tasks.push({
      key: 'scheduled',
      icon: SendIcon,
      title: `${plural(scheduledThisWeek, 'post goes', 'posts go')} live this week`,
      description: 'Scheduled to publish on their own. Check them over before they do.',
      link: { to: '/posts', search: { status: 'scheduled' } },
    });
  }
  return tasks;
}

/** The dashboard's to-do list: what needs someone, linked to where they fix it. */
export function NeedsAttention({ attention }: { attention: Attention }) {
  const timeZone = useTimeZone();
  const tasks = buildTasks(attention, timeZone);

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
        <CardDescription>What is waiting on you, and where to sort it out.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {tasks.length === 0 ? (
          <Empty className="min-h-56 border py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CircleCheckIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-sm">All clear</EmptyTitle>
              <EmptyDescription>Nothing is waiting on you right now.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup className="gap-0 max-md:divide-y max-md:divide-(--ios-separator)">
            {tasks.map((task) => (
              <Item
                key={task.key}
                size="sm"
                className="touch:min-h-11 -mx-2 px-2"
                render={<Link {...task.link} />}
              >
                <ItemMedia variant="icon">
                  <task.icon aria-hidden />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="line-clamp-2">{task.title}</ItemTitle>
                  <ItemDescription>{task.description}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ChevronRightIcon aria-hidden className="text-muted-foreground/60 size-4" />
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  );
}
