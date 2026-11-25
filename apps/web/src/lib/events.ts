/**
 * Events and their places left, read from the shared D1 database the CMS writes. Only the CMS
 * changes a booking (src/lib/cms-internal.ts); the site only reads, so what a visitor sees here
 * is never held back by a cache: event pages are rendered fresh (see src/lib/page-cache.ts).
 *
 * Times are stored as epoch milliseconds and shown in the event's own time zone, never the
 * server's or the visitor's.
 */
import {
  type BookingState,
  type EventStatus,
  type RichTextDoc,
  bookingState,
  focalPosition,
  isAllowedRichText,
  renderRichText,
} from '@ll/content';
import { CMS_URL } from 'astro:env/server';
import { env } from 'cloudflare:workers';
import { mediaSources } from '@/lib/media-srcset';

/** The slice of the D1 binding used here, so the site needs no Workers type package. */
interface D1 {
  prepare(query: string): {
    bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }> };
  };
}

const db = (env as { DB?: D1 }).DB;
const MEDIA_ORIGIN = CMS_URL.replace(/\/+$/, '');

export type EventHero = {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  /** A copy big enough for a card, where the image has copies. */
  cardUrl?: string;
  srcset?: string;
  position?: string;
};

export type PublicEvent = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  startsAt: number;
  endsAt: number;
  timeZone: string;
  venue: string;
  heroMediaId: string | null;
  /** The cover with what an image tag needs; null when the event has none. */
  hero: EventHero | null;
  status: 'published' | 'cancelled';
  /** People still able to book; null when the event has no limit. */
  placesLeft: number | null;
  state: BookingState;
};

export type EventDetail = PublicEvent & {
  /** The description as safe HTML, or null when there is none. */
  description: string | null;
  maxPartySize: number;
  /** When online bookings open; null means as soon as the event is published. */
  bookingsOpenAt: number | null;
};

type EventRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  venue: string | null;
  time_zone: string;
  starts_at: number;
  ends_at: number;
  capacity: number | null;
  max_party_size: number;
  bookings_open_at: number | null;
  bookings_close_at: number | null;
  status: EventStatus;
  hero_media_id: string | null;
  hero_alt: string | null;
  hero_width: number | null;
  hero_height: number | null;
  hero_variants: string | null;
  hero_focal_x: number | null;
  hero_focal_y: number | null;
  taken: number;
};

// People in confirmed bookings are the ones who hold a place (seatsTaken in @ll/content).
const SELECT = `
  SELECT e.id, e.slug, e.title, e.summary, e.description, e.venue, e.time_zone, e.starts_at,
         e.ends_at, e.capacity, e.max_party_size, e.bookings_open_at, e.bookings_close_at,
         e.status, e.hero_media_id,
         m.alt AS hero_alt, m.width AS hero_width, m.height AS hero_height,
         m.variants AS hero_variants, m.focal_x AS hero_focal_x, m.focal_y AS hero_focal_y,
         COALESCE((SELECT SUM(b.party_size) FROM event_bookings b
                    WHERE b.event_id = e.id AND b.status = 'confirmed'), 0) AS taken
    FROM events e
    LEFT JOIN media m ON m.id = e.hero_media_id
   WHERE e.status IN ('published', 'cancelled')`;

function hero(row: EventRow): EventHero | null {
  if (!row.hero_media_id) return null;
  const url = `${MEDIA_ORIGIN}/api/media/${row.hero_media_id}`;
  const { srcset, smallUrl } = mediaSources(url, row.hero_width, row.hero_variants);
  return {
    url,
    alt: row.hero_alt ?? '',
    width: row.hero_width ?? undefined,
    height: row.hero_height ?? undefined,
    cardUrl: smallUrl,
    srcset,
    position: focalPosition(row.hero_focal_x, row.hero_focal_y),
  };
}

function toEvent(row: EventRow, now: number): PublicEvent {
  const taken = row.taken ?? 0;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? '',
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timeZone: row.time_zone,
    venue: row.venue ?? '',
    heroMediaId: row.hero_media_id,
    hero: hero(row),
    status: row.status === 'cancelled' ? 'cancelled' : 'published',
    placesLeft: row.capacity === null ? null : Math.max(0, row.capacity - taken),
    state: bookingState(
      {
        status: row.status,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        bookingsOpenAt: row.bookings_open_at,
        bookingsCloseAt: row.bookings_close_at,
        capacity: row.capacity,
        maxPartySize: row.max_party_size,
      },
      taken,
      now
    ),
  };
}

function renderDescription(json: string | null): string | null {
  if (!json) return null;
  try {
    const doc: unknown = JSON.parse(json);
    if (!isAllowedRichText(doc)) return null;
    const { html } = renderRichText(doc as RichTextDoc, { mediaOrigin: MEDIA_ORIGIN });
    return html.trim() === '' ? null : html;
  } catch {
    return null;
  }
}

/**
 * Events still to finish, published or cancelled, soonest first. The dates of a repeating event
 * each appear, sharing one slug. A database hiccup reads as no events rather than a 500.
 */
