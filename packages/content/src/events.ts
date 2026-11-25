import { z } from 'zod';
import type { AustralianState } from './locations';
import { auPhone } from './phone';
import { EMAIL_MESSAGE, isEmail, wholeNumberSchema } from './validation';
import { richTextSchema } from './posts';
import { type TimeZone, timeZones } from './settings';

// Free events (open days) and the bookings for them: the rules both the CMS
// and, later, the website apply. Times are epoch milliseconds.

export const eventStatuses = ['draft', 'published', 'cancelled'] as const;
export type EventStatus = (typeof eventStatuses)[number];
// `waitlisted` is someone staff have put on an event's waiting list because it is full: no place
// is held for them, they are not counted, and they are not sent to HubSpot until moved to guests.
export const bookingStatuses = ['confirmed', 'waitlisted', 'cancelled'] as const;
export type BookingStatus = (typeof bookingStatuses)[number];
export const bookingSources = ['website', 'staff'] as const;
export type BookingSource = (typeof bookingSources)[number];

export const DEFAULT_MAX_PARTY_SIZE = 6;
/** Staff add walk-ins and group phone bookings, so their limit is looser. */
export const STAFF_MAX_PARTY_SIZE = 50;
/** Bookings are personal details; they go this long after the event ends. */
export const BOOKING_RETENTION_DAYS = 365;
/** Photos on one event, its cover included. */
export const EVENT_PHOTO_LIMIT = 20;

/**
 * Events as staff think of them: the dates of a repeating event together, an
 * event that does not repeat on its own. `lead` is the date that stands for the
 * group: the next one still to come, or the latest once all have passed.
 */
export function groupEventDates<
  T extends { id: string; seriesId: string | null; startsAt: number; endsAt: number },
>(events: T[], now: number) {
  const groups = new Map<string, T[]>();
  for (const event of events) {
    const key = event.seriesId ?? event.id;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups].map(([key, list]) => {
    const dates = [...list].sort((a, b) => a.startsAt - b.startsAt);
    const next = dates.find((d) => d.endsAt >= now);
    return { key, dates, lead: next ?? dates[dates.length - 1]!, upcoming: next !== undefined };
  });
}

/**
 * The fields `was` has that hold something else in `next`. Lists and rich text
 * are compared by value: a new object with the same contents is not a change.
 */
export function changedFields<T extends Record<string, unknown>>(
  was: Record<string, unknown>,
  next: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(next).filter(
      ([key, value]) => key in was && JSON.stringify(was[key]) !== JSON.stringify(value)
    )
  ) as Partial<T>;
}

export type BookableEvent = {
  status: EventStatus;
  startsAt: number;
  endsAt: number;
  bookingsOpenAt: number | null;
  bookingsCloseAt: number | null;
  capacity: number | null;
  maxPartySize: number;
};

/** People in confirmed bookings. */
export function seatsTaken(bookings: { status: string; partySize: number }[]): number {
  return bookings.reduce((sum, b) => (b.status === 'confirmed' ? sum + b.partySize : sum), 0);
}

/** Why a booking of `partySize` cannot be made, or null if it can. */
export function bookingProblem(
  event: BookableEvent,
  partySize: number,
  taken: number,
  now: number,
  by: 'website' | 'staff'
): string | null {
  if (event.status === 'cancelled') return 'This event has been cancelled.';
  if (by === 'website') {
    if (event.status !== 'published') return 'This event is not open for bookings.';
    if (event.bookingsOpenAt !== null && now < event.bookingsOpenAt) {
      return 'Bookings for this event are not open yet.';
    }
    if (now >= (event.bookingsCloseAt ?? event.startsAt)) {
      return 'Bookings for this event have closed.';
    }
  } else if (now >= event.endsAt) {
    return 'This event has finished.';
  }

  if (!Number.isInteger(partySize) || partySize < 1) return 'Book at least one place.';
  const max = by === 'staff' ? STAFF_MAX_PARTY_SIZE : event.maxPartySize;
  if (partySize > max) return `Bookings are limited to ${max} people.`;

  if (event.capacity !== null) {
    const left = event.capacity - taken;
    if (left <= 0) return 'This event is fully booked.';
    if (partySize > left)
      return left === 1 ? 'Only 1 place is left.' : `Only ${left} places are left.`;
  }
  return null;
}

