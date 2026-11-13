// The jobs the Worker's cron triggers run (src/server.ts), for the cron runner
// and the System page. Plain data, so the page can use it without loading the
// jobs themselves.

const MINUTE_MS = 60_000;

export const cronSchedules = {
  'every-5-minutes': {
    title: 'Every 5 minutes',
    /** Must match the first trigger in wrangler.jsonc. */
    cron: '*/5 * * * *',
    /**
     * No run for this long and the job counts as stopped, here and in the
     * health check; set the Better Stack heartbeat's grace to match.
     */
    staleAfterMs: 15 * MINUTE_MS,
  },
  daily: {
    // 17:00 UTC: 3am in Melbourne, 4am in daylight saving.
    title: 'Daily, early morning',
    /** Must match the second trigger in wrangler.jsonc. */
    cron: '0 17 * * *',
    staleAfterMs: 25 * 60 * MINUTE_MS,
  },
} as const;

export type CronSchedule = keyof typeof cronSchedules;

export const cronJobs = [
  { key: 'publish-posts', schedule: 'every-5-minutes', title: 'Publish scheduled posts' },
  { key: 'publish-events', schedule: 'every-5-minutes', title: 'Publish scheduled events' },
  { key: 'sync-bookings', schedule: 'every-5-minutes', title: 'Send bookings to HubSpot' },
  { key: 'refresh-analytics', schedule: 'every-5-minutes', title: 'Refresh website traffic' },
  { key: 'sweep-media', schedule: 'daily', title: 'Delete unused files' },
  { key: 'purge-old-bookings', schedule: 'daily', title: 'Delete bookings a year after the event' },
  { key: 'prune-missing-pages', schedule: 'daily', title: 'Forget old missing pages' },
  { key: 'rescore-posts', schedule: 'daily', title: 'Rescore posts' },
  { key: 'prune-job-history', schedule: 'daily', title: 'Clear old job history' },
  { key: 'prune-analytics', schedule: 'daily', title: 'Clear old traffic answers' },
] as const satisfies readonly { key: string; schedule: CronSchedule; title: string }[];

export type CronJobKey = (typeof cronJobs)[number]['key'];

/**
 * How a job is doing from its last run. Stopped beats failed: a job that
 * failed and has not run since is the more pressing problem. A job that has
 * never run is waiting, not stopped, so a fresh deploy raises nothing.
 */
export type JobHealth = 'ok' | 'failed' | 'stale' | 'waiting';

export function jobHealth(
  lastRun: { startedAt: number; error: string | null } | null,
  schedule: CronSchedule,
  now: number
): JobHealth {
  if (!lastRun) return 'waiting';
  if (now - lastRun.startedAt > cronSchedules[schedule].staleAfterMs) return 'stale';
  return lastRun.error === null ? 'ok' : 'failed';
}
