// The jobs the Worker's cron triggers run (src/server.ts), against local D1 and R2.
import { activityLog, eventBookings, events, media, notFoundPaths, user } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addUser, days, minutes, testDb } from '../../test/fixtures';
import { publishDueEvents, purgeOldBookings } from './event-jobs';
import { sweepOrphanedMedia } from './media-sweep';
import { pruneMissingPages } from './not-found';

const now = new Date('2027-01-20T09:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

afterEach(() => {
  vi.restoreAllMocks();
});

async function addEvent(values: Partial<typeof events.$inferInsert> & { slug: string }) {
  const [row] = await testDb()
    .insert(events)
    .values({ title: 'Open day', startsAt: now, endsAt: now, ...values })
    .returning();
  return row!;
}

const eventStatus = async (id: string) =>
  (await testDb().query.events.findFirst({ where: eq(events.id, id) }))!.status;

describe('publishDueEvents', () => {
  beforeEach(async () => {
    await testDb().delete(events);
    await testDb().delete(activityLog);
  });

  it('publishes due drafts and logs each series once', async () => {
    const userId = await addUser('editor', 'Robin Editor');
    const due = { publishAt: ago(minutes(2)), updatedBy: userId };
    const single = await addEvent({ slug: 'tree-talk', title: 'Tree talk', ...due });
    const seriesA = await addEvent({
      slug: 'walk-1',
      title: 'Forest walk',
      seriesId: 's1',
      ...due,
    });
    const seriesB = await addEvent({
      slug: 'walk-2',
      title: 'Forest walk',
      seriesId: 's1',
      ...due,
    });
    const later = await addEvent({ slug: 'later', publishAt: new Date(now.getTime() + days(1)) });

    expect(await publishDueEvents(env.DB, now)).toEqual({ published: 3 });
    for (const e of [single, seriesA, seriesB]) expect(await eventStatus(e.id)).toBe('published');
    expect(await eventStatus(later.id)).toBe('draft');

    const summaries = (await testDb().select().from(activityLog)).map((a) => a.summary).sort();
    expect(summaries).toEqual([
      'Published the event Forest walk on 2 dates, as scheduled',
      'Published the event Tree talk, as scheduled',
    ]);
  });

  it('does not republish an event someone cancelled in the meantime', async () => {
    const cancelled = await addEvent({
      slug: 'rained-out',
      status: 'cancelled',
      publishAt: ago(minutes(1)),
    });
    expect(await publishDueEvents(env.DB, now)).toEqual({ published: 0 });
    expect(await eventStatus(cancelled.id)).toBe('cancelled');
  });
});

describe('purgeOldBookings', () => {
  it('deletes guest details a year after the event, and keeps the event', async () => {
    await testDb().delete(events);
    const old = await addEvent({ slug: 'old', startsAt: ago(days(400)), endsAt: ago(days(400)) });
    const recent = await addEvent({
      slug: 'recent',
      startsAt: ago(days(30)),
      endsAt: ago(days(30)),
    });
    const booking = (eventId: string, reference: string) => ({
      eventId,
      reference,
      id: reference,
      firstName: 'Alex',
      partySize: 2,
      source: 'website' as const,
      createdAt: ago(days(410)),
    });
    await testDb()
      .insert(eventBookings)
      .values([booking(old.id, 'LL-OLD001'), booking(recent.id, 'LL-NEW001')]);

    await purgeOldBookings(env.DB, now);

    const left = await testDb().select({ ref: eventBookings.reference }).from(eventBookings);
    expect(left).toEqual([{ ref: 'LL-NEW001' }]);
    expect(await testDb().query.events.findFirst({ where: eq(events.id, old.id) })).toBeDefined();
  });
});

describe('pruneMissingPages', () => {
  it('forgets paths nobody has asked for in 90 days', async () => {
    await testDb()
      .insert(notFoundPaths)
      .values([
        { path: '/stale', hits: 50, firstSeenAt: ago(days(200)), lastSeenAt: ago(days(91)) },
        { path: '/fresh', hits: 1, firstSeenAt: ago(days(1)), lastSeenAt: ago(days(1)) },
      ]);

    await pruneMissingPages(env.DB, now);

    const left = await testDb().select({ path: notFoundPaths.path }).from(notFoundPaths);
    expect(left).toEqual([{ path: '/fresh' }]);
  });
});

describe('sweepOrphanedMedia', () => {
  // R2 stamps uploads with the real time, so the sweep runs "two days later"
  // to get past the grace period for files still being uploaded.
  const later = () => new Date(Date.now() + days(2));

  beforeEach(async () => {
    await testDb().delete(media);
    const listed = await env.MEDIA.list();
    if (listed.objects.length) await env.MEDIA.delete(listed.objects.map((o) => o.key));
  });

  async function store(...keys: string[]) {
    for (const key of keys) await env.MEDIA.put(key, 'x');
  }

  async function addMedia(r2Key: string, variants: { key: string; width: number }[] = []) {
    await testDb()
      .insert(media)
      .values({ r2Key, filename: r2Key, mime: 'image/webp', size: 1, variants: variants as never });
  }

  it('deletes only files nothing points at', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const userId = await addUser();
    await testDb()
      .update(user)
      .set({ image: '/api/avatar/avatar-1.webp' })
      .where(eq(user.id, userId));
    await addMedia('photo.webp', [{ key: 'photo-640.webp', width: 640 }]);
    await addMedia('other.webp');
    await store('photo.webp', 'photo-640.webp', 'other.webp', 'avatar-1.webp', 'lost.webp');

    expect(await sweepOrphanedMedia(env.DB, env.MEDIA, later())).toEqual({
      deleted: 1,
      refused: false,
    });
    const keys = (await env.MEDIA.list()).objects.map((o) => o.key).sort();
    expect(keys).toEqual(['avatar-1.webp', 'other.webp', 'photo-640.webp', 'photo.webp']);
  });

  it('keeps a banner a user points at', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const userId = await addUser();
    await testDb()
      .update(user)
      .set({ banner: '/api/banner/banner-1.webp' })
      .where(eq(user.id, userId));
    await addMedia('photo.webp');
    await addMedia('other.webp');
    await store('photo.webp', 'other.webp', 'banner-1.webp', 'lost.webp');

    expect(await sweepOrphanedMedia(env.DB, env.MEDIA, later())).toEqual({
      deleted: 1,
      refused: false,
    });
    const keys = (await env.MEDIA.list()).objects.map((o) => o.key).sort();
    expect(keys).toEqual(['banner-1.webp', 'other.webp', 'photo.webp']);
  });

  it('keeps files still within the upload grace period', async () => {
    await addMedia('kept.webp');
    await store('kept.webp', 'uploading.webp', 'also-kept.webp');
    await addMedia('also-kept.webp');
    expect(await sweepOrphanedMedia(env.DB, env.MEDIA, new Date())).toEqual({
      deleted: 0,
      refused: false,
    });
  });

  it('deletes nothing when most files look unused, which points to a bad lookup', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await addMedia('one.webp');
    await store('one.webp', 'a.webp', 'b.webp', 'c.webp');

    expect(await sweepOrphanedMedia(env.DB, env.MEDIA, later())).toEqual({
      deleted: 0,
      refused: true,
    });
    expect((await env.MEDIA.list()).objects).toHaveLength(4);
  });
});
