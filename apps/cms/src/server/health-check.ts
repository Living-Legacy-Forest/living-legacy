import { createDb } from '@ll/db';
import { cronRuns } from '@ll/db/schema';
import { inArray, max } from 'drizzle-orm';
import { cronJobs, cronSchedules } from '@/lib/cron-jobs';
import { judgeWebsite, probeWebsite } from './system-health';

const FIVE_MINUTE_JOBS = cronJobs.filter((j) => j.schedule === 'every-5-minutes').map((j) => j.key);

/**
 * The public health check behind /api/health, for an uptime monitor (Better
 * Stack): one check covers the CMS answering at all, the website loading, and
 * the 5-minute jobs still running, a second line of defence beside their
 * heartbeat. It says which of the two failed and nothing more.
 */
export async function checkHealth(d1: D1Database, fetcher: typeof fetch, now: number) {
  const [website, [jobs]] = await Promise.all([
    probeWebsite(fetcher),
    createDb(d1)
      .select({ lastRun: max(cronRuns.startedAt) })
      .from(cronRuns)
      .where(inArray(cronRuns.job, FIVE_MINUTE_JOBS)),
  ]);
  const lastRun = jobs?.lastRun?.getTime() ?? null;

  const problems: string[] = [];
  // Why, for the logs. The public answer names only what failed.
  const details: string[] = [];
  const verdict = judgeWebsite(website);
  if (verdict.status === 'problem') {
    problems.push('website');
    details.push(verdict.detail);
  }
  if (lastRun === null || now - lastRun > cronSchedules['every-5-minutes'].staleAfterMs) {
    problems.push('scheduled jobs');
    details.push(
      lastRun === null
        ? 'No 5-minute job has run.'
        : `The last 5-minute job ran ${Math.round((now - lastRun) / 60_000)} minutes ago.`
    );
  }
  return { ok: problems.length === 0, problems, details };
}

type Health = Awaited<ReturnType<typeof checkHealth>>;

// The answer is kept briefly per Worker, so calling the address in a loop
// cannot turn into a flood of requests to the website.
const REUSE_MS = 30_000;
let last: { at: number; response: Health } | null = null;

/** GET or HEAD /api/health: 200 "ok", or 503 naming what failed. Never cached by browsers. */
export async function healthResponse(request: Request, d1: D1Database): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const now = Date.now();
  if (!last || now - last.at > REUSE_MS) {
    last = { at: now, response: await checkHealth(d1, fetch, now) };
    // Once per check, not per call, so a monitor calling often does not repeat it.
    if (!last.response.ok) {
      console.warn(
        `[health] failing: ${last.response.problems.join(', ')}. ${last.response.details.join(' ')}`
      );
    }
  }
  const { ok, problems } = last.response;
  return new Response(
    request.method === 'HEAD' ? null : ok ? 'ok' : `failing: ${problems.join(', ')}`,
    {
      status: ok ? 200 : 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    }
  );
}
