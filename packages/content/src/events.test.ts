import { describe, expect, it } from 'vitest';
import {
  EVENT_PHOTO_LIMIT,
  changedFields,
  eventInputSchema,
  eventSlugProblem,
  guestInputSchema,
  groupEventDates,
  type BookableEvent,
  bookingProblem,
  bookingReference,
  capacityProblem,
  deleteEventProblem,
  promoteProblem,
  seatsTaken,
  waitlistProblem,
  stateTimeZone,
} from './events';

const HOUR = 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 1, 0, 0); // 1 Nov 2026
const event = (over: Partial<BookableEvent> = {}): BookableEvent => ({
  status: 'published',
  startsAt: now + 48 * HOUR,
  endsAt: now + 50 * HOUR,
  bookingsOpenAt: null,
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
        { status: 'waitlisted', partySize: 5 },
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

  it('opens website bookings at the open time, but lets staff add guests before it', () => {
    const e = event({ bookingsOpenAt: now + HOUR });
    expect(bookingProblem(e, 1, 0, now, 'website')).toBe(
      'Bookings for this event are not open yet.'
    );
    expect(bookingProblem(e, 1, 0, now + HOUR, 'website')).toBeNull();
    expect(bookingProblem(e, 1, 0, now, 'staff')).toBeNull();
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

describe('waitlistProblem', () => {
  it('accepts a party the event has no room for', () => {
    expect(waitlistProblem(event(), 2, 10, now)).toBeNull();
    // Room for 1, party of 3: they cannot be booked, so they can wait.
    expect(waitlistProblem(event(), 3, 9, now)).toBeNull();
  });

  it('sends a party that fits to be booked instead', () => {
    expect(waitlistProblem(event(), 2, 8, now)).toBe(
      'There are 2 places left, so add them as a guest instead.'
    );
    expect(waitlistProblem(event(), 1, 9, now)).toBe(
      'There is a place left, so add them as a guest instead.'
    );
  });

  it('has no waiting list for an event with no limit', () => {
    expect(waitlistProblem(event({ capacity: null }), 2, 500, now)).toBe(
      'This event has no limit, so it has no waiting list.'
    );
  });

  it('keeps a booking’s other rules: cancelled, finished and party size', () => {
    expect(waitlistProblem(event({ status: 'cancelled' }), 2, 10, now)).toBe(
      'This event has been cancelled.'
    );
    expect(waitlistProblem(event(), 2, 10, now + 51 * HOUR)).toBe('This event has finished.');
    expect(waitlistProblem(event(), 51, 10, now)).toBe('Bookings are limited to 50 people.');
    expect(waitlistProblem(event(), 0, 10, now)).toBe('Book at least one place.');
  });
});

describe('promoteProblem', () => {
  it('lets a party move in when it fits, or when there is no limit', () => {
    expect(promoteProblem(10, 6, 4)).toBeNull();
    expect(promoteProblem(null, 900, 4)).toBeNull();
  });

  it('says why it cannot', () => {
    expect(promoteProblem(10, 10, 2)).toBe('This event is still fully booked.');
    expect(promoteProblem(10, 9, 2)).toBe('Only 1 place is left.');
    expect(promoteProblem(10, 7, 4)).toBe('Only 3 places are left.');
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

describe('deleteEventProblem', () => {
  it('refuses an upcoming event that still has bookings, so its guests are told first', () => {
    expect(deleteEventProblem(event(), 2, now)).toBe(
      'This event has bookings. Cancel it first, so its guests are told.'
    );
  });

  it('allows events with no bookings, cancelled events and past events', () => {
    expect(deleteEventProblem(event(), 0, now)).toBeNull();
    expect(deleteEventProblem(event({ status: 'cancelled' }), 5, now)).toBeNull();
    expect(deleteEventProblem(event(), 5, now + 51 * HOUR)).toBeNull();
  });
});

describe('stateTimeZone', () => {
  it("gives each state its capital's time zone", () => {
    expect(stateTimeZone('WA')).toBe('Australia/Perth');
    expect(stateTimeZone('QLD')).toBe('Australia/Brisbane');
    expect(stateTimeZone('NT')).toBe('Australia/Darwin');
    expect(stateTimeZone('SA')).toBe('Australia/Adelaide');
    expect(stateTimeZone('TAS')).toBe('Australia/Hobart');
    expect(stateTimeZone('ACT')).toBe('Australia/Sydney');
    expect(stateTimeZone('NSW')).toBe('Australia/Sydney');
    expect(stateTimeZone('VIC')).toBe('Australia/Melbourne');
  });
});

describe('event booking window', () => {
  const input = {
    title: 'An event',
    locationId: null,
    timeZone: 'Australia/Perth',
    startsAt: 10_000,
    endsAt: 20_000,
    heroMediaId: null,
    capacity: null,
    maxPartySize: 10,
    bookingsCloseAt: null,
    status: 'draft',
  };

  it('opens as soon as it is published unless set', () => {
    expect(eventInputSchema.parse(input).bookingsOpenAt).toBeNull();
  });

  it('must open before bookings close, or before it starts', () => {
    const ok = (patch: object) => eventInputSchema.safeParse({ ...input, ...patch }).success;
    expect(ok({ bookingsOpenAt: 5_000 })).toBe(true);
    expect(ok({ bookingsOpenAt: 10_000 })).toBe(false);
    expect(ok({ bookingsOpenAt: 5_000, bookingsCloseAt: 6_000 })).toBe(true);
    expect(ok({ bookingsOpenAt: 6_000, bookingsCloseAt: 6_000 })).toBe(false);
  });
});

describe('event photos', () => {
  const input = {
    title: 'An event',
    locationId: null,
    timeZone: 'Australia/Perth',
    startsAt: 1000,
    endsAt: 2000,
    heroMediaId: 'cover',
    capacity: null,
    maxPartySize: 6,
    bookingsCloseAt: null,
    status: 'draft',
  };
  const others = (n: number) => Array.from({ length: n }, (_, i) => `photo-${i}`);

  it('has no other photos unless given', () => {
    expect(eventInputSchema.parse(input).galleryMediaIds).toEqual([]);
  });

  it('keeps the photos in the order given', () => {
    const galleryMediaIds = ['b', 'a', 'c'];
    expect(eventInputSchema.parse({ ...input, galleryMediaIds }).galleryMediaIds).toEqual(
      galleryMediaIds
    );
  });

  it('allows the limit with the cover, and no more', () => {
    const fits = others(EVENT_PHOTO_LIMIT - 1);
    expect(eventInputSchema.safeParse({ ...input, galleryMediaIds: fits }).success).toBe(true);
    const over = others(EVENT_PHOTO_LIMIT);
    expect(eventInputSchema.safeParse({ ...input, galleryMediaIds: over }).success).toBe(false);
  });
});

describe('changedFields', () => {
  it('leaves out a list or rich text that holds the same values', () => {
    const was = { galleryMediaIds: ['a', 'b'], description: { type: 'doc' }, title: 'One' };
    const next = { galleryMediaIds: ['a', 'b'], description: { type: 'doc' }, title: 'One' };
    expect(changedFields(was, next)).toEqual({});
  });

  it('sees a new order as a change', () => {
    expect(changedFields({ galleryMediaIds: ['a', 'b'] }, { galleryMediaIds: ['b', 'a'] })).toEqual(
      {
        galleryMediaIds: ['b', 'a'],
      }
    );
  });

  it('ignores fields the comparison does not cover', () => {
    expect(changedFields({ title: 'One' }, { title: 'Two', updatedBy: 'someone' })).toEqual({
      title: 'Two',
    });
  });
});

describe('groupEventDates', () => {
  const day = 24 * HOUR;
  const at = (id: string, days: number, seriesId: string | null = 'series') => ({
    id,
    seriesId,
    startsAt: now + days * day,
    endsAt: now + days * day + HOUR,
  });

  it('makes one group of the dates of a series, soonest first', () => {
    const groups = groupEventDates([at('c', 9), at('a', 1), at('b', 5)], now);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.key).toBe('series');
    expect(groups[0]!.dates.map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps an event that does not repeat on its own', () => {
    const groups = groupEventDates([at('solo', 1, null), at('other', 2, null)], now);
    expect(groups.map((g) => g.key)).toEqual(['solo', 'other']);
  });

  it('leads with the next date still to come', () => {
    const [group] = groupEventDates([at('past', -3), at('next', 2), at('later', 7)], now);
    expect(group!.lead.id).toBe('next');
    expect(group!.upcoming).toBe(true);
  });

  it('counts a date under way as still to come', () => {
    const started = { id: 'now', seriesId: 'series', startsAt: now - HOUR, endsAt: now + HOUR };
    const [group] = groupEventDates([at('past', -3), started, at('later', 7)], now);
    expect(group!.lead.id).toBe('now');
  });

  it('leads with the latest date once they have all passed', () => {
    const [group] = groupEventDates([at('old', -9), at('latest', -2)], now);
    expect(group!.lead.id).toBe('latest');
    expect(group!.upcoming).toBe(false);
  });
});

describe('guestInputSchema', () => {
  const guest = { eventId: 'e', firstName: 'Sam', partySize: 1 };
  const problem = (over: object) => {
    const result = guestInputSchema.safeParse({ ...guest, ...over });
    return result.success ? null : result.error.issues[0]!.message;
  };

  it('needs only a first name and how many people', () => {
    expect(problem({})).toBeNull();
    expect(problem({ firstName: '   ' })).toMatch(/first name/i);
  });

  it.each(["O'Brien", 'Mary-Jane', 'José', 'Nguyễn Thị', 'St. John', 'D’Arcy'])(
    'takes %s as a name',
    (name) => {
      expect(problem({ firstName: name, lastName: name })).toBeNull();
    }
  );

  it.each(['Sam1', '12345', 'Sam@home', '<b>Sam</b>', '-', "'"])('refuses %s as a name', (name) => {
    expect(problem({ firstName: name })).toMatch(/letters/i);
    expect(problem({ lastName: name })).toMatch(/letters/i);
  });

  it('leaves a last name, email and phone optional', () => {
    expect(problem({ lastName: '', email: '', phone: '', note: '' })).toBeNull();
  });

  it('refuses an email that is not one', () => {
    expect(problem({ email: 'sam@' })).toMatch(/email/i);
    expect(problem({ email: 'sam@example.com' })).toBeNull();
  });

  it('stores an email in lower case and refuses a malformed one', () => {
    expect(guestInputSchema.parse({ ...guest, email: ' Sam@Example.COM ' }).email).toBe(
      'sam@example.com'
    );
    for (const email of [
      'sam@',
      'sam@example',
      'sam..x@example.com',
      'a@b.c',
      'sam @example.com',
    ]) {
      expect(problem({ email })).toBe('Enter an email like name@example.com.');
    }
  });

  it('stores an Australian phone in one format', () => {
    const parsed = guestInputSchema.parse({ ...guest, phone: '+61 412 345 678' });
    expect(parsed.phone).toBe('0412 345 678');
  });

  it('refuses a phone from elsewhere', () => {
    expect(problem({ phone: '+1 415 555 2671' })).toMatch(/australian/i);
  });

  it.each([0, -1, 1.5, 51])('refuses %s people', (partySize) => {
    expect(problem({ partySize })).toMatch(/1 to 50/);
  });
});

describe('eventSlugProblem', () => {
  it('reserves the address the manage page lives at', () => {
    expect(eventSlugProblem('manage')).toBe('That address is reserved. Choose another.');
  });

  it('allows any other address', () => {
    expect(eventSlugProblem('open-day')).toBeNull();
    expect(eventSlugProblem('manage-your-garden')).toBeNull();
  });
});
