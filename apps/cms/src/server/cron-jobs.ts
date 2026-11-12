import { type CronJobKey, type CronSchedule, cronSchedules } from '@/lib/cron-jobs';
import type { Monitor } from './cron-monitor';

type Jobs = Partial<Record<CronJobKey, () => Promise<unknown>>>;

/**
 * The Sentry monitor for a schedule. The first check-in creates it; Sentry
 * emails when a run fails, runs past maxRuntime, or has not started
 * checkinMargin minutes after it was due. Times are UTC, as wrangler's are.
 */
export function monitorFor(schedule: CronSchedule): Monitor {
  const { monitorSlug, cron } = cronSchedules[schedule];
  const daily = schedule === 'daily';
  return {
    slug: monitorSlug,
    config: {
      schedule: { type: 'crontab', value: cron },
      timezone: 'UTC',
      // 10 minutes past a missed 5-minute run is 15 without one (staleAfterMs).
      checkinMargin: daily ? 60 : 10,
      maxRuntime: daily ? 15 : 5,
    },
  };
}

/**
 * A schedule's jobs, each loaded only when its schedule runs: most starts are
 * the five-minute cron, which needs only its own. A job that copes with a
 * problem and carries on (a post that cannot publish, a sweep that stops
 * itself) still throws here, so the problem is reported.
 */
export async function jobsFor(
  schedule: CronSchedule,
  env: Cloudflare.Env,
  now: Date
): Promise<Jobs> {
  if (schedule === 'daily') {
    const [
      { sweepOrphanedMedia },
      { purgeOldBookings },
      { pruneMissingPages },
      { rescorePosts },
      { pruneCronRuns },
    ] = await Promise.all([
      import('./media-sweep'),
      import('./event-jobs'),
      import('./not-found'),
      import('./post-score'),
      import('./system-store'),
    ]);
    return {
      'sweep-media': async () => {
        const { refused } = await sweepOrphanedMedia(env.DB, env.MEDIA, now);
        if (refused) {
          throw new Error('Stopped without deleting: most stored files looked unused.');
        }
      },
      'purge-old-bookings': () => purgeOldBookings(env.DB, now),
      'prune-missing-pages': () => pruneMissingPages(env.DB, now),
      'rescore-posts': () => rescorePosts(env.DB),
      'prune-job-history': () => pruneCronRuns(env.DB, now),
    };
  }

  const [{ publishDuePosts }, { syncPending }, { publishDueEvents }] = await Promise.all([
    import('./scheduler'),
    import('./event-crm'),
    import('./event-jobs'),
  ]);
  return {
    'publish-posts': async () => {
      const { failed } = await publishDuePosts(env.DB, now);
      if (failed > 0) {
        throw new Error(
          `${failed} scheduled ${failed === 1 ? 'post' : 'posts'} could not be published.`
        );
      }
    },
    'publish-events': () => publishDueEvents(env.DB, now),
    'sync-bookings': () => syncPending(env.DB),
  };
}
