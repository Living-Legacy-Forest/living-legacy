import { cronRuns } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { days, minutes, testDb } from '../../test/fixtures';
import { loadJobHealth, pruneCronRuns, recordCronRuns } from './system-store';

const now = new Date('2027-01-20T09:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);
const run = (job: string, startedAt: Date, error: string | null = null) => ({
  job,
  startedAt,
  durationMs: 120,
  error,
});

beforeEach(async () => {
  await testDb().delete(cronRuns);
});

const jobIn = (health: Awaited<ReturnType<typeof loadJobHealth>>, key: string) =>
  health.schedules.flatMap((s) => s.jobs).find((j) => j.key === key)!;

describe('recordCronRuns', () => {
  it('keeps one row per job', async () => {
    await recordCronRuns(env.DB, [run('publish-posts', ago(0)), run('sync-bookings', ago(0), 'x')]);
    const rows = await testDb().select().from(cronRuns);
    expect(rows.map((r) => [r.job, r.error]).sort()).toEqual([
      ['publish-posts', null],
      ['sync-bookings', 'x'],
    ]);
  });
});

describe('loadJobHealth', () => {
  it('judges each job by its latest run and counts the ones that need a look', async () => {
    await recordCronRuns(env.DB, [
      // Failed once, fine since.
      run('publish-posts', ago(minutes(10)), 'old problem'),
      run('publish-posts', ago(minutes(2))),
      // Fine once, failing now.
      run('sync-bookings', ago(minutes(10))),
      run('sync-bookings', ago(minutes(2)), 'HubSpot 500'),
      // Has stopped.
      run('rescore-posts', ago(days(2))),
    ]);

    const health = await loadJobHealth(testDb(), now.getTime());

    expect(jobIn(health, 'publish-posts')).toMatchObject({
      health: 'ok',
      lastRun: { startedAt: ago(minutes(2)).getTime(), durationMs: 120, error: null },
    });
    expect(jobIn(health, 'sync-bookings')).toMatchObject({
      health: 'failed',
      lastRun: { error: 'HubSpot 500' },
    });
    expect(jobIn(health, 'rescore-posts').health).toBe('stale');
    expect(jobIn(health, 'sweep-media')).toMatchObject({ health: 'waiting', lastRun: null });
    expect(health.needsLook).toBe(2);
    expect(health.schedules.map((s) => s.key)).toEqual(['every-5-minutes', 'daily']);
  });

  it('lists failures from the last 14 days, newest first, with the job’s name', async () => {
    await recordCronRuns(env.DB, [
      run('sync-bookings', ago(days(15)), 'too old'),
      run('sync-bookings', ago(days(3)), 'older'),
      run('publish-posts', ago(minutes(5)), 'newest'),
      run('publish-posts', ago(minutes(1))),
    ]);

    const { failures } = await loadJobHealth(testDb(), now.getTime());

    expect(failures.map((f) => [f.title, f.error])).toEqual([
      ['Publish scheduled posts', 'newest'],
      ['Send bookings to HubSpot', 'older'],
    ]);
  });
});

describe('pruneCronRuns', () => {
  it('clears runs older than 14 days', async () => {
    await recordCronRuns(env.DB, [
      run('publish-posts', ago(days(15))),
      run('publish-posts', ago(days(13))),
    ]);

    await pruneCronRuns(env.DB, now);

    const rows = await testDb().select().from(cronRuns);
    expect(rows.map((r) => r.startedAt.getTime())).toEqual([ago(days(13)).getTime()]);
  });
});
