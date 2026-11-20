import { media } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { gte } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';
import { dayKeys } from '@/lib/dashboard-trend';
import { growthOf } from '@/lib/media-growth';
import { readSiteSettings } from '@/lib/site-settings';
import { MEDIA_ALLOWANCE_BYTES } from '@/lib/storage-meter';
import { checkTone, jobTone, summariseTones } from '@/lib/system-status';
import { loadAssistantSummary } from './ai/summary';
import { DATABASE_LIMIT_BYTES, healthOptions, runHealthChecks } from './system-health';
import { loadJobHealth, loadUsage } from './system-store';

/** The System page: service health and the scheduled jobs. Admins only. */
export const getSystemStatus = createServerFn({ method: 'GET' })
  .middleware([requirePermission('settings:write')])
  .handler(async () => {
    const options = healthOptions(true);
    const { timeZone } = await readSiteSettings();
    const [jobs, health, usage, size, uploads, assistant] = await Promise.all([
      loadJobHealth(getDb(), Date.now()),
      runHealthChecks(options),
      loadUsage(getDb()),
      // D1 reports the database's size with any query's result.
      options.d1
        .prepare('select 1')
        .run()
        .then((result) => result.meta.size_after)
        .catch(() => null),
      // Each upload's day and size over the longest span the page offers.
      getDb()
        .select({ at: media.createdAt, bytes: media.size })
        .from(media)
        .where(gte(media.createdAt, new Date(Date.now() - 91 * 86_400_000))),
      loadAssistantSummary(getDb()),
    ]);
    return {
      ...jobs,
      health,
      assistant,
      usage: {
        ...usage,
        databaseBytes: size,
        databaseLimitBytes: DATABASE_LIMIT_BYTES,
        mediaAllowanceBytes: MEDIA_ALLOWANCE_BYTES,
        growth: growthOf(uploads, dayKeys(90, timeZone), timeZone),
      },
    };
  });

export type SystemStatus = Awaited<ReturnType<typeof getSystemStatus>>;

/**
 * The header's one-word status: the same checks as the System page, boiled
 * down to the worst colour. Loaded after the page, so nothing waits on it.
 */
export const getSystemSummary = createServerFn({ method: 'GET' })
  .middleware([requirePermission('settings:write')])
  .handler(async () => {
    const [jobs, health] = await Promise.all([
      loadJobHealth(getDb(), Date.now()),
      runHealthChecks(healthOptions(true)),
    ]);
    return summariseTones([
      ...health.map((check) => checkTone[check.status]),
      ...jobs.schedules.flatMap((s) => s.jobs.map((job) => jobTone[job.health])),
    ]);
  });

export type SystemSummary = Awaited<ReturnType<typeof getSystemSummary>>;
