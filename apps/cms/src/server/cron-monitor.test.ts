import { describe, expect, it } from 'vitest';
import { type ErrorReporter, runMonitored } from './cron-monitor';

const HEARTBEAT = 'https://heartbeat.example.test/abc123';

function fakes() {
  const errors: { error: unknown; job: string }[] = [];
  const pings: string[] = [];
  const reporter: ErrorReporter = {
    captureException(error, { tags }) {
      errors.push({ error, job: tags.job });
    },
  };
  const fetcher = (async (url: string | URL | Request) => {
    pings.push(String(url));
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  return { reporter, fetcher, errors, pings };
}

describe('runMonitored', () => {
  it('runs every job and pings the heartbeat when all succeed', async () => {
    const { reporter, fetcher, errors, pings } = fakes();
    const ran: string[] = [];

    const runs = await runMonitored(
      {
        'publish-posts': async () => void ran.push('publish-posts'),
        'sync-bookings': async () => void ran.push('sync-bookings'),
      },
      reporter,
      { url: HEARTBEAT, fetcher }
    );

    expect(ran.sort()).toEqual(['publish-posts', 'sync-bookings']);
    expect(errors).toEqual([]);
    expect(pings).toEqual([HEARTBEAT]);
    expect(runs.every((r) => r.error === null)).toBe(true);
  });

  it('runs the other jobs when one fails, reports it by name and pings /fail', async () => {
    const { reporter, fetcher, errors, pings } = fakes();
    const boom = new Error('HubSpot said no');
    const ran: string[] = [];

    await runMonitored(
      {
        'publish-posts': async () => void ran.push('publish-posts'),
        'sync-bookings': async () => {
          throw boom;
        },
        'publish-events': async () => void ran.push('publish-events'),
      },
      reporter,
      { url: HEARTBEAT, fetcher }
    );

    expect(ran.sort()).toEqual(['publish-events', 'publish-posts']);
    expect(errors).toEqual([{ error: boom, job: 'sync-bookings' }]);
    expect(pings).toEqual([`${HEARTBEAT}/fail`]);
  });

  it('reports a job that throws before returning a promise', async () => {
    const { reporter, fetcher, errors, pings } = fakes();
    const boom = new Error('thrown synchronously');

    await runMonitored(
      {
        broken: () => {
          throw boom;
        },
      },
      reporter,
      { url: HEARTBEAT, fetcher }
    );

    expect(errors).toEqual([{ error: boom, job: 'broken' }]);
    expect(pings).toEqual([`${HEARTBEAT}/fail`]);
  });

  it('returns each job’s run, with the error message cut short', async () => {
    const { reporter } = fakes();
    const before = Date.now();

    const runs = await runMonitored(
      {
        fine: async () => {},
        broken: async () => {
          throw new Error('x'.repeat(600));
        },
      },
      reporter
    );

    const fine = runs.find((r) => r.job === 'fine');
    const broken = runs.find((r) => r.job === 'broken');
    expect(fine).toMatchObject({ error: null, durationMs: expect.any(Number) });
    expect(fine?.startedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(broken?.error).toHaveLength(500);
  });

  it('without a heartbeat address, runs and reports but pings nothing', async () => {
    const { reporter, fetcher, errors, pings } = fakes();
    const boom = new Error('x');

    await runMonitored({ broken: () => Promise.reject(boom) }, reporter, {
      url: undefined,
      fetcher,
    });

    expect(pings).toEqual([]);
    expect(errors).toEqual([{ error: boom, job: 'broken' }]);
  });

  it('reports a heartbeat that cannot be reached, without failing the run', async () => {
    const { reporter, errors } = fakes();
    const down = new Error('network down');
    const fetcher = (async () => {
      throw down;
    }) as typeof fetch;

    const runs = await runMonitored({ fine: async () => {} }, reporter, {
      url: HEARTBEAT,
      fetcher,
    });

    expect(runs).toHaveLength(1);
    expect(errors).toEqual([{ error: down, job: 'heartbeat' }]);
  });

  it('never rejects, so a failed job cannot also become an unrelated error', async () => {
    const { reporter } = fakes();
    await expect(
      runMonitored({ a: () => Promise.reject(new Error('x')) }, reporter)
    ).resolves.toHaveLength(1);
  });

  it('pings each job’s own heartbeat, or its /fail, beside the schedule’s', async () => {
    const { reporter, fetcher, pings } = fakes();
    await runMonitored(
      {
        'publish-posts': async () => {},
        'sync-bookings': async () => {
          throw new Error('HubSpot 500');
        },
        'publish-events': async () => {},
      },
      reporter,
      {
        url: HEARTBEAT,
        jobs: {
          'publish-posts': 'https://heartbeat.example.test/posts',
          'sync-bookings': 'https://heartbeat.example.test/sync',
        },
        fetcher,
      }
    );
    expect(pings.sort()).toEqual(
      [
        `${HEARTBEAT}/fail`,
        'https://heartbeat.example.test/posts',
        'https://heartbeat.example.test/sync/fail',
      ].sort()
    );
  });
});