export async function getUpcomingEvents(now = Date.now()): Promise<PublicEvent[]> {
  if (!db) return [];
  try {
    const { results } = await db
      .prepare(`${SELECT} AND e.ends_at > ? ORDER BY e.starts_at, e.id`)
      .bind(now)
      .all<EventRow>();
    return results.map((row) => toEvent(row, now));
  } catch (error) {
    console.error('[events] could not load upcoming events', error);
    return [];
  }
}

/**
 * The event at /events/{slug}/. A repeating event's dates share the slug, so this is the date
 * `eventId` names if it belongs to the slug, otherwise the best of those still to come (pickDate), otherwise the
 * latest that has passed (its page then says bookings have closed). Null for an unknown slug.
 */
export async function getEventBySlug(
  slug: string,
  now = Date.now(),
  eventId?: string
): Promise<EventDetail | null> {
  const dates = await getEventDates(slug, now);
  if (dates.length === 0) return null;
  const chosen = eventId ? dates.find((d) => d.id === eventId) : undefined;
  if (chosen) return chosen;
  const upcoming = dates.filter((d) => d.endsAt > now);
  return upcoming.length > 0 ? pickDate(upcoming) : dates[dates.length - 1]!;
}

/**
 * The date of a repeating event to show when none is asked for: the first that can be booked,
 * else the first not cancelled, else the first. `dates` are upcoming, earliest first, not empty.
 * The list and the event page both use this, so a series reads the same on each.
 */
export function pickDate<T extends PublicEvent>(dates: T[]): T {
  return (
    dates.find((d) => d.state === 'open') ??
    dates.find((d) => d.status !== 'cancelled') ??
    dates[0]!
  );
}

/** A badge for the whole series: only when every upcoming date is cancelled, or all that are not are full. */
export function seriesBadge(dates: PublicEvent[]): 'Cancelled' | 'Fully booked' | null {
  if (dates.every((d) => d.status === 'cancelled')) return 'Cancelled';
  if (dates.every((d) => d.status === 'cancelled' || d.state === 'full')) return 'Fully booked';
  return null;
}

/** Every date sharing `slug`, earliest first, each with its description for the page. */
async function getEventDates(slug: string, now: number): Promise<EventDetail[]> {
  if (!db) return [];
  try {
    const { results } = await db
      .prepare(`${SELECT} AND e.slug = ? ORDER BY e.starts_at, e.id`)
      .bind(slug)
      .all<EventRow>();
    return results.map((row) => ({
      ...toEvent(row, now),
      description: renderDescription(row.description),
      maxPartySize: row.max_party_size,
      bookingsOpenAt: row.bookings_open_at,
    }));
  } catch (error) {
    console.error('[events] could not load an event', error);
    return [];
  }
}

/** The dates of `slug` still to finish, so a repeating event's page can offer them. */
export async function getUpcomingDates(slug: string, now = Date.now()): Promise<PublicEvent[]> {
  return (await getEventDates(slug, now)).filter((d) => d.endsAt > now);
}

// Times: always the event's own zone, in Australian English.

function format(ms: number, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-AU', { ...options, timeZone }).format(new Date(ms));
}

const time = (ms: number, timeZone: string) =>
  format(ms, timeZone, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s/g, ' ');

/** "Saturday 14 March 2027". */
export function formatEventDate(ms: number, timeZone: string): string {
  return format(ms, timeZone, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .replace(',', '')
    .replace(/\s/g, ' ');
}

/** "Saturday 14 March 2027, 10:00 am to 12:00 pm"; both dates if it runs past midnight. */
export function formatEventWhen(startsAt: number, endsAt: number, timeZone: string): string {
  const day = (ms: number) =>
    format(ms, timeZone, { year: 'numeric', month: 'numeric', day: 'numeric' });
  if (day(startsAt) === day(endsAt)) {
    return `${formatEventDate(startsAt, timeZone)}, ${time(startsAt, timeZone)} to ${time(endsAt, timeZone)}`;
  }
  return `${formatEventDate(startsAt, timeZone)}, ${time(startsAt, timeZone)} to ${formatEventDate(endsAt, timeZone)}, ${time(endsAt, timeZone)}`;
}

/** The number of places left as a visitor reads it; null when the event has no limit. */
export function placesLeftText(placesLeft: number | null): string | null {
  if (placesLeft === null) return null;
  if (placesLeft <= 0) return 'Fully booked';
  return placesLeft === 1 ? '1 place left' : `${placesLeft} places left`;
}

/** The one line shown in place of the form when an event cannot be booked online. */
export function closedLine(event: EventDetail): string {
  switch (event.state) {
    case 'not-yet':
      return event.bookingsOpenAt === null
        ? 'Bookings are not open yet.'
        : `Bookings open on ${formatEventDate(event.bookingsOpenAt, event.timeZone)}.`;
    case 'closed':
      return 'Bookings for this event have closed.';
    case 'full':
      return 'This event is fully booked.';
    case 'cancelled':
      return 'This event has been cancelled.';
    default:
      return '';
  }
}
