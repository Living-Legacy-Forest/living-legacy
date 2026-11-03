import handler from '@tanstack/react-start/server-entry';
import { env } from 'cloudflare:workers';
import { mediaIdFromPath, serveMedia } from './server/media-delivery';
import { publishDuePosts } from './server/scheduler';

const OLD_HOST = 'living-legacy-cms.living-legacy.workers.dev';

// Custom Worker entry: TanStack Start serves requests; the cron trigger in
// wrangler.jsonc publishes scheduled posts.
export default {
  // The app reads bindings via `cloudflare:workers`, so it only gets the request.
  fetch(request, _env, ctx) {
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
    return handler.fetch(request);
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(publishDuePosts(env.DB, new Date(controller.scheduledTime)));
  },
} satisfies ExportedHandler<Cloudflare.Env>;
