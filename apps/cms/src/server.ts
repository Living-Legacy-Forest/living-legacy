import handler from '@tanstack/react-start/server-entry';
import { publishDuePosts } from './server/scheduler';

// Custom Worker entry: TanStack Start serves requests; the cron trigger in
// wrangler.jsonc publishes scheduled posts.
export default {
  // Only the request is passed: the app reads bindings via `cloudflare:workers`.
  fetch: (request) => handler.fetch(request),
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(publishDuePosts(env.DB, new Date(controller.scheduledTime)));
  },
} satisfies ExportedHandler<Cloudflare.Env>;
