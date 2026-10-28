import { PostHog } from 'posthog-node';

/**
 * Server-side PostHog for SSR `/api/*` routes running on the Cloudflare
 * Workers runtime. `posthog-node` resolves to its edge build via the `workerd`
 * export condition, so no Node built-ins are pulled into the Worker.
 *
 * Events are flushed per call (`flushAt: 1`) because the Worker may be torn
 * down as soon as the response is returned.
 */

let client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = import.meta.env.PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  client ??= new PostHog(key, {
    host: import.meta.env.PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  });

  return client;
}

/**
 * Report a server-side error to PostHog error tracking. Never throws — a
 * failed capture must not turn a handled error into a 500.
 */
export async function captureServerException(
  error: unknown,
  properties: Record<string, unknown> = {}
): Promise<void> {
  const posthog = getClient();
  if (!posthog) return;

  try {
    posthog.captureException(error instanceof Error ? error : new Error(String(error)), undefined, {
      ...properties,
      $process_person_profile: false,
    });
    await posthog.flush();
  } catch (captureError) {
    console.warn('[posthog] failed to capture server exception:', captureError);
  }
}
