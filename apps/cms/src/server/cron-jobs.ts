import { type CronJobKey, type CronSchedule, cronJobs, cronSchedules } from '@/lib/cron-jobs';

type Jobs = Partial<Record<CronJobKey, () => Promise<unknown>>>;

/**
 * Every Better Stack heartbeat address, from the HEARTBEAT_URLS Worker secret
 * (private, so it is not in the code): a JSON object whose keys are schedules
 * ("every-5-minutes", "daily") or jobs ("sync-bookings"). Better Stack raises
 * an incident when pings stop or say /fail; Sentry keeps the errors. An unset,
 * unreadable or partly wrong value pings only what it can.
 */
function heartbeatUrls(env: Cloudflare.Env): Record<string, string> {
  const known = new Set<string>([...Object.keys(cronSchedules), ...cronJobs.map((j) => j.key)]);
  try {
    const parsed: unknown = JSON.parse(env.HEARTBEAT_URLS ?? '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          known.has(entry[0]) && typeof entry[1] === 'string' && entry[1].startsWith('https://')
      )
    );
  } catch {
    return {};
  }
}

/** How many heartbeat addresses are set up, for the Apps page. The addresses stay private. */
export function heartbeatCount(env: Cloudflare.Env): number {
  return Object.keys(heartbeatUrls(env)).length;
}

/** The heartbeat a schedule pings after each run, if it has one. */
export function heartbeatFor(schedule: CronSchedule, env: Cloudflare.Env): string | undefined {
  return heartbeatUrls(env)[schedule];
}

/** The jobs with a heartbeat of their own, so an alert names the job. */
export function jobHeartbeats(env: Cloudflare.Env): Partial<Record<CronJobKey, string>> {
  const urls = heartbeatUrls(env);
  return Object.fromEntries(
    cronJobs.filter((j) => urls[j.key]).map((j) => [j.key, urls[j.key]!])
  ) as Partial<Record<CronJobKey, string>>;
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
      { purgeTrashedMedia },
      { purgeTrashedContent },
      { purgeOldBookings },
      { pruneMissingPages },
      { rescorePosts },
      { pruneCronRuns },
      { pruneAnalyticsCache },
    ] = await Promise.all([
      import('./media-sweep'),
      import('./media-trash'),
      import('./content-trash'),
      import('./event-jobs'),
      import('./not-found'),
      import('./post-score'),
      import('./system-store'),
      import('./analytics-cache'),
    ]);
    return {
      'sweep-media': async () => {
        const { refused } = await sweepOrphanedMedia(env.DB, env.MEDIA, now);
        if (refused) {
          throw new Error('Stopped without deleting: most stored files looked unused.');
        }
      },
      'purge-media-trash': async () => {
        const { failed } = await purgeTrashedMedia(
          env.DB,
          now,
          new URL(env.BETTER_AUTH_URL).origin
        );
        // The rest went; these stay in the trash and are tried again tomorrow.
        if (failed) throw new Error(`${failed} files in the trash could not be deleted.`);
      },
      'purge-content-trash': () => purgeTrashedContent(env.DB, now),
      'purge-old-bookings': () => purgeOldBookings(env.DB, now),
      'prune-missing-pages': () => pruneMissingPages(env.DB, now),
      'rescore-posts': () => rescorePosts(env.DB),
      'prune-job-history': () => pruneCronRuns(env.DB, now),
      'prune-analytics': () => pruneAnalyticsCache(env.DB, now.getTime()),
    };
  }

  const [{ publishDuePosts }, { syncPending }, { publishDueEvents }, { refreshAnalytics }] =
    await Promise.all([
      import('./scheduler'),
      import('./event-crm'),
      import('./event-jobs'),
      import('./dashboard-trend-store'),
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
    'refresh-analytics': async () => {
      const { readSiteSettings } = await import('@/lib/site-settings');
      return refreshAnalytics(env.DB, (await readSiteSettings()).timeZone, now.getTime());
    },
  };
}
