import { hashManageToken, manageToken } from '@ll/content';
import { eventBookings, events } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testDb } from '../../test/fixtures';
import { type BookingConfirmation } from '@/lib/email';
import { insertBooking, type NewBooking } from './booking-store';
import { confirmBooking, type ConfirmDeps, retryConfirmations } from './booking-confirmations';

const SECRET = 'test-manage-secret';
const HOUR = 3_600_000;
const now = new Date('2027-01-10T00:00:00Z');
const startsAt = new Date('2027-03-10T02:30:00Z');

let slugs = 0;

async function addEvent() {
  const [row] = await testDb()
    .insert(events)
    .values({
      title: 'Open day',
      slug: `open-day-${++slugs}`,
      venue: 'The forest gate',
      startsAt,
      endsAt: startsAt,
      status: 'published',
    })
    .returning();
  return row!;
}

/** A website booking the way `bookFromWebsite` writes it, with a chosen creation time. */
async function addBooking(
  eventId: string,
  over: Partial<NewBooking> = {},
  createdAt: Date = new Date(now.getTime() - HOUR)
) {
  const id = crypto.randomUUID();
  const booking = await insertBooking(
    testDb(),
    {
      id,
      manageTokenHash: await hashManageToken(await manageToken(SECRET, id)),
      eventId,
      firstName: 'Alex',
      lastName: 'Rivers',
      email: 'alex@example.com',
      phone: null,
      partySize: 2,
      note: null,
      source: 'website',
      consentAt: now,
      ...over,
    },
    null
  );
  await testDb().update(eventBookings).set({ createdAt }).where(eq(eventBookings.id, id));
  return booking!;
}

const stored = (id: string) =>
  testDb().query.eventBookings.findFirst({ where: eq(eventBookings.id, id) });

function fakeDeps(over: Partial<ConfirmDeps> = {}) {
  const calls: { to: string; c: BookingConfirmation }[] = [];
  const deps: ConfirmDeps = {
    send: async (to, c) => {
      calls.push({ to, c });
    },
    secret: SECRET,
    websiteOrigin: 'https://web.example.test',
    cmsOrigin: 'https://cms.example.test',
    enabled: async () => true,
    ...over,
  };
  return { deps, calls };
}

