import { createDb } from '@ll/db';
import { cronRuns } from '@ll/db/schema';
import { and, desc, gte, isNotNull, lt, sql } from 'drizzle-orm';
import { cronJobs, cronSchedules, jobHealth } from '@/lib/cron-jobs';
import type { JobRun } from './cron-monitor';

const DAY_MS = 86_400_000;
/** Runs older than this are cleared by the daily job. */
const KEEP_DAYS = 14;
/** The failures list stops here; a job failing this often is one issue, not fifty. */
const FAILURES_SHOWN = 50;

/** Keeps one cron run's results, one row per job, in one write. */
export async function recordCronRuns(d1: D1Database, runs: JobRun[]) {
  if (runs.length === 0) return;
  await createDb(d1).insert(cronRuns).values(runs);
}

/** Daily: clears job history older than two weeks. */
export async function pruneCronRuns(d1: D1Database, now: Date) {
  await createDb(d1)
    .delete(cronRuns)
    .where(lt(cronRuns.startedAt, new Date(now.getTime() - KEEP_DAYS * DAY_MS)));
}

/** Every job's latest run and health, grouped by schedule, plus recent failures. */
export async function loadJobHealth(db: ReturnType<typeof createDb>, now: number) {
  const [latest, failed] = await db.batch([
    db
      .select()
      .from(cronRuns)
      .where(
        sql`(${cronRuns.job}, ${cronRuns.startedAt}) in (select job, max(started_at) from cron_runs group by job)`
      ),
    db
      .select()
      .from(cronRuns)
      .where(
        and(isNotNull(cronRuns.error), gte(cronRuns.startedAt, new Date(now - KEEP_DAYS * DAY_MS)))
      )
      .orderBy(desc(cronRuns.startedAt))
      .limit(FAILURES_SHOWN),
  ]);

  const lastRuns = new Map(
    latest.map((r) => [
      r.job,
      { startedAt: r.startedAt.getTime(), durationMs: r.durationMs, error: r.error },
    ])
  );
  const titles = new Map<string, string>(cronJobs.map((job) => [job.key, job.title]));

  const schedules = (Object.keys(cronSchedules) as (keyof typeof cronSchedules)[]).map((key) => ({
    key,
    title: cronSchedules[key].title,
    jobs: cronJobs
      .filter((job) => job.schedule === key)
      .map((job) => {
        const lastRun = lastRuns.get(job.key) ?? null;
        return {
          key: job.key,
          title: job.title,
          health: jobHealth(lastRun, key, now),
          lastRun,
        };
      }),
  }));

  return {
    schedules,
    needsLook: schedules
      .flatMap((s) => s.jobs)
      .filter((j) => j.health === 'failed' || j.health === 'stale').length,
    failures: failed.map((r) => ({
      id: r.id,
      // A job since renamed or removed still shows, under its key.
      title: titles.get(r.job) ?? r.job,
      startedAt: r.startedAt.getTime(),
      error: r.error ?? '',
    })),
  };
}
