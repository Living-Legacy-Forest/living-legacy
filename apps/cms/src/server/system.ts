import { createServerFn } from '@tanstack/react-start';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';
import { checkTone, jobTone, summariseTones } from '@/lib/system-status';
import { healthOptions, runHealthChecks } from './system-health';
import { loadJobHealth } from './system-store';

/** The System page: service health and the scheduled jobs. Admins only. */
export const getSystemStatus = createServerFn({ method: 'GET' })
  .middleware([requirePermission('settings:write')])
  .handler(async () => {
    const [jobs, health] = await Promise.all([
      loadJobHealth(getDb(), Date.now()),
      runHealthChecks(healthOptions(true)),
    ]);
    return { ...jobs, health };
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
