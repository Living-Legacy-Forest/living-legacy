import { createServerFn } from '@tanstack/react-start';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';
import { checkTone, jobTone, summariseTones } from '@/lib/system-status';
import { DATABASE_LIMIT_BYTES, healthOptions, runHealthChecks } from './system-health';
import { loadJobHealth, loadUsage } from './system-store';

/** The System page: service health and the scheduled jobs. Admins only. */
export const getSystemStatus = createServerFn({ method: 'GET' })
  .middleware([requirePermission('settings:write')])
  .handler(async () => {
    const options = healthOptions(true);
    const [jobs, health, usage, size] = await Promise.all([
      loadJobHealth(getDb(), Date.now()),
      runHealthChecks(options),
      loadUsage(getDb()),
      // D1 reports the database's size with any query's result.
      options.d1
        .prepare('select 1')
        .run()
        .then((result) => result.meta.size_after)
        .catch(() => null),
    ]);
    return {
      ...jobs,
      health,
      usage: { ...usage, databaseBytes: size, databaseLimitBytes: DATABASE_LIMIT_BYTES },
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
