import type { PublicBookingInput } from '@ll/content';
import { eventBookings, events } from '@ll/db/schema';
import { DrizzleQueryError, eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testDb } from '../../test/fixtures';
import { internalResponse } from './internal-api';
import { DUPLICATE_MESSAGE } from './public-bookings';

const KEY = 'test-key';
const NOT_FOUND = 'We could not find that booking. Check the link in your confirmation email.';

const mutable = env as unknown as Record<string, string | undefined>;

let promises: Promise<unknown>[] = [];
const ctx = { waitUntil: (p: Promise<unknown>) => void promises.push(p) };

type Init = { method?: string; key?: string | null; body?: unknown; raw?: string };

function call(path: string, { method = 'POST', key = KEY, body, raw }: Init = {}) {
  const headers = new Headers();
  if (key !== null) headers.set('x-internal-key', key);
  return internalResponse(
    new Request(`http://cms.test${path}`, {
      method,
      headers,
      body: method === 'GET' ? undefined : (raw ?? JSON.stringify(body)),
    }),
    env,
    ctx
  );
}

async function addEvent() {
  const startsAt = new Date(Date.now() + 14 * 86_400_000);
  const [row] = await testDb()
    .insert(events)
    .values({
      title: 'Open day',
      slug: `open-day-${crypto.randomUUID()}`,
      venue: 'The forest gate',
      startsAt,
      endsAt: startsAt,
      capacity: null,
      status: 'published',
    })
    .returning();
  return row!;
}

const guest = (eventId: string, over: Partial<PublicBookingInput> = {}): PublicBookingInput => ({
  eventId,
  firstName: 'Sam',
  lastName: 'Rivers',
  email: 'sam@example.com',
  phone: '',
  partySize: 2,
  note: '',
  consent: true,
  ...over,
});

async function book(over: Partial<PublicBookingInput> = {}) {
  const event = await addEvent();
  const response = await call('/internal/events/book', { body: guest(event.id, over) });
  return { event, response, json: (await response.clone().json()) as Record<string, unknown> };
}

beforeEach(async () => {
  mutable.INTERNAL_KEY = KEY;
  mutable.MANAGE_TOKEN_SECRET = 'test-secret';
  mutable.BETTER_AUTH_URL = 'http://cms.test';
  mutable.WEBSITE_URL = 'http://website.test';
  promises = [];
  await testDb().delete(eventBookings);
  await testDb().delete(events);
});

describe('POST /internal/events/book', () => {
  it('books and answers with the reference and token', async () => {
    const { response, json } = await book();
    expect(response.status).toBe(200);
    expect(json).toMatchObject({ ok: true, reference: expect.stringMatching(/^LL-/) });
    expect(typeof json.token).toBe('string');
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('answers 409 with the rule when the booking is refused', async () => {
    const response = await call('/internal/events/book', { body: guest(crypto.randomUUID()) });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      message: 'This event is not open for bookings.',
    });
  });

  it('treats "Sam@Example.com " and "sam@example.com" as the same guest', async () => {
    const event = await addEvent();
    const first = await call('/internal/events/book', {
      body: guest(event.id, { email: 'Sam@Example.com ' }),
    });
    expect(first.status).toBe(200);
    const second = await call('/internal/events/book', {
      body: guest(event.id, { email: 'sam@example.com' }),
    });
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ ok: false, message: DUPLICATE_MESSAGE });
  });

  it('queues one confirmation per booking, and none for a refused one', async () => {
    const { event, json } = await book();
    expect(promises).toHaveLength(1);
    await call('/internal/events/book', { body: guest(event.id) });
    expect(promises).toHaveLength(1);

    // The queued work is confirmBooking for this booking: once it has run, the row is stamped.
    const row = async () =>
      testDb().query.eventBookings.findFirst({
        where: eq(eventBookings.reference, json.reference as string),
      });
    await Promise.all(promises);
    expect((await row())?.confirmationSentAt).toBeInstanceOf(Date);
  });

  it('answers 400 with the first issue for a body that fails the schema', async () => {
    const event = await addEvent();
    const response = await call('/internal/events/book', {
      body: { ...guest(event.id), consent: false },
    });
    expect(response.status).toBe(400);
    const json = (await response.json()) as { ok: boolean; message: string };
    expect(json.ok).toBe(false);
    expect(json.message.length).toBeGreaterThan(0);
  });

  it('answers 400 for a body that is not JSON', async () => {
    const response = await call('/internal/events/book', { raw: 'not json' });
    expect(response.status).toBe(400);
    expect((await response.json()) as { ok: boolean }).toMatchObject({ ok: false });
  });
});

