// An event laid out the way a visitor would meet it: cover photo, then the
// details beside a booking card. The booking card drops under the description on
// phones, where a bar at the bottom keeps the booking button in reach.
import { ClientOnly } from '@tanstack/react-router';
import { Suspense, lazy } from 'react';
import { CalendarClockIcon, ImageIcon, MapPinIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  formatClock,
  formatDateTime,
  formatLongDate,
  formatTimeRange,
  zoneName,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { EventPreviewExtras } from '@/server/events';
import type { EventPreviewDraft } from './event-preview-store';

// Browser only, like the post preview: keeps ProseMirror and the map out of
// the server bundle.
const DescriptionBody = lazy(() =>
  import('@/components/posts/post-preview').then((m) => ({ default: m.PostPreviewBody }))
);
const PinMap = lazy(() =>
  import('@/components/locations/location-map').then((m) => ({ default: m.LocationPinMap }))
);

const placeholder = (height: string) => (
  <div className={cn('bg-muted/50 animate-pulse rounded-lg', height)} />
);

/** What the booking card says, worked out once for the card and the phone bar. */
function bookingState(event: EventPreviewDraft, now: number) {
  const left = event.capacity === null ? null : Math.max(0, event.capacity - event.booked);
  const closesAt = event.bookingsCloseAt ?? event.startsAt;
  if (event.status === 'cancelled') return { open: false, label: 'Cancelled', left };
  if (closesAt !== null && closesAt <= now) return { open: false, label: 'Bookings closed', left };
  if (event.bookingsOpenAt && event.bookingsOpenAt > now) {
    return { open: false, label: 'Bookings not open yet', left };
  }
  if (left === 0) return { open: false, label: 'Fully booked', left };
  return { open: true, label: 'Book a place', left };
}

// No count of places left: the brand never presses people to hurry
// (docs/brand-language.md), so the page says only whether there is room.
function placesLine(left: number | null) {
  return left === 0 ? 'Fully booked' : 'Places available';
}

const clock = formatClock;

/** "Sun 21 Mar": the locale's own format puts a comma after the day name. */
const chipDay = (ms: number, zone: string) =>
  new Intl.DateTimeFormat('en-AU', {
    timeZone: zone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .formatToParts(new Date(ms))
    .filter((p) => p.type !== 'literal')
    .map((p) => p.value)
    .join(' ')
    // Safari names the month "Sep"; the server "Sept" (sameDate, lib/format.ts).
    .replace(/\bSep\b/, 'Sept');

/** How many other dates show before the rest fold into "+N more". */
const DATES_SHOWN = 3;

/** The series' other dates as a row of chips: the day, and the time only when it differs. */
function OtherDates({
  dates,
  zone,
  usualTime,
}: {
  dates: { startsAt: number; endsAt: number }[];
  zone: string;
  usualTime: string | null;
}) {
  const shown = dates.slice(0, DATES_SHOWN);
  const more = dates.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Also on</span>
      {shown.map((d) => {
        const time = clock(d.startsAt, zone);
        return (
          <span key={d.startsAt} className="rounded-full border px-3 py-1">
            {chipDay(d.startsAt, zone)}
            {time !== usualTime && <span className="text-muted-foreground"> · {time}</span>}
          </span>
        );
      })}
      {more > 0 && (
        <span className="text-muted-foreground">
          +{more} more {more === 1 ? 'date' : 'dates'}
        </span>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon?: typeof MapPinIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t pt-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        {Icon && <Icon aria-hidden className="text-muted-foreground size-5" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

export function EventArticle({
  event,
  extras,
}: {
  event: EventPreviewDraft;
  /** Location, photos and other dates; null while they load. */
  extras: EventPreviewExtras | null;
}) {
  const zone = event.timeZone;
  const now = Date.now();
  const booking = bookingState(event, now);
  const [cover, ...photos] = extras?.photos ?? [];
  const location = extras?.location ?? null;
  const where = event.venue || location?.address || '';
  // A new repeating event knows its dates from the form; a saved one asks.
  const otherDates = event.id ? (extras?.otherDates ?? []) : event.moreDates;

  const bookingDetails = (
    <>
      <p className="text-muted-foreground text-sm">{placesLine(booking.left)}</p>
      <p className="text-muted-foreground text-sm">
        Up to {event.maxPartySize} {event.maxPartySize === 1 ? 'person' : 'people'} per booking
      </p>
    </>
  );
  const bookButton = (
    <Button className="w-full" size="lg" disabled>
      {booking.label}
    </Button>
  );

  return (
    <article className="mx-auto max-w-5xl px-4 pt-6 pb-28 sm:px-6 lg:pb-16">
      {event.status === 'cancelled' && (
        <p className="bg-destructive/10 text-destructive mb-4 rounded-lg px-4 py-3 text-sm font-medium">
          This event is cancelled.
        </p>
      )}

      {/* Cover */}
      {extras === null ? (
        placeholder('aspect-2/1 max-h-112 w-full')
      ) : cover ? (
        <img
          src={cover.url}
          alt={cover.alt}
          width={cover.width ?? undefined}
          height={cover.height ?? undefined}
          className="bg-muted aspect-2/1 max-h-112 w-full rounded-xl object-cover"
        />
      ) : (
        <div className="bg-muted text-muted-foreground flex aspect-3/1 w-full flex-col items-center justify-center gap-2 rounded-xl text-sm">
          <ImageIcon aria-hidden className="size-6" />
          No cover photo. The first photo on the event is its cover.
        </div>
      )}

      <div className="mt-8 grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Heading */}
        <header className="lg:col-start-1">
          <p className="text-muted-foreground text-sm font-medium">
            {event.startsAt !== null ? formatLongDate(event.startsAt, zone) : 'Date not set'}
          </p>
          <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
            {event.title || 'Untitled event'}
          </h1>
          {event.summary && (
            <p className="text-muted-foreground mt-3 text-lg leading-relaxed">{event.summary}</p>
          )}
        </header>

        {/* The description follows the heading, before the practical details. */}
        <div className="lg:col-start-1">
          <Section title="About this event">
            <div className="text-[17px] leading-[1.7]">
              <ClientOnly fallback={placeholder('h-48')}>
                <Suspense fallback={placeholder('h-48')}>
                  <DescriptionBody body={event.description} />
                </Suspense>
              </ClientOnly>
            </div>
          </Section>
        </div>

        {/* Booking card: beside the details on wide screens, under the description on phones. */}
        <aside className="lg:col-start-2 lg:row-span-3 lg:row-start-1">
          <div className="bg-muted/50 space-y-3 rounded-xl p-5 lg:sticky lg:top-16">
            <p className="font-semibold">
              {event.startsAt !== null ? formatDateTime(event.startsAt, zone) : 'Date not set'}
            </p>
            {bookingDetails}
            <div className="max-lg:hidden">{bookButton}</div>
            {event.status !== 'cancelled' && event.bookingsOpenAt && event.bookingsOpenAt > now && (
              <p className="text-muted-foreground text-xs">
                Bookings open {formatDateTime(event.bookingsOpenAt, zone)}
              </p>
            )}
            {event.status !== 'cancelled' && (event.bookingsCloseAt ?? event.startsAt) !== null && (
              <p className="text-muted-foreground text-xs">
                {booking.open ? 'Bookings close' : 'Bookings closed'}{' '}
                {formatDateTime((event.bookingsCloseAt ?? event.startsAt)!, zone)}
              </p>
            )}
            <p className="text-muted-foreground text-xs">Booking is turned off in previews.</p>
          </div>
        </aside>

        {/* Details */}
        <div className="space-y-8 lg:col-start-1">
          <Section icon={CalendarClockIcon} title="Date and time">
            {event.startsAt !== null && event.endsAt !== null ? (
              <p>
                {formatLongDate(event.startsAt, zone)}
                <br />
                <span className="text-muted-foreground">
                  {formatTimeRange(event.startsAt, event.endsAt, zone)}{' '}
                  {zoneName(zone, event.startsAt)}
                </span>
              </p>
            ) : (
              <p className="text-muted-foreground">Not set yet.</p>
            )}
            {otherDates.length > 0 && (
              <OtherDates
                dates={otherDates}
                zone={zone}
                // Times are left off the chips that share this one's.
                usualTime={event.startsAt !== null ? clock(event.startsAt, zone) : null}
              />
            )}
          </Section>

          <Section icon={MapPinIcon} title="Location">
            {location || where ? (
              <>
                <p>
                  {location?.name && <span className="font-medium">{location.name}</span>}
                  {location?.name && where && <br />}
                  {where && <span className="text-muted-foreground">{where}</span>}
                </p>
                {location?.pin && (
                  <div className="h-56 overflow-hidden rounded-lg">
                    <ClientOnly fallback={placeholder('h-full')}>
                      <Suspense fallback={placeholder('h-full')}>
                        <PinMap pin={location.pin} name={location.name} />
                      </Suspense>
                    </ClientOnly>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Not set yet.</p>
            )}
          </Section>

          {photos.length > 0 && (
            <Section title="Photos">
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((p) => (
                  <li key={p.id}>
                    <img
                      src={`${p.url}?w=640`}
                      alt={p.alt}
                      loading="lazy"
                      className="bg-muted aspect-4/3 w-full rounded-lg object-cover"
                    />
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>

      {/* Phones: the booking button stays in reach at the bottom. */}
      {event.status !== 'cancelled' && (
        <div className="bg-background/95 fixed inset-x-0 bottom-0 z-10 flex items-center gap-3 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
          <p className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
            {booking.open ? placesLine(booking.left) : booking.label}
          </p>
          <div className="w-40 flex-none">{bookButton}</div>
        </div>
      )}
    </article>
  );
}
