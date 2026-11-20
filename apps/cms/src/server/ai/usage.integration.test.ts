// The daily limit on writing suggestions, against local D1.
import { aiUsage, siteSettings } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testDb } from '../../../test/fixtures';
import { DAILY_SUGGESTION_LIMIT, reserveSuggestion, usageDay } from './usage';

const at = (iso: string) => new Date(iso);
const count = async (userId: string, day: string) =>
  (await testDb().select().from(aiUsage).where(eq(aiUsage.userId, userId))).find(
    (row) => row.day === day
  )?.count;

beforeEach(async () => {
  await testDb().delete(aiUsage);
  await testDb().delete(siteSettings);
});

describe('usageDay', () => {
  it('is the calendar day in the given time zone', () => {
    // 13:30 UTC is 00:30 the next morning in Melbourne (daylight saving).
    const now = at('2026-11-20T13:30:00Z');
    expect(usageDay(now, 'Australia/Melbourne')).toBe('2026-11-21');
    expect(usageDay(now, 'UTC')).toBe('2026-11-20');
  });
});

describe('reserveSuggestion', () => {
  it('allows the limit and then says the day is used up', async () => {
    const user = await addUser();
    const opts = { limit: 3, timeZone: 'UTC', now: at('2026-11-20T01:00:00Z') };
    for (let i = 0; i < 3; i += 1) await reserveSuggestion(testDb(), user, opts);
    await expect(reserveSuggestion(testDb(), user, opts)).rejects.toThrow(
      "You've used today's 3 suggestions. They start again at midnight."
    );
    expect(await count(user, '2026-11-20')).toBe(3);
  });

  it('counts each person on their own', async () => {
    const a = await addUser();
    const b = await addUser();
    const opts = { limit: 1, timeZone: 'UTC', now: at('2026-11-20T01:00:00Z') };
    await reserveSuggestion(testDb(), a, opts);
    await expect(reserveSuggestion(testDb(), a, opts)).rejects.toThrow('used today');
    await expect(reserveSuggestion(testDb(), b, opts)).resolves.toBeUndefined();
  });

  it('starts again on the next day', async () => {
    const user = await addUser();
    await reserveSuggestion(testDb(), user, {
      limit: 1,
      timeZone: 'UTC',
      now: at('2026-11-20T23:59:00Z'),
    });
    await expect(
      reserveSuggestion(testDb(), user, {
        limit: 1,
        timeZone: 'UTC',
        now: at('2026-11-21T00:01:00Z'),
      })
    ).resolves.toBeUndefined();
  });

  it("uses the site's time zone from Settings for midnight", async () => {
    const user = await addUser();
    await testDb()
      .insert(siteSettings)
      .values({ id: 'site', data: { timeZone: 'Australia/Perth' } });
    // 17:00 UTC is 01:00 the next day in Perth (UTC+8).
    await reserveSuggestion(testDb(), user, { now: at('2026-11-20T17:00:00Z') });
    expect(await count(user, '2026-11-21')).toBe(1);
  });

  it('holds the limit when many are asked for at once', async () => {
    const user = await addUser();
    const opts = { limit: 3, timeZone: 'UTC', now: at('2026-11-20T01:00:00Z') };
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => reserveSuggestion(testDb(), user, opts))
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    expect(await count(user, '2026-11-20')).toBe(3);
  });

  it('tidies away days older than a week as it goes', async () => {
    const user = await addUser();
    await testDb()
      .insert(aiUsage)
      .values([
        { userId: user, day: '2026-11-01', count: 5 },
        { userId: user, day: '2026-11-17', count: 5 },
      ]);
    await reserveSuggestion(testDb(), user, { timeZone: 'UTC', now: at('2026-11-20T01:00:00Z') });
    expect(await count(user, '2026-11-01')).toBeUndefined();
    expect(await count(user, '2026-11-17')).toBe(5);
  });

  it('is 100 a day unless told otherwise', () => {
    expect(DAILY_SUGGESTION_LIMIT).toBe(100);
  });
});
