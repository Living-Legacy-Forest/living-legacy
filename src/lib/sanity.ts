import { createClient, type SanityClient } from '@sanity/client';
import { SANITY_PROJECT_ID, SANITY_DATASET, SANITY_API_VERSION } from 'astro:env/server';

let client: SanityClient | null = null;

/**
 * Request-time Sanity client.
 *
 * `useCdn: false` so on-demand rendered pages always read the latest published
 * content — that is what removes the need for a rebuild on publish. Env is read
 * through `astro:env/server`, which resolves from the Workers runtime rather
 * than being inlined at build time.
 */
export function getSanityClient(): SanityClient {
  client ??= createClient({
    projectId: SANITY_PROJECT_ID ?? 'placeholder',
    dataset: SANITY_DATASET,
    apiVersion: SANITY_API_VERSION,
    useCdn: false,
  });

  return client;
}
