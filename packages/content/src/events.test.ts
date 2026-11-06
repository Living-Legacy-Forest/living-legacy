import { describe, expect, it } from 'vitest';
import {
  type BookableEvent,
  bookingProblem,
  bookingReference,
  capacityProblem,
  eventIcs,
  seatsTaken,
} from './events';

const HOUR = 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 1, 0, 0); // 1 Nov 2026
const event = (over: Partial<BookableEvent> = {}): BookableEvent => ({
  status: 'published',
  startsAt: now + 48 * HOUR,
  endsAt: now + 50 * HOUR,
  bookingsCloseAt: null,
  capacity: 10,
  maxPartySize: 6,
  ...over,
});

describe('seatsTaken', () => {
  it('counts people in confirmed bookings only', () => {
    expect(
      seatsTaken([
        { status: 'confirmed', partySize: 3 },
        { status: 'cancelled', partySize: 4 },
        { status: 'confirmed', partySize: 2 },
      ])
    ).toBe(5);
  });
});

describe('bookingProblem', () => {
  it('accepts a booking that fits', () => {
    expect(bookingProblem(event(), 2, 5, now, 'website')).toBeNull();
  });

  it('refuses cancelled events for everyone', () => {
    expect(bookingProblem(event({ status: 'cancelled' }), 1, 0, now, 'staff')).toBe(
      'This event has been cancelled.'
    );
  });

  it('only lets the website book published events', () => {
    expect(bookingProblem(event({ status: 'draft' }), 1, 0, now, 'website')).toBe(
      'This event is not open for bookings.'
    );
    expect(bookingProblem(event({ status: 'draft' }), 1, 0, now, 'staff')).toBeNull();
  });

  it('closes website bookings at the close time, or the start', () => {
    const e = event({ bookingsCloseAt: now - HOUR });
    expect(bookingProblem(e, 1, 0, now, 'website')).toBe('Bookings for this event have closed.');
    expect(bookingProblem(event(), 1, 0, now + 49 * HOUR, 'website')).toBe(
      'Bookings for this event have closed.'
    );
  });

  it('lets staff add walk-ins until the event ends', () => {
    expect(bookingProblem(event(), 1, 0, now + 49 * HOUR, 'staff')).toBeNull();
    expect(bookingProblem(event(), 1, 0, now + 51 * HOUR, 'staff')).toBe(
      'This event has finished.'
    );
  });

  it('limits party size, more loosely for staff', () => {
    expect(bookingProblem(event(), 0, 0, now, 'staff')).toBe('Book at least one place.');
    expect(bookingProblem(event({ capacity: null }), 7, 0, now, 'website')).toBe(
      'Bookings are limited to 6 people.'
    );
    expect(bookingProblem(event({ capacity: null }), 12, 0, now, 'staff')).toBeNull();
    expect(bookingProblem(event({ capacity: null }), 51, 0, now, 'staff')).toBe(
      'Bookings are limited to 50 people.'
    );
  });

  it('says how many places are left', () => {
    expect(bookingProblem(event(), 2, 10, now, 'website')).toBe('This event is fully booked.');
    expect(bookingProblem(event(), 2, 9, now, 'website')).toBe('Only 1 place is left.');
    expect(bookingProblem(event(), 4, 7, now, 'website')).toBe('Only 3 places are left.');
  });

  it('has no limit without a capacity', () => {
    expect(bookingProblem(event({ capacity: null }), 6, 500, now, 'website')).toBeNull();
  });
});

describe('capacityProblem', () => {
  it('refuses a capacity below the people already booked', () => {
    expect(capacityProblem(8, 9)).toBe(
      '9 people are already booked. Set the capacity to at least 9.'
    );
    expect(capacityProblem(9, 9)).toBeNull();
    expect(capacityProblem(null, 900)).toBeNull();
  });
});

describe('bookingReference', () => {
  it('is LL- and six characters without look-alikes', () => {
    const ref = bookingReference(new Uint8Array([0, 1, 2, 30, 31, 62]));
    expect(ref).toBe('LL-ABC9AA');
    expect(bookingReference(crypto.getRandomValues(new Uint8Array(6)))).toMatch(
      /^LL-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/
    );
  });
});

describe('eventIcs', () => {
  const ics = eventIcs({
    uid: 'LL-ABC234@livinglegacy.com.au',
    title: 'Open day, Mornington',
    // 10:00 in Melbourne (AEDT, +11) on 7 Nov 2026 is 23:00 UTC on 6 Nov.
    startsAt: Date.UTC(2026, 10, 6, 23, 0),
    endsAt: Date.UTC(2026, 10, 7, 1, 0),
    location: '1 Forest Rd; Somerville VIC',
    description: 'Bring walking shoes.\nTea provided.',
    now: Date.UTC(2026, 10, 1, 0, 0),
  });

  it('uses UTC times and CRLF lines', () => {
    expect(ics).toContain('DTSTART:20261106T230000Z\r\n');
    expect(ics).toContain('DTEND:20261107T010000Z\r\n');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('escapes commas, semicolons and new lines', () => {
    expect(ics).toContain('SUMMARY:Open day\\, Mornington');
    expect(ics).toContain('LOCATION:1 Forest Rd\\; Somerville VIC');
    expect(ics).toContain('DESCRIPTION:Bring walking shoes.\\nTea provided.');
  });

  it('folds lines longer than 75 characters', () => {
    const long = eventIcs({
      uid: 'x',
      title: 'A'.repeat(120),
      startsAt: 0,
      endsAt: HOUR,
      location: '',
      description: '',
      now: 0,
    });
    for (const line of long.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75);
    expect(long).toContain('\r\n A');
  });
});
