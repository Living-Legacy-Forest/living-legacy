import { type CronJobKey, type CronSchedule, cronSchedules } from '@/lib/cron-jobs';
import type { Monitor } from './cron-monitor';

type Jobs = Partial<Record<CronJobKey, () => Promise<unknown>>>;

/**
 * The Sentry monitor for a schedule, or null for none. The first check-in
 * creates it; Sentry alerts when a run fails, runs past maxRuntime, or has not
 * started checkinMargin minutes after it was due. Times are UTC, as wrangler's are.
 *
 * Only the 5-minute schedule has one: Sentry includes a single cron monitor and
 * charges for more, and a monitor past the allowance is created disabled. The
 * daily jobs still report every error to Sentry, and the System page flags
 * them once they go 25 hours without a run.
 */
export function monitorFor(schedule: CronSchedule): Monitor | null {
  if (schedule === 'daily') return null;
  return {
    slug: cronSchedules[schedule].monitorSlug,
    config: {
      schedule: { type: 'crontab', value: cronSchedules[schedule].cron },
      timezone: 'UTC',
      // 10 minutes past a missed run is 15 without one (staleAfterMs).
      checkinMargin: 10,
      maxRuntime: 5,
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
