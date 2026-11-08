import * as Sentry from '@sentry/cloudflare';
import { env } from 'cloudflare:workers';
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

// Must match the second trigger in wrangler.jsonc.
const MEDIA_SWEEP_CRON = '0 17 * * *';

const OLD_HOST = 'living-legacy-cms.living-legacy.workers.dev';

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
// wrangler.jsonc: every five minutes, publish scheduled posts and events and
// sync event bookings to HubSpot (once connected; HubSpot sends the guest
// emails); daily, clear out unused stored files, delete bookings a year after
// their event, and forget missing pages nobody has asked for in 90 days.
//
// withSentry reports errors from both, and traces requests, cron runs and D1.
export default Sentry.withSentry(
  () => ({
    ...sentryOptions,
    // Every image in a list is its own request; tracing them would bury the rest.
    tracesSampler: ({ name, normalizedRequest }) => {
      const path = normalizedRequest?.url ? new URL(normalizedRequest.url).pathname : name;
      return path.includes('/api/media/') ? 0 : sentryOptions.tracesSampleRate;
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
      return noFraming(await (await loadApp()).fetch(request));
    },
    async scheduled(controller, env, ctx) {
      const now = new Date(controller.scheduledTime);
      if (controller.cron === MEDIA_SWEEP_CRON) {
        const [{ sweepOrphanedMedia }, { purgeOldBookings }, { pruneMissingPages }] =
          await Promise.all([
            import('./server/media-sweep'),
            import('./server/event-jobs'),
            import('./server/not-found'),
          ]);
        ctx.waitUntil(
          Promise.all([
            sweepOrphanedMedia(env.DB, env.MEDIA, now),
            purgeOldBookings(env.DB, now),
            pruneMissingPages(env.DB, now),
          ])
        );
        return;
      }
      const [{ publishDuePosts }, { syncPending }, { publishDueEvents }] = await Promise.all([
        import('./server/scheduler'),
        import('./server/event-crm'),
        import('./server/event-jobs'),
      ]);
      ctx.waitUntil(
        Promise.all([
          publishDuePosts(env.DB, now),
          syncPending(env.DB),
          publishDueEvents(env.DB, now),
        ])
      );
    },
  } satisfies ExportedHandler<Cloudflare.Env>
);