/**
 * Why a party cannot go on the waiting list, or null if it can. A waiting list is for a party the
 * event has no room for: with room (or no limit) they should simply be booked in.
 */
export function waitlistProblem(
  event: BookableEvent,
  partySize: number,
  taken: number,
  now: number
): string | null {
  // Every other rule is a booking's, so judge as if the event were empty and the party fits.
  const other = bookingProblem({ ...event, capacity: null }, partySize, 0, now, 'staff');
  if (other) return other;
  if (event.capacity === null) return 'This event has no limit, so it has no waiting list.';
  const left = event.capacity - taken;
  if (partySize <= left) {
    return left === 1
      ? 'There is a place left, so add them as a guest instead.'
      : `There are ${left} places left, so add them as a guest instead.`;
  }
  return null;
}

/** Whether `partySize` could be moved off the waiting list into the places left, and why not. */
export function promoteProblem(capacity: number | null, taken: number, partySize: number) {
  if (capacity === null) return null;
  const left = capacity - taken;
  if (partySize <= left) return null;
  if (left <= 0) return 'This event is still fully booked.';
  return left === 1 ? 'Only 1 place is left.' : `Only ${left} places are left.`;
}

/** A new capacity must still hold everyone already booked. */
export function capacityProblem(capacity: number | null, taken: number): string | null {
  if (capacity === null || capacity >= taken) return null;
  return `${taken} people are already booked. Set the capacity to at least ${taken}.`;
}

/**
 * Deleting an upcoming event with bookings would drop its guests without them
 * hearing; cancelling first lets HubSpot tell them. Past and cancelled events,
 * and events nobody booked, can go.
 */
export function deleteEventProblem(
  event: Pick<BookableEvent, 'status' | 'endsAt'>,
  confirmedBookings: number,
  now: number
): string | null {
  if (event.status === 'cancelled' || event.endsAt <= now || confirmedBookings === 0) return null;
  return 'This event has bookings. Cancel it first, so its guests are told.';
}

// No 0/O, 1/I/L: references are read out over the phone.
export const REFERENCE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** "LL-7K3QXM" from six random bytes. */
export function bookingReference(bytes: Uint8Array): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += REFERENCE_ALPHABET[(bytes[i] ?? 0) % REFERENCE_ALPHABET.length];
  }
  return `LL-${code}`;
}

/** The time zone an event at a location in `state` runs on: its capital's. */
export function stateTimeZone(state: AustralianState): TimeZone {
  const zones: Record<AustralianState, TimeZone> = {
    QLD: 'Australia/Brisbane',
    NSW: 'Australia/Sydney',
    ACT: 'Australia/Sydney',
    VIC: 'Australia/Melbourne',
    TAS: 'Australia/Hobart',
    SA: 'Australia/Adelaide',
    WA: 'Australia/Perth',
    NT: 'Australia/Darwin',
  };
  return zones[state];
}

const optionalText = (max: number) => z.string().trim().max(max).default('');

