import { analyticsCache } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { days, minutes, testDb } from '../../test/fixtures';
import { pruneAnalyticsCache, readThrough, refresh } from './analytics-cache';

const T0 = 1_800_000_000_000;

beforeEach(async () => {
  await testDb().delete(analyticsCache);
});

describe('readThrough', () => {
  it('asks PostHog once, then answers from storage', async () => {
    const fetcher = vi.fn().mockResolvedValue({ n: 1 });
    expect(await readThrough(env.DB, 'k', fetcher, T0)).toEqual({ n: 1 });
    expect(await readThrough(env.DB, 'k', fetcher, T0 + minutes(14))).toEqual({ n: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps showing a stored answer up to an hour old, for the job to renew', async () => {
    const fetcher = vi.fn().mockResolvedValue({ n: 2 });
    await readThrough(env.DB, 'k', vi.fn().mockResolvedValue({ n: 1 }), T0);
    expect(await readThrough(env.DB, 'k', fetcher, T0 + minutes(40))).toEqual({ n: 1 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('asks again once the job has plainly stopped', async () => {
    await readThrough(env.DB, 'k', vi.fn().mockResolvedValue({ n: 1 }), T0);
    const fetcher = vi.fn().mockResolvedValue({ n: 2 });
    expect(await readThrough(env.DB, 'k', fetcher, T0 + minutes(61))).toEqual({ n: 2 });
  });

  it('falls back to an old answer when PostHog fails, and throws when there is none', async () => {
    await readThrough(env.DB, 'k', vi.fn().mockResolvedValue({ n: 1 }), T0);
    const failing = vi.fn().mockRejectedValue(new Error('down'));
    expect(await readThrough(env.DB, 'k', failing, T0 + minutes(90))).toEqual({ n: 1 });
    await expect(readThrough(env.DB, 'other', failing, T0)).rejects.toThrow('down');
  });
});

describe('refresh', () => {
  it('skips an answer that is still young and renews an older one', async () => {
    await readThrough(env.DB, 'k', vi.fn().mockResolvedValue({ n: 1 }), T0);
    const fetcher = vi.fn().mockResolvedValue({ n: 2 });
    expect(await refresh(env.DB, 'k', fetcher, T0 + minutes(10))).toBe(false);
    expect(await refresh(env.DB, 'k', fetcher, T0 + minutes(12))).toBe(true);
    expect(await readThrough(env.DB, 'k', vi.fn(), T0 + minutes(13))).toEqual({ n: 2 });
  });

  it('stores an answer nobody has asked for yet', async () => {
    expect(await refresh(env.DB, 'new', vi.fn().mockResolvedValue([1]), T0)).toBe(true);
    expect(await readThrough(env.DB, 'new', vi.fn(), T0)).toEqual([1]);
  });
});

describe('pruneAnalyticsCache', () => {
  it('clears answers unrenewed for two days and keeps the rest', async () => {
    await refresh(env.DB, 'old', vi.fn().mockResolvedValue(1), T0);
    await refresh(env.DB, 'recent', vi.fn().mockResolvedValue(2), T0 + days(1));
    await pruneAnalyticsCache(env.DB, T0 + days(2) + minutes(1));
    const keys = (await testDb().select().from(analyticsCache)).map((r) => r.key);
    expect(keys).toEqual(['recent']);
  });
});
