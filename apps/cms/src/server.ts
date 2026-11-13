// First, so every log line from here on has email addresses masked.
import './lib/redact-console';
import * as Sentry from '@sentry/cloudflare';
import { env } from 'cloudflare:workers';
import { type CronSchedule, cronSchedules } from './lib/cron-jobs';
import { sentryOptions } from './lib/sentry';
import { mediaIdFromPath, serveMedia } from './server/media-delivery';

// The app and the cron jobs are loaded when first needed rather than at
// startup. Most starts are the five-minute cron, which needs only its jobs, and
// loading the whole app for it made every one of them slower. Sentry's
// TanStack wrapper (server function spans) comes with the app for the same reason.
const loadApp = () =>
  Promise.all([
    import('@tanstack/react-start/server-entry'),
    import('@sentry/tanstackstart-react'),
  ]).then(([app, sentry]) => sentry.wrapFetchWithSentry(app.default));

const OLD_HOST = 'living-legacy-cms.living-legacy.workers.dev';

// The health check the uptime monitor (Better Stack) watches (server/health-check.ts).
const HEALTH_PATH = '/api/health';

/**
 * No other site may show the CMS in a frame, where a signed-in editor could be
 * tricked into clicking something (clickjacking). The session cookie being
 * SameSite=Lax covers other sites, but not a sibling subdomain.
 */
function noFraming(response: Response) {
  const headers = new Headers(response.headers);
  headers.set('X-Frame-Options', 'DENY');
  if (!headers.has('Content-Security-Policy')) {
    headers.set('Content-Security-Policy', "frame-ancestors 'none'");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Custom Worker entry: TanStack Start serves requests. The cron triggers in
// wrangler.jsonc: every five minutes, publish scheduled posts and events, sync event bookings
// to HubSpot (once connected; HubSpot sends the guest emails) and renew the stored
// website-traffic answers the dashboard reads; daily, clear out unused stored files, delete
// bookings a year after their event, forget missing pages nobody has asked for in 90 days,
// rescore every post, clear job history older than two weeks and traffic answers unrenewed for
// two days. The full list is src/lib/cron-jobs.ts.
//
// withSentry reports errors from both, and traces requests, cron runs and D1.
export default Sentry.withSentry(
  () => ({
    ...sentryOptions,
    // Every image in a list is its own request; tracing them would bury the rest.
    tracesSampler: ({ name, normalizedRequest }) => {
      // So is the health check, which the uptime monitor calls every few minutes.
      const path = normalizedRequest?.url ? new URL(normalizedRequest.url).pathname : name;
      return path.includes('/api/media/') || path === HEALTH_PATH
        ? 0
        : sentryOptions.tracesSampleRate;
    },
  }),
  {
    // The app reads bindings via `cloudflare:workers`, so it only gets the request.
    async fetch(request, _env, ctx) {
      // The CMS moved to its own domain. Sign-in only works there (its links and
      // cookies follow BETTER_AUTH_URL), so the old address forwards to it.
      // Preview versions have their own workers.dev hosts and are left alone.
      const url = new URL(request.url);
      if (url.hostname === OLD_HOST) {
        url.hostname = new URL(env.BETTER_AUTH_URL).hostname;
        return Response.redirect(url.toString(), 301);
      }
      // The busiest route, and it needs nothing from the app: serve it directly.
      const mediaId = mediaIdFromPath(url.pathname);
      if (mediaId) return serveMedia(request, mediaId, ctx);
      // Public, for the uptime monitor; it needs nothing from the app either.
      if (url.pathname === HEALTH_PATH) {
        const { healthResponse } = await import('./server/health-check');
        return healthResponse(request, env.DB);
      }
      return noFraming(await (await loadApp()).fetch(request));
    },
    // Each run reports job errors to Sentry, pings its Better Stack heartbeat
    // and is kept for the System page. Awaited rather than handed to
    // waitUntil, so every error is sent before withSentry flushes.
    async scheduled(controller, env) {
      const now = new Date(controller.scheduledTime);
      const schedule: CronSchedule =
        controller.cron === cronSchedules.daily.cron ? 'daily' : 'every-5-minutes';
      const [{ runMonitored }, { jobsFor, heartbeatFor, jobHeartbeats }, { recordCronRuns }] =
        await Promise.all([
          import('./server/cron-monitor'),
          import('./server/cron-jobs'),
          import('./server/system-store'),
        ]);
      const runs = await runMonitored(await jobsFor(schedule, env, now), Sentry, {
        url: heartbeatFor(schedule, env),
        jobs: jobHeartbeats(env),
      });
      // The jobs' own failures are already in Sentry; this only loses the page's copy.
      await recordCronRuns(env.DB, runs).catch((error: unknown) =>
        Sentry.captureException(error, { tags: { job: 'record-runs' } })
      );
    },
  } satisfies ExportedHandler<Cloudflare.Env>
);
