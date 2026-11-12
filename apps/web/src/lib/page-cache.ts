/**
 * Finished pages, kept in Cloudflare's cache in each data centre, so most
 * visits skip rendering and the database. Each page is stored under the
 * content version (a counter that database triggers add one to whenever
 * anything the site shows changes; migration 0033), so an edit in the CMS
 * shows on the next visit everywhere, with nothing to purge. The time limit
 * only covers what no edit marks, such as an announcement's dates passing.
 *
 * Cloudflare's cache works on the real domain only; on workers.dev and in
 * development every visit renders, as before.
 */
import { env } from 'cloudflare:workers';

type D1 = {
  prepare(query: string): { first<T>(): Promise<T | null> };
};

const db = (env as { DB?: D1 }).DB;

/** How long a cached page may be served, at most. */
export const PAGE_TTL_SECONDS = 600;

/** A visit within this long of the last check reuses its version. */
const VERSION_MEMO_MS = 2000;
let memo: { version: number; at: number } | undefined;

/** The content version, or null when it cannot be read (then nothing is cached). */
export async function contentVersion(): Promise<number | null> {
  if (!db) return null;
  if (memo && Date.now() - memo.at < VERSION_MEMO_MS) return memo.version;
  try {
    const row = await db
      .prepare('SELECT version FROM content_version WHERE id = 1')
      .first<{ version: number }>();
    if (!row) return null;
    memo = { version: row.version, at: Date.now() };
    return row.version;
  } catch {
    return null;
  }
}

/** Campaign and click tags change nothing on the page, so they share its copy. */
const TRACKING = /^(utm_|gclid$|gbraid$|wbraid$|fbclid$|msclkid$|mc_cid$|mc_eid$|_ga$|_gl$)/;

/** The cache entry for a page at a version: path, the query that matters, version. */
export function pageCacheKey(url: URL, version: number): Request {
  const key = new URL(url.origin + url.pathname);
  const params = [...url.searchParams].filter(([name]) => !TRACKING.test(name)).sort();
  for (const [name, value] of params) key.searchParams.append(name, value);
  key.searchParams.set('__cv', String(version));
  return new Request(key.toString());
}

/** Pages only: not form endpoints and other API routes, which must always run. */
export function isCacheablePage(request: Request, url: URL): boolean {
  return request.method === 'GET' && !url.pathname.startsWith('/api/');
}

/** A rendered page that is the same for every visitor and fine to keep. */
export function isCacheableResponse(response: Response): boolean {
  return (
    response.status === 200 &&
    (response.headers.get('Content-Type') ?? '').includes('text/html') &&
    !response.headers.has('Set-Cookie')
  );
}

export function pageCache(): Cache | undefined {
  return (globalThis as { caches?: { default?: Cache } }).caches?.default;
}
