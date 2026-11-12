/** The one Sentry call this needs, passed in so the tests need no Sentry. */
export interface ErrorReporter {
  captureException(error: unknown, context: { tags: { job: string } }): void;
}

/**
 * Where a schedule tells its uptime service that it ran: a Better Stack
 * heartbeat address, which raises an incident when pings stop or say /fail.
 * Unset (local development, or not set up yet) means no ping.
 */
export interface Heartbeat {
  url: string | undefined;
  fetcher?: typeof fetch;
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
const HEARTBEAT_TIMEOUT_MS = 5_000;

/**
 * Runs one schedule's jobs side by side, then pings its heartbeat.
 *
 * Each job is on its own: one failing does not stop the others, and each
 * failure goes to Sentry tagged with the job's name, so the issue says which
 * one broke. The heartbeat gets /fail if any job failed. Never rejects, so a
 * failure is reported once, not again as an error from the cron handler.
 */
export async function runMonitored(
  jobs: Record<string, () => Promise<unknown>>,
  reporter: ErrorReporter,
  heartbeat?: Heartbeat
): Promise<JobRun[]> {
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

  if (heartbeat?.url) {
    const failed = runs.some((r) => r.error !== null);
    try {
      const res = await (heartbeat.fetcher ?? fetch)(
        failed ? `${heartbeat.url}/fail` : heartbeat.url,
        { method: 'POST', signal: AbortSignal.timeout(HEARTBEAT_TIMEOUT_MS) }
      );
      await res.body?.cancel();
    } catch (error) {
      // A missed ping is the uptime service's to notice; the jobs still ran.
      reporter.captureException(error, { tags: { job: 'heartbeat' } });
    }
  }
  return runs;
}
