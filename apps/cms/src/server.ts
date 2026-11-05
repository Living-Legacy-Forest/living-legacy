import { env } from 'cloudflare:workers';
import { mediaIdFromPath, serveMedia } from './server/media-delivery';

// The app, the scheduler and the sweep are loaded when first needed rather
// than at startup. Most starts are the five-minute cron, which needs only the
// scheduler, and loading the whole app for it made every one of them slower.
const loadApp = () => import('@tanstack/react-start/server-entry').then((m) => m.default);

// Must match the second trigger in wrangler.jsonc.
const MEDIA_SWEEP_CRON = '0 17 * * *';

const OLD_HOST = 'living-legacy-cms.living-legacy.workers.dev';

// Custom Worker entry: TanStack Start serves requests; the cron triggers in
// wrangler.jsonc publish scheduled posts and clear out unused stored files.
export default {
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
    return (await loadApp()).fetch(request);
  },
  async scheduled(controller, env, ctx) {
    const now = new Date(controller.scheduledTime);
    if (controller.cron === MEDIA_SWEEP_CRON) {
      const { sweepOrphanedMedia } = await import('./server/media-sweep');
      ctx.waitUntil(sweepOrphanedMedia(env.DB, env.MEDIA, now));
      return;
    }
    const { publishDuePosts } = await import('./server/scheduler');
    ctx.waitUntil(publishDuePosts(env.DB, now));
  },
} satisfies ExportedHandler<Cloudflare.Env>;
