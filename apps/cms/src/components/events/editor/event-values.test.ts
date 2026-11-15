import { fromZoned, toZoned } from '@ll/content';
import { describe, expect, it } from 'vitest';
import type { EventRow } from '@/server/events';
import { noRepeat } from '../repeat-field';
import {
  expandEventTimes,
  initialEventValues,
  isEventDirty,
  rezoneValues,
  savedValues,
  timesProblem,
} from './event-values';

const MELBOURNE = 'Australia/Melbourne';
/** 10:00 to 11:00 on a day (month is 0-based), in Melbourne. */
const slot = (year: number, month: number, day: number) => ({
  startsAt: fromZoned({ year, month, day, hour: 10, minute: 0 }, MELBOURNE),
  endsAt: fromZoned({ year, month, day, hour: 11, minute: 0 }, MELBOURNE),
});
const clockOf = (ms: number) => {
  const w = toZoned(ms, MELBOURNE);
  return `${w.hour}:${String(w.minute).padStart(2, '0')}`;
};

const event: EventRow = {
  id: 'e1',
  title: 'Open day',
  slug: 'open-day',
  locationId: null,
  locationName: null,
  venue: '',
  startsAt: slot(2026, 10, 14).startsAt,
  endsAt: slot(2026, 10, 14).endsAt,
  summary: '',
  description: null,
  heroMediaId: null,
  galleryMediaIds: [],
  capacity: null,
  maxPartySize: 10,
  bookingsOpenAt: null,
  bookingsCloseAt: null,
  seriesId: null,
  timeZone: MELBOURNE,
  status: 'draft',
  publishAt: null,
  booked: 0,
  bookings: 0,
  checkedIn: 0,
};

describe('timesProblem', () => {
  const base = {
    times: slot(2026, 10, 14),
    sessions: [],
    zone: MELBOURNE,
    repeat: noRepeat,
    isNew: true,
  };

  it('asks for a date and times when there are none', () => {
    expect(timesProblem({ ...base, times: null })).toBe('Pick its date and times.');
  });

  it('needs the event to end after it starts', () => {
    const { startsAt } = slot(2026, 10, 14);
    expect(timesProblem({ ...base, times: { startsAt, endsAt: startsAt } })).toBe(
      'It must end after it starts.'
    );
  });

  it('needs each extra time to end after it starts', () => {
    expect(timesProblem({ ...base, sessions: [{ start: '4:00 pm', end: '2:00 pm' }] })).toBe(
      'Each extra time needs a start and a later end, like 2:00 pm to 4:00 pm.'
    );
  });

  it('needs a new repeating event to say when it stops', () => {
    const weeklyUntil = { ...noRepeat, repeat: 'weekly' as const, ends: 'until' as const };
    expect(timesProblem({ ...base, repeat: weeklyUntil })).toBe('Pick when it stops repeating.');
    expect(timesProblem({ ...base, repeat: weeklyUntil, isNew: false })).toBeNull();
  });

  it('accepts a single event', () => {
    expect(timesProblem(base)).toBeNull();
  });
});

describe('expandEventTimes', () => {
  it('makes each date at each time, keeping 10:00 and 2:00 pm across daylight saving', () => {
    const first = slot(2026, 8, 26);
    const times = expandEventTimes(
      first,
      { ...noRepeat, repeat: 'weekly', ends: 'count', count: 3 },
      [{ start: '2:00 pm', end: '4:00 pm' }],
      MELBOURNE
    );

    expect(times).toHaveLength(6);
    expect(times[0]).toEqual(first);
    // 26 Sep, 3 Oct (daylight saving starts that day) and 10 Oct: 10:00 and 2:00 pm each.
    expect(times.map((t) => clockOf(t.startsAt))).toEqual([
      '10:00',
      '14:00',
      '10:00',
      '14:00',
      '10:00',
      '14:00',
    ]);
  });
});

describe('rezoneValues', () => {
  it('keeps clock times when the zone changes, and leaves unset times unset', () => {
    const values = initialEventValues(event, MELBOURNE);

    const moved = rezoneValues(values, 'Australia/Perth');

    expect(moved.timeZone).toBe('Australia/Perth');
    expect(toZoned(moved.startsAt!, 'Australia/Perth').hour).toBe(10);
    expect(moved.bookingsOpenAt).toBeNull();
  });
});

describe('isEventDirty', () => {
  const saved = initialEventValues(event, MELBOURNE);
  const quiet = { sessions: [], repeat: noRepeat };

  it('is clean until something changes', () => {
    expect(isEventDirty(saved, saved, quiet)).toBe(false);
    expect(isEventDirty({ ...saved, title: 'Other' }, saved, quiet)).toBe(true);
  });

  it('counts an added session or a repeat on a new event', () => {
    const blank = initialEventValues(null, MELBOURNE);
    expect(
      isEventDirty(blank, blank, { sessions: [{ start: '', end: '' }], repeat: noRepeat })
    ).toBe(true);
    expect(
      isEventDirty(blank, blank, { sessions: [], repeat: { ...noRepeat, repeat: 'weekly' } })
    ).toBe(true);
  });
});

describe('savedValues', () => {
  it('is what was sent: the form with the changes made on top of it', () => {
    const form = { ...initialEventValues(event, MELBOURNE), title: 'Renamed' };

    const sent = savedValues(form, { status: 'published', publishAt: null });

    expect(sent).toEqual({ ...form, status: 'published', publishAt: null });
    // Typing after Save is a new change; what was just saved is not.
    expect(isEventDirty(sent, sent, { sessions: [], repeat: noRepeat })).toBe(false);
    expect(
      isEventDirty({ ...sent, title: 'Again' }, sent, { sessions: [], repeat: noRepeat })
    ).toBe(true);
  });
});
