import { describe, expect, it } from 'vitest';
import { type CronReporter, type Monitor, runMonitored } from './cron-monitor';

const monitor: Monitor = {
  slug: 'cms-every-5-minutes',
  config: { schedule: { type: 'crontab', value: '*/5 * * * *' }, checkinMargin: 10 },
};

function fakeReporter() {
  const checkIns: { checkIn: Record<string, unknown>; config?: unknown }[] = [];
  const errors: { error: unknown; job: string }[] = [];
  const reporter: CronReporter = {
    captureCheckIn(checkIn, config) {
      checkIns.push({ checkIn: { ...checkIn }, config });
      return 'check-in-1';
    },
    captureException(error, { tags }) {
      errors.push({ error, job: tags.job });
    },
  };
  return { reporter, checkIns, errors };
}

describe('runMonitored', () => {
  it('checks in as started, then ok, when every job succeeds', async () => {
    const { reporter, checkIns, errors } = fakeReporter();
    const ran: string[] = [];

    await runMonitored(
      monitor,
      {
        'publish-posts': async () => void ran.push('publish-posts'),
        'sync-bookings': async () => void ran.push('sync-bookings'),
      },
      reporter
    );

    expect(ran.sort()).toEqual(['publish-posts', 'sync-bookings']);
    expect(errors).toEqual([]);
    expect(checkIns).toHaveLength(2);
    expect(checkIns[0]).toEqual({
      checkIn: { monitorSlug: 'cms-every-5-minutes', status: 'in_progress' },
      config: monitor.config,
    });
    expect(checkIns[1]?.checkIn).toMatchObject({
      monitorSlug: 'cms-every-5-minutes',
      status: 'ok',
      checkInId: 'check-in-1',
      duration: expect.any(Number),
    });
  });

  it('runs the other jobs when one fails, reports it by name and checks in as an error', async () => {
    const { reporter, checkIns, errors } = fakeReporter();
    const boom = new Error('HubSpot said no');
    const ran: string[] = [];

    await runMonitored(
      monitor,
      {
        'publish-posts': async () => void ran.push('publish-posts'),
        'sync-bookings': async () => {
          throw boom;
        },
        'publish-events': async () => void ran.push('publish-events'),
      },
      reporter
    );

    expect(ran.sort()).toEqual(['publish-events', 'publish-posts']);
    expect(errors).toEqual([{ error: boom, job: 'sync-bookings' }]);
    expect(checkIns.at(-1)?.checkIn).toMatchObject({ status: 'error', checkInId: 'check-in-1' });
  });

  it('reports a job that throws before returning a promise', async () => {
    const { reporter, checkIns, errors } = fakeReporter();
    const boom = new Error('thrown synchronously');

    await runMonitored(
      monitor,
      {
        broken: () => {
          throw boom;
        },
      },
      reporter
    );

    expect(errors).toEqual([{ error: boom, job: 'broken' }]);
    expect(checkIns.at(-1)?.checkIn).toMatchObject({ status: 'error' });
  });

  it('returns each job’s run, with the error message cut short', async () => {
    const { reporter } = fakeReporter();
    const before = Date.now();

    const runs = await runMonitored(
      monitor,
      {
        fine: async () => {},
        broken: async () => {
          throw new Error('x'.repeat(600));
        },
      },
      reporter
    );

    expect(runs).toHaveLength(2);
    const fine = runs.find((r) => r.job === 'fine');
    const broken = runs.find((r) => r.job === 'broken');
    expect(fine).toMatchObject({ error: null, durationMs: expect.any(Number) });
    expect(fine?.startedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(broken?.error).toHaveLength(500);
    expect(broken?.error?.startsWith('Error: xxx')).toBe(true);
  });

  it('never rejects, so a failed job cannot also become an unrelated error', async () => {
    const { reporter } = fakeReporter();
    await expect(
      runMonitored(monitor, { a: () => Promise.reject(new Error('x')) }, reporter)
    ).resolves.toHaveLength(1);
  });
});
