import type { captureCheckIn } from '@sentry/cloudflare';

type MonitorConfig = NonNullable<Parameters<typeof captureCheckIn>[1]>;

/** A Sentry cron monitor: it alerts when a run fails, runs too long or never happens. */
export interface Monitor {
  slug: string;
  config: MonitorConfig;
}

/** The two Sentry calls this needs, passed in so the tests need no Sentry. */
export interface CronReporter {
  captureCheckIn: typeof captureCheckIn;
  captureException(error: unknown, context: { tags: { job: string } }): void;
}

/** How one job's run went, as the System page shows it. */
export interface JobRun {
  job: string;
  startedAt: Date;
  durationMs: number;
  /** Cut to ERROR_LENGTH; null when the job ran without a problem. */
  error: string | null;
}

const ERROR_LENGTH = 500;

/**
 * Runs one schedule's jobs side by side and, if it has one, checks in with
 * its monitor.
 *
 * Each job is on its own: one failing does not stop the others, and each
 * failure goes to Sentry tagged with the job's name, so the issue says which
 * one broke. The run checks in as an error if any job failed. Never rejects,
 * so a failure is reported once, not again as an error from the cron handler.
 */
export async function runMonitored(
  monitor: Monitor | null,
  jobs: Record<string, () => Promise<unknown>>,
  reporter: CronReporter
): Promise<JobRun[]> {
  const checkInId =
    monitor &&
    reporter.captureCheckIn({ monitorSlug: monitor.slug, status: 'in_progress' }, monitor.config);
  const started = Date.now();

  const runs = await Promise.all(
    Object.entries(jobs).map(async ([job, run]): Promise<JobRun> => {
      const startedAt = new Date();
      let error: string | null = null;
      try {
        await run();
      } catch (thrown) {
        reporter.captureException(thrown, { tags: { job } });
        error = String(thrown).slice(0, ERROR_LENGTH);
      }
      return { job, startedAt, durationMs: Date.now() - startedAt.getTime(), error };
    })
  );

  if (monitor && checkInId) {
    reporter.captureCheckIn({
      monitorSlug: monitor.slug,
      status: runs.some((r) => r.error !== null) ? 'error' : 'ok',
      checkInId,
      duration: (Date.now() - started) / 1000,
    });
  }
  return runs;
}
