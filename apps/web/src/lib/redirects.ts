/**
 * URL redirects, managed in the CMS (Redirects page) and stored in the shared
 * D1 database. The old WordPress URLs that used to be listed here were moved
 * into the database by migration 0002_redirect_settings.
 *
 * Consumed by `src/middleware.ts` rather than `public/_redirects`: on
 * Cloudflare Workers every request (including ones that would otherwise 404)
 * is handled by the Worker, so a static `_redirects` file never gets a chance
 * to run ahead of routing.
 */
import {
  type RedirectMatch,
  type RedirectRule,
  type RedirectStatusCode,
  notFoundPathKey,
  resolveRedirect,
} from '@ll/content';
import { env } from 'cloudflare:workers';

/** The slice of the D1 binding used here, so the site needs no Workers type package. */
interface D1 {
  prepare(query: string): {
    bind(...values: unknown[]): { run(): Promise<unknown> };
    all<T>(): Promise<{ results: T[] }>;
  };
}

const db = (env as { DB?: D1 }).DB;

/** How long an isolate reuses the rule list before reading it again. */
const CACHE_MS = 60_000;
let cache: { rules: RedirectRule[]; expires: number } | undefined;

type Row = {
  id: string;
  from_path: string;
  to_path: string;
  status_code: RedirectStatusCode;
  keep_query: number;
};

async function loadRules(): Promise<RedirectRule[]> {
  if (!db) return [];
  if (cache && cache.expires > Date.now()) return cache.rules;

  try {
    const { results } = await db
      .prepare(
        'SELECT id, from_path, to_path, status_code, keep_query FROM redirects WHERE enabled = 1'
      )
      .all<Row>();
    const rules = results.map((r) => ({
      id: r.id,
      fromPath: r.from_path,
      toPath: r.to_path,
      statusCode: r.status_code,
      keepQuery: r.keep_query === 1,
    }));
    cache = { rules, expires: Date.now() + CACHE_MS };
    return rules;
  } catch (error) {
    // A database hiccup must not take the site down; serve the last known
    // rules, or none, and try again on the next request.
    console.error('[redirects] could not load rules', error);
    return cache?.rules ?? [];
  }
}

/** Resolves a request to a redirect, or `null` if no enabled rule matches. */
export async function findRedirect(url: URL): Promise<RedirectMatch | null> {
  return resolveRedirect(await loadRules(), url.pathname, url.search);
}

/** Counts a hit and records when it happened. Meant for `waitUntil`. */
export async function recordHit(id: string): Promise<void> {
  try {
    await db
      ?.prepare('UPDATE redirects SET hits = hits + 1, last_hit_at = ? WHERE id = ?')
      .bind(Date.now(), id)
      .run();
  } catch (error) {
    console.error('[redirects] could not record a hit', error);
  }
}

/**
 * Counts a "not found" for the CMS's Missing pages, where someone can redirect
 * the paths people still follow. Bot probes and icon requests are skipped (see
 * notFoundPathKey). Meant for `waitUntil`; a failure only logs.
 */
export async function recordNotFound(pathname: string): Promise<void> {
  const path = notFoundPathKey(pathname);
  if (!path) return;
  const now = Date.now();
  try {
    await db
      ?.prepare(
        `INSERT INTO not_found_paths (path, hits, first_seen_at, last_seen_at) VALUES (?, 1, ?, ?)
         ON CONFLICT(path) DO UPDATE SET hits = hits + 1, last_seen_at = excluded.last_seen_at`
      )
      .bind(path, now, now)
      .run();
  } catch (error) {
    console.error('[not found] could not record a path', error);
  }
}
