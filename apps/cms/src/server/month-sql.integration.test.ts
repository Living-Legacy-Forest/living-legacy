import { posts } from '@ll/db/schema';
import { count } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from '../../test/fixtures';
import { monthOf } from './month-sql';

const hours = (n: number) => n * 3_600_000;

describe('monthOf', () => {
  beforeEach(async () => {
    await testDb().delete(posts);
  });

  async function monthsOf(offsetMs: number) {
    const month = monthOf(posts.createdAt, offsetMs);
    const rows = await testDb().select({ month, n: count() }).from(posts).groupBy(month);
    return Object.fromEntries(rows.map((r) => [r.month, r.n]));
  }

  it('groups rows by calendar month', async () => {
    await testDb()
      .insert(posts)
      .values([
        { title: 'A', slug: 'a', createdAt: new Date(Date.UTC(2026, 9, 5)) },
        { title: 'B', slug: 'b', createdAt: new Date(Date.UTC(2026, 9, 20)) },
        { title: 'C', slug: 'c', createdAt: new Date(Date.UTC(2026, 10, 2)) },
      ]);
    expect(await monthsOf(0)).toEqual({ '2026-10': 2, '2026-11': 1 });
  });

  it('puts late evening UTC on the next month in a zone ahead of it', async () => {
    await testDb()
      .insert(posts)
      .values({ title: 'A', slug: 'a', createdAt: new Date(Date.UTC(2026, 9, 31, 20)) });
    expect(await monthsOf(0)).toEqual({ '2026-10': 1 });
    expect(await monthsOf(hours(8))).toEqual({ '2026-11': 1 });
  });
});
