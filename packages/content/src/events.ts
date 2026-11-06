import { z } from 'zod';
import type { AustralianState } from './locations';
import { richTextSchema } from './posts';
import { type TimeZone, timeZones } from './settings';

// Free events (open days) and the bookings for them: the rules both the CMS
// and, later, the website apply. Times are epoch milliseconds.

export const eventStatuses = ['draft', 'published', 'cancelled'] as const;
export type EventStatus = (typeof eventStatuses)[number];
export const bookingStatuses = ['confirmed', 'cancelled'] as const;
export type BookingStatus = (typeof bookingStatuses)[number];
export const bookingSources = ['website', 'staff'] as const;
export type BookingSource = (typeof bookingSources)[number];

export const DEFAULT_MAX_PARTY_SIZE = 6;
/** Staff add walk-ins and group phone bookings, so their limit is looser. */
export const STAFF_MAX_PARTY_SIZE = 50;
/** Bookings are personal details; they go this long after the event ends. */
export const BOOKING_RETENTION_DAYS = 365;

export type BookableEvent = {
  status: EventStatus;
  startsAt: number;
  endsAt: number;
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
const REFERENCE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

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
    heroMediaId: z.string().nullable(),
    capacity: z.number().int().min(1).max(100_000).nullable(),
    maxPartySize: z.number().int().min(1).max(STAFF_MAX_PARTY_SIZE),
    bookingsCloseAt: z.number().int().nullable(),
    status: z.enum(['draft', 'published']),
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
  });
export type EventInput = z.infer<typeof eventInputSchema>;

export const guestInputSchema = z.object({
  eventId: z.string(),
  firstName: z.string().trim().min(1, 'Enter a first name.').max(60),
  lastName: optionalText(60),
  email: optionalText(200).refine(
    (v) => !v || z.string().email().safeParse(v).success,
    'That email address is not valid.'
  ),
  phone: optionalText(40),
  partySize: z.number().int().min(1).max(STAFF_MAX_PARTY_SIZE),
  note: optionalText(500),
});
export type GuestInput = z.infer<typeof guestInputSchema>;

/** Cancelling or deleting a repeating event: this date only, or this and its upcoming dates. */
export const seriesScopeSchema = z.enum(['one', 'following']).default('one');
export type SeriesScope = z.infer<typeof seriesScopeSchema>;
