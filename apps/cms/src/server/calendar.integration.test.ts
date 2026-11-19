// The content calendar, against local D1: which posts and events land on a month, and which do not.
import { events, posts } from '@ll/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from '../../test/fixtures';
import { loadCalendar } from './calendar';

// November 2026, whose grid runs from Monday 26 October to Sunday 6 December.
const NOVEMBER = { year: 2026, month: 10 };
const at = (month: number, day: number, hour = 9) => new Date(Date.UTC(2026, month, day, hour));

beforeEach(async () => {
  const db = testDb();
  await db.delete(posts);
  await db.delete(events);
});

const entries = (includeEvents = true) =>
  loadCalendar(testDb(), NOVEMBER, { includeEvents }).then((all) =>
    all.map((e) => [e.kind, e.title, e.state] as const).sort((a, b) => a[1].localeCompare(b[1]))
  );

const event = (over: Partial<typeof events.$inferInsert>) => ({
  title: 'Open day',
  slug: 'open-day',
  startsAt: at(10, 14),
  endsAt: at(10, 14, 11),
  ...over,
});

describe('content calendar', () => {
  it('shows scheduled and published posts on the day they go live or went live', async () => {
    await testDb()
      .insert(posts)
      .values([
        { title: 'Scheduled', slug: 'a', status: 'draft', scheduledAt: at(10, 20) },
        { title: 'Published', slug: 'b', status: 'published', publishedAt: at(10, 3) },
      ]);
    expect(await entries()).toEqual([
      ['post', 'Published', 'published'],
      ['post', 'Scheduled', 'scheduled'],
    ]);
  });

  it('leaves out plain drafts, trashed posts and posts outside the grid', async () => {
    await testDb()
      .insert(posts)
      .values([
        { title: 'Plain draft', slug: 'a', status: 'draft' },
        {
          title: 'Trashed',
          slug: 'b',
          status: 'draft',
          scheduledAt: at(10, 20),
          deletedAt: new Date(),
        },
        {
          title: 'Last year',
          slug: 'c',
          status: 'published',
          publishedAt: new Date(Date.UTC(2025, 10, 3)),
        },
        { title: 'Next spring', slug: 'd', status: 'draft', scheduledAt: at(2, 20) },
      ]);
    expect(await entries()).toEqual([]);
  });

  it('shows the days of the neighbouring months that the grid shows', async () => {
    await testDb()
      .insert(posts)
      .values([
        { title: 'Late October', slug: 'a', status: 'draft', scheduledAt: at(9, 28) },
        { title: 'Early December', slug: 'b', status: 'draft', scheduledAt: at(11, 5) },
        { title: 'Past the grid', slug: 'c', status: 'draft', scheduledAt: at(11, 20) },
      ]);
    expect((await entries()).map((e) => e[1])).toEqual(['Early December', 'Late October']);
  });

  it('shows an event on its start day, including a cancelled one, and a draft when it goes live', async () => {
    await testDb()
      .insert(events)
      .values([
        event({ title: 'Published', slug: 'a', status: 'published' }),
        event({ title: 'Cancelled', slug: 'b', status: 'cancelled' }),
        // Starts next year, but its page goes live this month.
        event({
          title: 'Draft',
          slug: 'c',
          status: 'draft',
          startsAt: at(2, 14),
          endsAt: at(2, 15),
          publishAt: at(10, 9),
        }),
      ]);
    expect(await entries()).toEqual([
      ['event', 'Cancelled', 'cancelled'],
      ['event-live', 'Draft', 'scheduled'],
      ['event', 'Published', 'published'],
    ]);
  });

  it('shows a draft event twice when both its date and its go-live date are in the month', async () => {
    await testDb()
      .insert(events)
      .values(event({ status: 'draft', publishAt: at(10, 2) }));
    expect((await entries()).map((e) => e[0]).sort()).toEqual(['event', 'event-live']);
  });

  it('leaves events out for people who do not manage them', async () => {
    await testDb()
      .insert(events)
      .values(event({ status: 'published' }));
    await testDb()
      .insert(posts)
      .values({ title: 'A post', slug: 'p', status: 'draft', scheduledAt: at(10, 20) });
    expect(await entries(false)).toEqual([['post', 'A post', 'scheduled']]);
  });

  it('keeps an event’s own time zone for the page to place it by', async () => {
    await testDb()
      .insert(events)
      .values(event({ status: 'published', timeZone: 'Australia/Perth' }));
    const [entry] = await loadCalendar(testDb(), NOVEMBER, { includeEvents: true });
    expect(entry?.timeZone).toBe('Australia/Perth');
  });
});
