import { type RedirectRule, matchRedirect } from '@ll/content';
import { createDb } from '@ll/db';
import { notFoundPaths, redirects } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { count, desc, eq, isNull, lt, notInArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';

/** The busiest paths shown; past this, the quieter ones are not worth a redirect yet. */
const SHOWN = 200;
/** Paths not seen for this long are cleared by the daily job. */
const KEEP_DAYS = 90;
/** However busy the bots, the table stays this small; the quietest paths go first. */
const MAX_ROWS = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Paths the website answered "not found", busiest first. A path an enabled
 * redirect now catches (wildcards included) is left out: it is fixed, even if
 * its count has not caught up.
 */
export const listMissingPages = createServerFn({ method: 'GET' })
  .middleware([requirePermission('redirects:write')])
  .handler(async () => {
    const db = getDb();
    const [rows, rules] = await db.batch([
      db
        .select()
        .from(notFoundPaths)
        .where(isNull(notFoundPaths.dismissedAt))
        .orderBy(desc(notFoundPaths.hits), desc(notFoundPaths.lastSeenAt))
        .limit(SHOWN * 2),
      db
        .select({
          id: redirects.id,
          fromPath: redirects.fromPath,
          toPath: redirects.toPath,
          statusCode: redirects.statusCode,
          keepQuery: redirects.keepQuery,
        })
        .from(redirects)
        .where(eq(redirects.enabled, true)),
    ]);
    const open = rows
      .filter((r) => !matchRedirect(rules satisfies RedirectRule[], r.path))
      .slice(0, SHOWN);
    return open.map((r) => ({
      path: r.path,
      hits: r.hits,
      firstSeenAt: r.firstSeenAt.getTime(),
      lastSeenAt: r.lastSeenAt.getTime(),
    }));
  });

export type MissingPage = Awaited<ReturnType<typeof listMissingPages>>[number];

/** Hides a path that needs no redirect. It keeps counting, out of sight. */
export const dismissMissingPage = createServerFn({ method: 'POST' })
  .middleware([requirePermission('redirects:write')])
  .validator(z.object({ path: z.string().min(1).max(300) }))
  .handler(async ({ data }) => {
    await getDb()
      .update(notFoundPaths)
      .set({ dismissedAt: new Date() })
      .where(eq(notFoundPaths.path, data.path));
  });

/** Daily: forget paths nobody has asked for in a while, and cap the table. */
export async function pruneMissingPages(d1: D1Database, now: Date) {
  const db = createDb(d1);
  try {
    await db
      .delete(notFoundPaths)
      .where(lt(notFoundPaths.lastSeenAt, new Date(now.getTime() - KEEP_DAYS * DAY_MS)));
    const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(notFoundPaths);
    if (n > MAX_ROWS) {
      const keep = db
        .select({ path: notFoundPaths.path })
        .from(notFoundPaths)
        .orderBy(desc(notFoundPaths.hits), desc(notFoundPaths.lastSeenAt))
        .limit(MAX_ROWS);
      await db.delete(notFoundPaths).where(notInArray(notFoundPaths.path, keep));
    }
  } catch (error) {
    console.error('[not found] could not prune missing pages', error);
  }
}
