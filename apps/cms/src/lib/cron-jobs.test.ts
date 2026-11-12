import { describe, expect, it } from 'vitest';
import { cronJobs, cronSchedules, jobHealth } from './cron-jobs';

const now = Date.parse('2027-01-20T09:00:00Z');
const minutes = (n: number) => n * 60_000;
const hours = (n: number) => n * 3_600_000;

describe('jobHealth', () => {
  it('is waiting when the job has never run, so a fresh deploy raises nothing', () => {
    expect(jobHealth(null, 'every-5-minutes', now)).toBe('waiting');
  });

  it('is ok after a recent run without an error', () => {
    expect(jobHealth({ startedAt: now - minutes(4), error: null }, 'every-5-minutes', now)).toBe(
      'ok'
    );
  });

  it('is failed when the last run had an error', () => {
    expect(
      jobHealth({ startedAt: now - minutes(4), error: 'HubSpot 500' }, 'every-5-minutes', now)
    ).toBe('failed');
  });

  it('is stale once a 5-minute job has gone 15 minutes without running', () => {
    expect(jobHealth({ startedAt: now - minutes(15), error: null }, 'every-5-minutes', now)).toBe(
      'ok'
    );
    expect(jobHealth({ startedAt: now - minutes(16), error: null }, 'every-5-minutes', now)).toBe(
      'stale'
    );
  });

  it('gives a daily job 25 hours', () => {
    expect(jobHealth({ startedAt: now - hours(24.5), error: null }, 'daily', now)).toBe('ok');
    expect(jobHealth({ startedAt: now - hours(26), error: null }, 'daily', now)).toBe('stale');
  });

  it('calls a job that failed and then stopped running stale, the more pressing of the two', () => {
    expect(jobHealth({ startedAt: now - hours(26), error: 'x' }, 'daily', now)).toBe('stale');
  });
});

describe('cronJobs', () => {
  it('gives every job a unique key and a known schedule', () => {
    const keys = cronJobs.map((job) => job.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const job of cronJobs) expect(Object.keys(cronSchedules)).toContain(job.schedule);
  });
});