beforeEach(async () => {
  await testDb().delete(eventBookings);
  await testDb().delete(events);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('confirmBooking', () => {
  it('sends once and stamps it', async () => {
    const event = await addEvent();
    const booking = await addBooking(event.id);
    const { deps, calls } = fakeDeps();

    expect(await confirmBooking(testDb(), booking.id, deps, now)).toBe('sent');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.to).toBe('alex@example.com');
    expect(calls[0]!.c).toMatchObject({
      firstName: 'Alex',
      reference: booking.reference,
      partySize: 2,
      title: 'Open day',
      venue: 'The forest gate',
      calendarUrl: `https://cms.example.test/api/tickets/${booking.reference}/calendar`,
      qrUrl: `https://cms.example.test/api/tickets/${booking.reference}/qr`,
    });
    expect((await stored(booking.id))?.confirmationSentAt?.getTime()).toBe(now.getTime());

    expect(await confirmBooking(testDb(), booking.id, deps, now)).toBe('skipped');
    expect(calls).toHaveLength(1);
  });

  it('sends a link that works', async () => {
    const event = await addEvent();
    const booking = await addBooking(event.id);
    const { deps, calls } = fakeDeps();
    await confirmBooking(testDb(), booking.id, deps, now);

    const url = new URL(calls[0]!.c.manageUrl);
    expect(url.origin).toBe('https://web.example.test');
    expect(url.searchParams.get('ref')).toBe(booking.reference);
    const token = url.searchParams.get('token')!;
    expect(await hashManageToken(token)).toBe((await stored(booking.id))?.manageTokenHash);
  });

  it('skips when turned off, and does not stamp', async () => {
    const event = await addEvent();
    const booking = await addBooking(event.id);
    const { deps, calls } = fakeDeps({ enabled: async () => false });

    expect(await confirmBooking(testDb(), booking.id, deps, now)).toBe('skipped');
    expect(calls).toHaveLength(0);
    expect((await stored(booking.id))?.confirmationSentAt).toBeNull();
  });

  it('skips staff bookings, cancelled bookings and bookings with no email', async () => {
    const event = await addEvent();
    const staff = await addBooking(event.id, { source: 'staff' });
    const cancelled = await addBooking(event.id, { email: 'b@example.com' });
    await testDb()
      .update(eventBookings)
      .set({ status: 'cancelled' })
      .where(eq(eventBookings.id, cancelled.id));
    const noEmail = await addBooking(event.id, { email: null });
    const { deps, calls } = fakeDeps();

    for (const b of [staff, cancelled, noEmail]) {
      expect(await confirmBooking(testDb(), b.id, deps, now)).toBe('skipped');
    }
    expect(await confirmBooking(testDb(), 'no-such-booking', deps, now)).toBe('skipped');
    expect(calls).toHaveLength(0);
  });

  it('keeps the booking when the email fails, and leaves it unstamped', async () => {
    const event = await addEvent();
    const booking = await addBooking(event.id);
    const { deps } = fakeDeps({
      send: async () => {
        throw new Error('Cloudflare Email Service failed (E_DOWN)');
      },
    });

    expect(await confirmBooking(testDb(), booking.id, deps, now)).toBe('failed');
    const row = await stored(booking.id);
    expect(row?.status).toBe('confirmed');
    expect(row?.confirmationSentAt).toBeNull();
  });

  it('never writes the guest address to the log when it fails', async () => {
    const event = await addEvent();
    const booking = await addBooking(event.id);
    const { deps } = fakeDeps({
      send: async () => {
        throw new Error('down');
      },
    });
    await confirmBooking(testDb(), booking.id, deps, now);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('alex@example.com');
  });

  it('does not email a link that would not work, when the secret has changed', async () => {
    const event = await addEvent();
    const booking = await addBooking(event.id);
    const { deps, calls } = fakeDeps({ secret: 'a-different-secret' });

    expect(await confirmBooking(testDb(), booking.id, deps, now)).toBe('failed');
    expect(calls).toHaveLength(0);
    expect((await stored(booking.id))?.confirmationSentAt).toBeNull();
  });

  it('fails without a secret rather than sending a dead link', async () => {
    const event = await addEvent();
    const booking = await addBooking(event.id);
    const { deps, calls } = fakeDeps({ secret: '' });

    expect(await confirmBooking(testDb(), booking.id, deps, now)).toBe('failed');
    expect(calls).toHaveLength(0);
  });
});

describe('retryConfirmations', () => {
  it('retries for a day, then gives up', async () => {
    const event = await addEvent();
    const recent = await addBooking(event.id, {}, new Date(now.getTime() - HOUR));
    const old = await addBooking(
      event.id,
      { email: 'old@example.com' },
      new Date(now.getTime() - 25 * HOUR)
    );
    const cancelled = await addBooking(
      event.id,
      { email: 'c@example.com' },
      new Date(now.getTime() - HOUR)
    );
    await testDb()
      .update(eventBookings)
      .set({ status: 'cancelled' })
      .where(eq(eventBookings.id, cancelled.id));
    const { deps, calls } = fakeDeps();

    expect(await retryConfirmations(testDb(), deps, now)).toEqual({ sent: 1, failed: 0 });
    expect(calls.map((c) => c.c.reference)).toEqual([recent.reference]);
    expect((await stored(old.id))?.confirmationSentAt).toBeNull();
  });

  it('leaves a booking alone for two minutes, so its first email can finish', async () => {
    const event = await addEvent();
    await addBooking(event.id, { email: 'new@example.com' }, new Date(now.getTime() - 60_000));
    const settled = await addBooking(
      event.id,
      { email: 'settled@example.com' },
      new Date(now.getTime() - 3 * 60_000)
    );
    const { deps, calls } = fakeDeps();

    expect(await retryConfirmations(testDb(), deps, now)).toEqual({ sent: 1, failed: 0 });
    expect(calls.map((c) => c.c.reference)).toEqual([settled.reference]);
  });

  it('does not resend one that already went', async () => {
    const event = await addEvent();
    await addBooking(event.id);
    const { deps, calls } = fakeDeps();

    await retryConfirmations(testDb(), deps, now);
    expect(await retryConfirmations(testDb(), deps, now)).toEqual({ sent: 0, failed: 0 });
    expect(calls).toHaveLength(1);
  });

  it('counts failures and carries on with the rest', async () => {
    const event = await addEvent();
    await addBooking(event.id, { email: 'bad@example.com' });
    await addBooking(event.id, { email: 'good@example.com' });
    const { deps, calls } = fakeDeps({
      send: async (to, c) => {
        if (to.startsWith('bad')) throw new Error('down');
        calls.push({ to, c });
      },
    });

    expect(await retryConfirmations(testDb(), deps, now)).toEqual({ sent: 1, failed: 1 });
    expect(calls).toHaveLength(1);
  });

  it('sends nothing while confirmations are turned off', async () => {
    const event = await addEvent();
    await addBooking(event.id);
    const { deps, calls } = fakeDeps({ enabled: async () => false });

    expect(await retryConfirmations(testDb(), deps, now)).toEqual({ sent: 0, failed: 0 });
    expect(calls).toHaveLength(0);
  });
});
