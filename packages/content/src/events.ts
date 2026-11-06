import { z } from 'zod';

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

const icsDate = (ms: number) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

const icsText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Lines longer than 75 characters continue on the next line after a space (RFC 5545). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(` ${line.slice(i, i + 74)}`);
  return parts.join('\r\n');
}

/** An add-to-calendar file for one booking. */
export function eventIcs(e: {
  uid: string;
  title: string;
  startsAt: number;
  endsAt: number;
  location: string;
  description: string;
  now: number;
}): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Living Legacy//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${icsDate(e.now)}`,
    `DTSTART:${icsDate(e.startsAt)}`,
    `DTEND:${icsDate(e.endsAt)}`,
    `SUMMARY:${icsText(e.title)}`,
    ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${icsText(e.description)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

const optionalText = (max: number) => z.string().trim().max(max).default('');

export const eventInputSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(1, 'Give the event a title.').max(120),
    slug: optionalText(120),
    locationId: z.string().nullable(),
    venue: optionalText(300),
    startsAt: z.number().int(),
    endsAt: z.number().int(),
    summary: optionalText(200),
    description: optionalText(10_000),
    heroMediaId: z.string().nullable(),
    capacity: z.number().int().min(1).max(100_000).nullable(),
    maxPartySize: z.number().int().min(1).max(STAFF_MAX_PARTY_SIZE),
    bookingsCloseAt: z.number().int().nullable(),
    status: z.enum(['draft', 'published']),
  })
  .refine((e) => e.endsAt > e.startsAt, {
    path: ['endsAt'],
    message: 'The event must end after it starts.',
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
  sendConfirmation: z.boolean().default(false),
});
export type GuestInput = z.infer<typeof guestInputSchema>;
