import type { APIRoute } from 'astro';
import { verifySanitySignature } from '@/lib/integrations/webhook-auth';

export const prerender = false;

/**
 * Sanity → Cloudflare Pages deploy trigger.
 *
 * Requires two env vars in Cloudflare Pages (Production AND Preview):
 *   SANITY_WEBHOOK_SECRET  — same value set on the Sanity webhook
 *   CLOUDFLARE_DEPLOY_HOOK — the project's deploy hook URL
 */
export const POST: APIRoute = async ({ request }) => {
  const deployHook = import.meta.env.CLOUDFLARE_DEPLOY_HOOK;
  const secret = import.meta.env.SANITY_WEBHOOK_SECRET;

  if (!deployHook) {
    console.warn('[sanity-webhook] CLOUDFLARE_DEPLOY_HOOK not configured');
    return new Response('Deploy hook not configured', { status: 500 });
  }

  if (!secret) {
    console.warn('[sanity-webhook] SANITY_WEBHOOK_SECRET not configured');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get('sanity-webhook-signature');
  const valid = await verifySanitySignature(rawBody, signatureHeader, secret);

  if (!valid) {
    console.warn('[sanity-webhook] signature verification failed');
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const response = await fetch(deployHook, { method: 'POST' });
    if (!response.ok) {
      console.warn(`[sanity-webhook] deploy hook returned ${response.status}`);
      return new Response('Deploy hook failed', { status: 502 });
    }
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.warn('[sanity-webhook] deploy fetch threw:', error);
    return new Response('Error triggering deploy', { status: 500 });
  }
};
