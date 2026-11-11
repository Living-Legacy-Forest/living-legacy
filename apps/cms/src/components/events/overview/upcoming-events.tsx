import { Link } from '@tanstack/react-router';
import { CalendarClockIcon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { formatInteger, formatTimeRange } from '@/lib/format';
import type { EventsOverview } from '@/server/event-stats';

type Upcoming = EventsOverview['upcoming'][number];

const SHOWN = 8;
/** Bookings closing within this long earn a flag. */
const CLOSING_MS = 3 * 86_400_000;

/** What needs a look about one event date, most pressing first. */
function flag(event: Upcoming, now: number) {
  if (event.capacity !== null && event.booked >= event.capacity) return 'Full';
  if (event.booked === 0) return 'No bookings yet';
  const closes = event.bookingsCloseAt ?? event.startsAt;
  if (closes > now && closes - now < CLOSING_MS) return 'Bookings close soon';
  return null;
}

function dayLabel(event: Upcoming) {
  return new Date(event.startsAt).toLocaleDateString('en-AU', {
    timeZone: event.timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** The next month's event dates, each with how full it is. */
export function UpcomingEvents({ events, now }: { events: Upcoming[]; now: number }) {
  return (
    <Card className="col-span-2 lg:col-span-4">
      <CardHeader>
        <CardTitle>Coming up</CardTitle>
        <CardDescription>The next 30 days. Open one to see how it is going.</CardDescription>
        {events.length > SHOWN && (
          <CardAction>
            <Link to="/events" className="text-sm underline-offset-4 hover:underline">
              All {formatInteger(events.length)}
            </Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <Empty className="min-h-40 border py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarClockIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-sm">Nothing coming up</EmptyTitle>
              <EmptyDescription>
                No published events in the next 30 days.{' '}
                <Link to="/events" className="underline underline-offset-4">
                  Go to events
                </Link>
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y">
            {events.slice(0, SHOWN).map((event) => (
              <UpcomingRow key={event.id} event={event} now={now} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingRow({ event, now }: { event: Upcoming; now: number }) {
  const note = flag(event, now);
  const fill = event.capacity ? Math.min(1, event.booked / event.capacity) : null;
  return (
    <li>
      <Link
        to="/events"
        search={{ open: event.id, view: 'dashboard' }}
        className="hover:bg-muted/50 touch:min-h-11 -mx-2 grid grid-cols-[5.5rem_1fr_auto] items-center gap-x-4 gap-y-1 rounded-md px-2 py-2.5 text-sm max-sm:grid-cols-[1fr_auto]"
      >
        <span className="text-muted-foreground tabular-nums max-sm:col-span-2">
          {dayLabel(event)}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{event.title}</span>
          <span className="text-muted-foreground block truncate text-xs">
            {[formatTimeRange(event.startsAt, event.endsAt, event.timeZone), event.locationName]
              .filter(Boolean)
              .join(' at ')}
          </span>
        </span>
        <span className="flex items-center gap-3 justify-self-end">
          {note && (
            <Badge variant={note === 'Full' ? 'secondary' : 'outline'} className="max-sm:hidden">
              {note}
            </Badge>
          )}
          <span className="grid w-24 gap-1 text-right text-xs tabular-nums">
            <span>
              {formatInteger(event.booked)}
              {event.capacity !== null && (
                <span className="text-muted-foreground"> of {formatInteger(event.capacity)}</span>
              )}
              {event.capacity === null && <span className="text-muted-foreground"> booked</span>}
            </span>
            {fill !== null && (
              <span className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
                <span
                  className="bg-primary block h-full rounded-full"
                  style={{ width: `${fill * 100}%` }}
                />
              </span>
            )}
          </span>
        </span>
        {note && <span className="sr-only">{note}.</span>}
      </Link>
    </li>
  );
}
