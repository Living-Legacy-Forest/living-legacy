import { type EventInput, fromZoned, sameClockOn, toZoned } from '@ll/content';
import type { EventRow } from '@/server/events';
import { type EventTimes, type SessionTime, sessionTimes } from '../event-dates-field';
import { type RepeatValue, seriesDates } from '../repeat-field';

// The rules behind the event page's form, kept apart from React so they can be tested.

export type EventValues = Omit<EventInput, 'id' | 'startsAt' | 'endsAt' | 'moreDates' | 'scope'> & {
  startsAt: number | null;
  endsAt: number | null;
};

export function initialEventValues(event: EventRow | null, siteZone: string): EventValues {
  if (!event) {
    return {
      timeZone: siteZone as EventValues['timeZone'],
      title: '',
      slug: '',
      locationId: null,
      venue: '',
      startsAt: null,
      endsAt: null,
      summary: '',
      description: null,
      heroMediaId: null,
      galleryMediaIds: [],
      capacity: null,
      // What the open days allowed per order on Eventbrite.
      maxPartySize: 10,
      bookingsOpenAt: null,
      bookingsCloseAt: null,
      status: 'draft',
      publishAt: null,
    };
  }
  return {
    timeZone: event.timeZone as EventValues['timeZone'],
    title: event.title,
    slug: event.slug,
    locationId: event.locationId,
    venue: event.venue,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    summary: event.summary,
    description: event.description,
    heroMediaId: event.heroMediaId,
    galleryMediaIds: event.galleryMediaIds,
    capacity: event.capacity,
    maxPartySize: event.maxPartySize,
    bookingsOpenAt: event.bookingsOpenAt,
    bookingsCloseAt: event.bookingsCloseAt,
    // A cancelled event is shown read-only, so this is never saved.
    status: event.status === 'published' ? 'published' : 'draft',
    publishAt: event.publishAt,
  };
}

/** A new zone keeps the clock times (10:00 stays 10:00), not the instants. */
export function rezoneValues(values: EventValues, next: string): EventValues {
  const move = (ms: number | null) =>
    ms === null ? null : fromZoned(toZoned(ms, values.timeZone), next);
  return {
    ...values,
    timeZone: next as EventValues['timeZone'],
    startsAt: move(values.startsAt),
    endsAt: move(values.endsAt),
    bookingsOpenAt: move(values.bookingsOpenAt),
    bookingsCloseAt: move(values.bookingsCloseAt),
  };
}

/** Every event a new one makes: each date of its series, at each of its times. */
export function expandEventTimes(
  first: EventTimes,
  repeat: RepeatValue,
  sessions: SessionTime[],
  zone: string
): EventTimes[] {
  const dates =
    repeat.repeat !== 'none'
      ? seriesDates(first, repeat, zone).filter((d) => !d.skipped)
      : [{ ...first }];
  const extra = sessions
    .map((x) => sessionTimes(first.startsAt, x, zone))
    .filter((x): x is EventTimes => x !== null);
  return dates.flatMap((d) => [
    { startsAt: d.startsAt, endsAt: d.endsAt },
    ...extra.map((x) => sameClockOn(d.startsAt, x, zone)),
  ]);
}

/** What is wrong with the times (and how a new series ends), as a sentence, or null if all is well. */
export function timesProblem({
  times,
  sessions,
  zone,
  repeat,
  isNew,
}: {
  times: EventTimes | null;
  sessions: SessionTime[];
  zone: string;
  repeat: RepeatValue;
  isNew: boolean;
}): string | null {
  if (!times) return 'Pick its date and times.';
  if (times.endsAt <= times.startsAt) return 'It must end after it starts.';
  if (sessions.some((x) => !sessionTimes(times.startsAt, x, zone))) {
    return 'Each extra time needs a start and a later end, like 2:00 pm to 4:00 pm.';
  }
  const needsEnd = repeat.repeat !== 'none' && repeat.repeat !== 'custom';
  if (isNew && needsEnd && repeat.ends === 'until' && !repeat.until) {
    return 'Pick when it stops repeating.';
  }
  return null;
}

/** What was just saved: the form as it was sent, with any changes made on top of it (Publish). */
export function savedValues(values: EventValues, overrides: Partial<EventValues>): EventValues {
  return { ...values, ...overrides };
}

/** Whether leaving the page would lose something: a changed field, an extra time or a repeat. */
export function isEventDirty(
  values: EventValues,
  saved: EventValues,
  extras: { sessions: SessionTime[]; repeat: RepeatValue }
): boolean {
  return (
    JSON.stringify(values) !== JSON.stringify(saved) ||
    extras.sessions.length > 0 ||
    extras.repeat.repeat !== 'none'
  );
}
