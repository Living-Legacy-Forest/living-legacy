import { eventBookings, events } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from '../../test/fixtures';
import { type HealthOptions, runHealthChecks } from './system-health';

const now = Date.parse('2027-01-20T09:00:00Z');
const hours = (n: number) => n * 3_600_000;

const options = (overrides: Partial<HealthOptions> = {}): HealthOptions => ({
  d1: env.DB,
  bucket: env.MEDIA,
  hubspotConnected: true,
  emailConfigured: true,
  production: true,
  now,
  network: true,
  fetcher: async () => new Response('home', { status: 200 }),
  ...overrides,
});

const byKey = (checks: Awaited<ReturnType<typeof runHealthChecks>>) =>
  Object.fromEntries(checks.map((c) => [c.key, c]));

async function addBooking(createdAt: number, values: Partial<typeof eventBookings.$inferInsert>) {
  const [event] = await testDb()
    .insert(events)
    .values({
      title: 'Open day',
      slug: `open-day-${crypto.randomUUID()}`,
      startsAt: new Date(now),
      endsAt: new Date(now),
    })
    .returning();
  await testDb()
    .insert(eventBookings)
    .values({
      id: crypto.randomUUID(),
      eventId: event!.id,
      reference: `LL-${crypto.randomUUID().slice(0, 6)}`,
      firstName: 'Alex',
      email: 'alex@example.test',
      partySize: 2,
      source: 'website',
      createdAt: new Date(createdAt),
      ...values,
    });
}

beforeEach(async () => {
  await testDb().delete(eventBookings);
  await testDb().delete(events);
});

describe('runHealthChecks', () => {
  it('reads the real database and storage, in the order the page shows them', async () => {
    const checks = await runHealthChecks(options());

    expect(checks.map((c) => c.key)).toEqual([
      'website',
      'database',
      'storage',
      'hubspot',
      'email',
    ]);
    expect(checks.every((c) => c.status === 'ok')).toBe(true);
    expect(byKey(checks).database?.detail).toMatch(/^Answered in \d+ ms\. .+ used of 5 GB\.$/);
  });

  it('leaves out the website and storage when asked not to reach out', async () => {
    let fetched = false;
    const checks = await runHealthChecks(
      options({
        network: false,
        fetcher: async () => {
          fetched = true;
          return new Response();
        },
      })
    );

    expect(checks.map((c) => c.key)).toEqual(['database', 'hubspot', 'email']);
    expect(fetched).toBe(false);
  });

  it('finds bookings stuck on their way to HubSpot, with the latest error', async () => {
    await addBooking(now - hours(5), { crmError: 'HubSpot 401 old' });
    await addBooking(now - hours(2), { crmError: 'HubSpot 401 new' });
    // Already sent, or nothing to send it with: not waiting.
    await addBooking(now - hours(9), { crmSyncedAt: new Date(now - hours(8)) });
    await addBooking(now - hours(9), { email: null });

    const { hubspot } = byKey(await runHealthChecks(options()));

    expect(hubspot).toMatchObject({
      status: 'warning',
      detail: '2 bookings not sent for 5 hours. Last error: HubSpot 401 new',
    });
  });

  it('reports a website that does not answer', async () => {
    const checks = await runHealthChecks(
      options({
        fetcher: async () => {
          throw new DOMException('The operation timed out.', 'TimeoutError');
        },
      })
    );

    expect(byKey(checks).website?.status).toBe('problem');
  });
});
