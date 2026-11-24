import { can } from '@ll/content';
import { createServerFn } from '@tanstack/react-start';
import { getDb } from '@/lib/db';
import { authMiddleware } from '@/lib/session';
import { type NavCounts, countContentIssues } from '@/lib/nav-counts';
import { loadContentChecks } from './content-checks';
import { loadMissingPages } from './not-found';

/**
 * The numbers the sidebar shows beside pages with something waiting: open content checks, and
 * missing pages no redirect catches yet. Only for the people who can act on them, and the same
 * answers the dashboard uses (the checks up to five minutes old), so it costs nothing extra.
 * The bell already covers reviews and bookings, so they are not counted twice.
 */
export const getNavCounts = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<NavCounts> => {
    const { user } = context;
    const db = getDb();
    const [issues, missing] = await Promise.all([
      can(user, 'posts:publish') || can(user, 'seo:write')
        ? loadContentChecks(db, { fresh: false })
        : null,
      can(user, 'redirects:write') ? loadMissingPages(db) : null,
    ]);
    return {
      ...(issues ? { '/checks': countContentIssues(issues) } : {}),
      ...(missing ? { '/redirects': missing.length } : {}),
    };
  });