export const eventInputSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(1, 'Give the event a title.').max(120),
    slug: optionalText(120),
    locationId: z.string().nullable(),
    /** Its dates and times are in this zone (its location's, unless changed). */
    timeZone: z.enum(timeZones),
    venue: optionalText(300),
    startsAt: z.number().int(),
    endsAt: z.number().int(),
    summary: optionalText(200),
    /** Rich text, stored like a post's body. */
    description: richTextSchema.nullable().default(null),
    /** The cover: the first of the event's photos. */
    heroMediaId: z.string().nullable(),
    /** The rest of its photos, in order. */
    galleryMediaIds: z
      .array(z.string())
      .max(EVENT_PHOTO_LIMIT - 1, `An event can have ${EVENT_PHOTO_LIMIT} photos.`)
      .default([]),
    capacity: wholeNumberSchema('Capacity', 1, 100_000).nullable(),
    maxPartySize: wholeNumberSchema('Max per booking', 1, STAFF_MAX_PARTY_SIZE),
    // The default keeps forms and previews saved before it existed readable.
    bookingsOpenAt: z.number().int().nullable().default(null),
    bookingsCloseAt: z.number().int().nullable(),
    status: z.enum(['draft', 'published']),
    /** A draft's time to go live, or null to stay a draft until published by hand. */
    publishAt: z.number().int().nullable().default(null),
    /** A new repeating event: its other dates (the first is startsAt/endsAt). */
    moreDates: z
      .array(z.object({ startsAt: z.number().int(), endsAt: z.number().int() }))
      .max(51)
      .default([]),
    /** Editing a repeating event: this date only, or this and its upcoming dates. */
    scope: z.enum(['one', 'following']).default('one'),
  })
  .refine((e) => e.endsAt > e.startsAt, {
    path: ['endsAt'],
    message: 'The event must end after it starts.',
  })
  .refine((e) => e.moreDates.every((d) => d.endsAt > d.startsAt), {
    path: ['moreDates'],
    message: 'Every date must end after it starts.',
  })
  .refine((e) => e.bookingsCloseAt === null || e.bookingsCloseAt <= e.startsAt, {
    path: ['bookingsCloseAt'],
    message: 'Bookings must close before the event starts.',
  })
  .refine(
    (e) => e.bookingsOpenAt === null || e.bookingsOpenAt < (e.bookingsCloseAt ?? e.startsAt),
    {
      path: ['bookingsOpenAt'],
      message: 'Bookings must open before they close.',
    }
  );
export type EventInput = z.infer<typeof eventInputSchema>;

/** Letters from any language, with the marks names use: O'Brien, Mary-Jane, St. John. */
const NAME = /^(?=.*\p{L})[\p{L}\p{M}' ’.-]+$/u;
const NAME_MESSAGE = 'Use letters only, with spaces, hyphens or apostrophes if the name has them.';
const PEOPLE_MESSAGE = `People must be a whole number from 1 to ${STAFF_MAX_PARTY_SIZE}.`;

export const guestInputSchema = z.object({
  eventId: z.string(),
  firstName: z.string().trim().min(1, 'Enter a first name.').max(60).regex(NAME, NAME_MESSAGE),
  lastName: optionalText(60).refine((v) => !v || NAME.test(v), NAME_MESSAGE),
  email: optionalText(200)
    .transform((v) => v.toLowerCase())
    .refine((v) => !v || isEmail(v), EMAIL_MESSAGE),
  phone: optionalText(40)
    .refine((v) => !v || auPhone(v) !== null, 'Enter an Australian mobile or landline number.')
    .transform((v) => (v ? auPhone(v)! : '')),
  partySize: z
    .number(PEOPLE_MESSAGE)
    .int(PEOPLE_MESSAGE)
    .min(1, PEOPLE_MESSAGE)
    .max(STAFF_MAX_PARTY_SIZE, PEOPLE_MESSAGE),
  note: optionalText(500),
});
export type GuestInput = z.infer<typeof guestInputSchema>;

/** A booking made on the website: the guest's email is how they get their link, so it is required. */
export const publicBookingSchema = guestInputSchema.extend({
  email: z
    .string(EMAIL_MESSAGE)
    .trim()
    .max(200)
    .transform((v) => v.toLowerCase())
    .refine(isEmail, EMAIL_MESSAGE),
  consent: z.literal(true, 'Tick the box to agree to the privacy policy.'),
});
export type PublicBookingInput = z.infer<typeof publicBookingSchema>;

/** Cancelling or deleting a repeating event: this date only, or this and its upcoming dates. */
export const seriesScopeSchema = z.enum(['one', 'following']).default('one');
export type SeriesScope = z.infer<typeof seriesScopeSchema>;
