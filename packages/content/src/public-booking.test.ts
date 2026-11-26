import { describe, expect, it } from 'vitest';
import { bookingProblem, publicBookingSchema } from './events';
import { bookingState, hashManageToken, manageToken, manageUrl, safeEqual } from './public-booking';
import { parseSiteSettings } from './settings';

describe('publicBookingSchema', () => {
  const valid = {
    eventId: 'e1',
    firstName: 'Sam',
    lastName: '',
    email: ' Sam@Example.TEST ',
    phone: '',
    partySize: 2,
    note: '',
    consent: true,
  };
  it('lowercases and trims the email', () =>
    expect(publicBookingSchema.parse(valid).email).toBe('sam@example.test'));
  it('requires an email', () =>
    expect(publicBookingSchema.safeParse({ ...valid, email: '' }).success).toBe(false));
  it('requires consent', () =>
    expect(publicBookingSchema.safeParse({ ...valid, consent: false }).success).toBe(false));
});

describe('bookingState', () => {
  const event = {
    status: 'published',
    startsAt: 2_000,
    endsAt: 3_000,
    bookingsOpenAt: null,
    bookingsCloseAt: null,
    capacity: 10,
    maxPartySize: 6,
  } as const;
  it.each([
    [{}, 0, 1_000, 'open'],
    [{}, 10, 1_000, 'full'],
    [{ capacity: null }, 99, 1_000, 'open'],
    [{ bookingsOpenAt: 1_500 }, 0, 1_000, 'not-yet'],
    [{}, 0, 2_000, 'closed'],
    [{ status: 'cancelled' }, 0, 1_000, 'cancelled'],
    [{ status: 'draft' }, 0, 1_000, 'closed'],
    [{ bookingsCloseAt: 1_800 }, 0, 1_900, 'closed'],
    [{ bookingsOpenAt: 1_500 }, 0, 1_500, 'open'],
    [{ capacity: 1 }, 0, 1_000, 'open'],
  ] as const)('bookingState %o taken %i at %i is %s', (patch, taken, now, state) => {
    const e = { ...event, ...patch };
    expect(bookingState(e, taken, now)).toBe(state);
    // It must agree with bookingProblem for one person: open exactly when nothing stops them, and
    // a problem never reads as open.
    const problem = bookingProblem(e, 1, taken, now, 'website');
    expect(bookingState(e, taken, now) === 'open').toBe(problem === null);
    if (problem !== null) expect(bookingState(e, taken, now)).not.toBe('open');
  });
});

describe('manage tokens', () => {
  it('derives the same token for the same booking', async () => {
    const a = await manageToken('s', 'b1');
    expect(a).toBe(await manageToken('s', 'b1'));
    expect(a).not.toBe(await manageToken('s', 'b2'));
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it('hashes to 64 hex characters', async () =>
    expect(await hashManageToken('abc')).toMatch(/^[0-9a-f]{64}$/));
  it('compares safely', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
  it('builds the manage link', () =>
    expect(manageUrl('https://x.test', 'LL-ABC234', 'a-b_c')).toBe(
      'https://x.test/events/manage/?ref=LL-ABC234&token=a-b_c'
    ));
});

describe('site settings', () => {
  it('sends confirmations by default', () => {
    expect(parseSiteSettings(undefined).sendBookingConfirmations).toBe(true);
    expect(parseSiteSettings({ sendBookingConfirmations: false }).sendBookingConfirmations).toBe(
      false
    );
  });
});
