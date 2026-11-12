import { type CronJobKey, type CronSchedule, cronJobs } from '@/lib/cron-jobs';

type Jobs = Partial<Record<CronJobKey, () => Promise<unknown>>>;

/**
 * The Better Stack heartbeat a schedule pings after each run (Worker secrets,
 * so the addresses stay private). Better Stack raises an incident when pings
 * stop or say /fail; Sentry keeps the errors themselves.
 */
export function heartbeatFor(schedule: CronSchedule, env: Cloudflare.Env) {
  return schedule === 'daily' ? env.HEARTBEAT_URL_DAILY : env.HEARTBEAT_URL_EVERY_5_MINUTES;
}

/**
 * The jobs with a heartbeat of their own, from HEARTBEAT_URLS_BY_JOB: a JSON
 * object of job key to Better Stack heartbeat address (a Worker secret). An
 * unset, unreadable or partly wrong value pings only what it can.
 */
export function jobHeartbeats(env: Cloudflare.Env): Partial<Record<CronJobKey, string>> {
  try {
    const parsed: unknown = JSON.parse(env.HEARTBEAT_URLS_BY_JOB ?? '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([key, url]) =>
          cronJobs.some((j) => j.key === key) &&
          typeof url === 'string' &&
          url.startsWith('https://')
      )
    ) as Partial<Record<CronJobKey, string>>;
  } catch {
    return {};
  }
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
