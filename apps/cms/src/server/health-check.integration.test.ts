import { cronRuns } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { minutes, testDb } from '../../test/fixtures';
import { checkHealth } from './health-check';

const now = Date.parse('2027-01-20T09:00:00Z');
const siteUp = async () => new Response('home', { status: 200 });
const siteDown = async () => new Response('oops', { status: 503 });

async function ran(job: string, minutesAgo: number) {
  await testDb()
    .insert(cronRuns)
    .values({ job, startedAt: new Date(now - minutes(minutesAgo)), durationMs: 50, error: null });
}

beforeEach(async () => {
  await testDb().delete(cronRuns);
});

describe('checkHealth', () => {
  it('is healthy when the website loads and the 5-minute jobs ran lately', async () => {
    await ran('publish-posts', 4);
    expect(await checkHealth(env.DB, siteUp, now)).toEqual({ ok: true, problems: [] });
  });

  it('names the website when it does not load', async () => {
    await ran('publish-posts', 4);
    expect(await checkHealth(env.DB, siteDown, now)).toEqual({
      ok: false,
      problems: ['website'],
    });
  });

  it('names the scheduled jobs once the 5-minute ones go 15 minutes without a run', async () => {
    await ran('publish-posts', 16);
    // A daily job running lately does not count for the 5-minute schedule.
    await ran('rescore-posts', 1);
    expect(await checkHealth(env.DB, siteUp, now)).toEqual({
      ok: false,
      problems: ['scheduled jobs'],
    });
  });

  it('names the scheduled jobs when none has ever run', async () => {
    expect((await checkHealth(env.DB, siteUp, now)).problems).toEqual(['scheduled jobs']);
  });
});
