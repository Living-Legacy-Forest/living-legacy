import {
  type CoverageRow,
  type RedirectRule,
  classifyCoverage,
  liveSitePaths,
  parseOldUrls,
} from '@ll/content';
import { locations, posts, redirects } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';

/** How many of the lines that were not addresses are sent back to show. */
const IGNORED_SHOWN = 20;

export type RedirectCoverage = {
  rows: CoverageRow[];
  /** Lines that were not an address a path rule can catch, such as ones with a query string. */
  ignored: string[];
  ignoredCount: number;
  /** There were more addresses than one check takes. */
  truncated: boolean;
};

/**
 * For the move to the national site: of the old site's addresses, which already have a redirect,
 * which are still a page on the new site, and which have neither. Judged by the same rules the
 * website applies, over the redirects that are switched on.
 */
export async function coverageFor(
  db: ReturnType<typeof getDb>,
  text: string
): Promise<RedirectCoverage> {
  const parsed = parseOldUrls(text);
  const [ruleRows, postRows, locationRows] = await db.batch([
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
    db
      .select({ slug: posts.slug })
      .from(posts)
      .where(and(eq(posts.status, 'published'), isNull(posts.deletedAt))),
    // A forest that has moved to its own site has no page here.
    db
      .select({ slug: locations.slug })
      .from(locations)
      .where(
        and(
          eq(locations.status, 'published'),
          isNull(locations.deletedAt),
          ne(locations.stage, 'external')
        )
      ),
  ]);

  const rules: RedirectRule[] = ruleRows;
  const live = liveSitePaths({
    postSlugs: postRows.map((p) => p.slug),
    locationSlugs: locationRows.map((l) => l.slug),
  });
  return {
    rows: classifyCoverage(parsed.paths, rules, live),
    ignored: parsed.ignored.slice(0, IGNORED_SHOWN),
    ignoredCount: parsed.ignored.length,
    truncated: parsed.truncated,
  };
}

export const checkRedirectCoverage = createServerFn({ method: 'POST' })
  .middleware([requirePermission('redirects:write')])
  .validator(z.object({ text: z.string().max(1_000_000) }))
  .handler(({ data }) => coverageFor(getDb(), data.text));
