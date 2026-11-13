import { createDb } from '@ll/db';
import {
  activityLog,
  cronRuns,
  eventBookings,
  events,
  media,
  notFoundPaths,
  posts,
  redirects,
  revisions,
} from '@ll/db/schema';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { and, avg, count, desc, gte, isNotNull, lt, max, sql, sum } from 'drizzle-orm';
import { cronJobs, cronSchedules, jobHealth } from '@/lib/cron-jobs';
import type { JobRun } from './cron-monitor';

const DAY_MS = 86_400_000;
/** Runs older than this are cleared by the daily job. */
export const KEEP_DAYS = 14;
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

const HOUR_MS = 3_600_000;

/** Every job's latest run and health, grouped by schedule, plus recent failures and history. */
export async function loadJobHealth(db: ReturnType<typeof createDb>, now: number) {
  const since = new Date(now - KEEP_DAYS * DAY_MS);
  const failedRun = sql<number>`sum(case when ${cronRuns.error} is null then 0 else 1 end)`;
  // Inlined, not bound, so the select and the group by are the same expression.
  const hour = sql<number>`${cronRuns.startedAt} / ${sql.raw(String(HOUR_MS))}`;
  const [latest, failed, perJob, perHour] = await db.batch([
    db
      .select()
      .from(cronRuns)
      .where(
        sql`(${cronRuns.job}, ${cronRuns.startedAt}) in (select job, max(started_at) from cron_runs group by job)`
      ),
    db
      .select()
      .from(cronRuns)
      .where(and(isNotNull(cronRuns.error), gte(cronRuns.startedAt, since)))
      .orderBy(desc(cronRuns.startedAt))
      .limit(FAILURES_SHOWN),
    db
      .select({
        job: cronRuns.job,
        runs: count(),
        failed: failedRun,
        averageMs: avg(cronRuns.durationMs),
        slowestMs: max(cronRuns.durationMs),
      })
      .from(cronRuns)
      .where(gte(cronRuns.startedAt, since))
      .groupBy(cronRuns.job),
    // By the hour, not the day, so the page can draw days in the viewer's time zone.
    db
      .select({
        hour,
        runs: count(),
        failed: failedRun,
        totalMs: sum(cronRuns.durationMs),
        slowestMs: max(cronRuns.durationMs),
      })
      .from(cronRuns)
      .where(gte(cronRuns.startedAt, since))
      .groupBy(hour)
      .orderBy(hour),
  ]);

  const lastRuns = new Map(
    latest.map((r) => [
      r.job,
      { startedAt: r.startedAt.getTime(), durationMs: r.durationMs, error: r.error },
    ])
  );
  const stats = new Map(
    perJob.map((r) => [
      r.job,
      {
        runs: r.runs,
        failed: Number(r.failed ?? 0),
        averageMs: Math.round(Number(r.averageMs ?? 0)),
        slowestMs: r.slowestMs ?? 0,
      },
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
          stats: stats.get(job.key) ?? null,
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
    history: perHour.map((r) => ({
      hourStart: Number(r.hour) * HOUR_MS,
      runs: r.runs,
      failed: Number(r.failed ?? 0),
      totalMs: Number(r.totalMs ?? 0),
      slowestMs: r.slowestMs ?? 0,
    })),
  };
}

export const fileKind = sql<FileKind>`case
  when ${media.mime} like 'image/%' then 'image'
  when ${media.mime} like 'video/%' then 'video'
  when ${media.mime} = 'application/pdf' then 'pdf'
  else 'other' end`;
export type FileKind = 'image' | 'video' | 'pdf' | 'other';

/** What the database holds: rows in the tables people grow, and the media library by kind. */
export async function loadUsage(db: ReturnType<typeof createDb>) {
  const tally = (table: SQLiteTable) => db.select({ n: count() }).from(table);
  const [files, ...tallies] = await db.batch([
    db
      .select({ kind: fileKind, files: count(), bytes: sum(media.size) })
      .from(media)
      .groupBy(fileKind),
    tally(posts),
    tally(events),
    tally(eventBookings),
    tally(media),
    tally(revisions),
    tally(activityLog),
    tally(redirects),
    tally(notFoundPaths),
    tally(cronRuns),
  ]);
  const labels = [
    'Posts',
    'Events',
    'Bookings',
    'Files',
    'Saved versions',
    'Activity log',
    'Redirects',
    'Missing pages',
    'Job history',
  ];
  return {
    files: files.map((r) => ({ kind: r.kind, files: r.files, bytes: Number(r.bytes ?? 0) })),
    records: labels.map((label, i) => ({ label, rows: tallies[i]?.[0]?.n ?? 0 })),
  };
}
