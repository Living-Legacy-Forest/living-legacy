/**
 * Calls to the CMS's internal API (apps/cms/src/server/internal-api.ts) over a
 * service binding. The CMS owns booking rules and email; the site only passes
 * the guest's request on and relays the answer.
 */
import type { InternalResult } from '@ll/content';
import { env } from 'cloudflare:workers';

/** The slice of the bindings used here, so the site needs no Workers type package. */
interface Bindings {
  CMS?: { fetch(input: string, init?: RequestInit): Promise<Response> };
  INTERNAL_KEY?: string;
}

export type CmsInternalPath =
  '/internal/events/book' | '/internal/events/view' | '/internal/events/cancel';

/**
 * POSTs `body` as JSON to the CMS. Resolves with the CMS's status and JSON body
 * (a refusal such as 409 is a result, not an error). Throws if the binding or key
 * is missing, or the CMS cannot be reached or does not answer with JSON.
 */
export async function callCms<T>(
  path: CmsInternalPath,
  body: unknown
): Promise<{ status: number; data: InternalResult<T> }> {
  const { CMS, INTERNAL_KEY } = env as Bindings;
  if (!CMS || !INTERNAL_KEY) throw new Error('CMS binding or internal key is not set');

  // The host is never resolved: a service binding routes by binding, not by name.
  const response = await CMS.fetch(`https://cms.internal${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-key': INTERNAL_KEY },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: (await response.json()) as InternalResult<T> };
}