describe('view and cancel', () => {
  async function booked() {
    const { json } = await book();
    return { reference: json.reference as string, token: json.token as string };
  }

  it('views a booking', async () => {
    const credentials = await booked();
    const response = await call('/internal/events/view', { body: credentials });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      booking: { reference: credentials.reference, status: 'confirmed', firstName: 'Sam' },
    });
  });

  it('answers 404 for a booking it cannot find', async () => {
    const { reference } = await booked();
    const response = await call('/internal/events/view', {
      body: { reference, token: 'x'.repeat(43) },
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, message: NOT_FOUND });
  });

  it('cancels a booking', async () => {
    const credentials = await booked();
    const response = await call('/internal/events/cancel', { body: credentials });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, booking: { status: 'cancelled' } });
  });

  it('answers 404 when cancelling a booking it cannot find', async () => {
    const response = await call('/internal/events/cancel', {
      body: { reference: 'LL-NOPE', token: 'x'.repeat(43) },
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, message: NOT_FOUND });
  });

  it('answers 400 for a malformed token', async () => {
    const response = await call('/internal/events/view', {
      body: { reference: 'LL-ABC', token: 'short' },
    });
    expect(response.status).toBe(400);
  });
});

describe('guards', () => {
  it('answers 401 without the key', async () => {
    const response = await call('/internal/events/view', { key: null, body: {} });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, message: 'Unauthorised.' });
  });

  it('answers 401 with the wrong key', async () => {
    expect((await call('/internal/events/view', { key: 'nope', body: {} })).status).toBe(401);
  });

  it('answers 503 when INTERNAL_KEY is not set, even for a request with a key', async () => {
    delete mutable.INTERNAL_KEY;
    expect((await call('/internal/events/view', { key: '', body: {} })).status).toBe(503);
    expect((await call('/internal/events/view', { body: {} })).status).toBe(503);
  });

  it('answers 503 when MANAGE_TOKEN_SECRET is not set', async () => {
    delete mutable.MANAGE_TOKEN_SECRET;
    expect((await call('/internal/events/view', { body: {} })).status).toBe(503);
  });

  it('answers 405 for another method', async () => {
    const response = await call('/internal/events/view', { method: 'GET' });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });

  it('answers 404 for another path', async () => {
    expect((await call('/internal/events/other', { body: {} })).status).toBe(404);
    expect((await call('/internal/nothing', { body: {} })).status).toBe(404);
  });
});

describe('unexpected errors', () => {
  it('answers 500 as JSON when the store fails', async () => {
    const broken = Object.create(env, {
      DB: {
        value: {
          prepare: () => {
            throw new Error('D1 is down');
          },
        },
      },
    }) as Cloudflare.Env;
    const response = await internalResponse(
      new Request('http://cms.test/internal/events/view', {
        method: 'POST',
        headers: { 'x-internal-key': KEY },
        body: JSON.stringify({ reference: 'LL-ABC', token: 'x'.repeat(43) }),
      }),
      broken,
      ctx
    );
    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      ok: false,
      message: 'Something went wrong on our side. Please try again in a moment.',
    });
  });

  it('logs nothing the guest typed when a real database query fails', async () => {
    const typed = ['Sam', 'Tester', 'sam@example.test', '0412345678', 'uses a wheelchair'];
    // The real error drizzle-orm throws: its name stays "Error" and its message holds the values.
    const failure = new DrizzleQueryError(
      'insert into event_bookings (first_name, last_name, email, phone, note) values (?, ?, ?, ?, ?)',
      typed,
      new Error('D1_ERROR: locked')
    );
    const broken = Object.create(env, {
      DB: {
        value: {
          prepare: () => {
            throw failure;
          },
        },
      },
    }) as Cloudflare.Env;
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await internalResponse(
        new Request('http://cms.test/internal/events/book', {
          method: 'POST',
          headers: { 'x-internal-key': KEY },
          body: JSON.stringify(guest(crypto.randomUUID())),
        }),
        broken,
        ctx
      );
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        ok: false,
        message: 'Something went wrong on our side. Please try again in a moment.',
      });
      const output = JSON.stringify(logged.mock.calls);
      for (const value of typed) expect(output).not.toContain(value);
      expect(output).not.toContain('params:');
      expect(output).not.toContain('Failed query');
      expect(output).toContain('D1_ERROR: locked');
    } finally {
      logged.mockRestore();
    }
  });
});
