import { defineMiddleware } from 'astro:middleware';
import { captureServerException } from '@/lib/analytics/posthog-server';

/**
 * Reports on-demand rendering failures to PostHog error tracking. Now that every
 * route is server-rendered, this is the server-side equivalent of the browser's
 * `capture_exceptions`.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  try {
    return await next();
  } catch (error) {
    await captureServerException(error, { route: context.url.pathname });
    throw error;
  }
});
