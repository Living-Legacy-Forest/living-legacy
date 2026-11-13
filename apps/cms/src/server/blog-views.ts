import { createServerFn } from '@tanstack/react-start';
import { dayKeys } from '@/lib/dashboard-trend';
import { authMiddleware } from '@/lib/session';
import { readSiteSettings } from '@/lib/site-settings';
import { TREND_DAYS } from './dashboard';
import { type BlogViews, loadBlogViews } from './dashboard-trend-store';

/**
 * Views of the blog's pages and their readers per day, for the dashboard's Blog views card.
 * Asked for after the dashboard has loaded, as PostHog can be slow; `null` when analytics are
 * not connected or cannot be reached, and the card falls back to counting posts.
 */
export const getBlogViews = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async (): Promise<BlogViews | null> => {
    const { timeZone } = await readSiteSettings();
    return loadBlogViews(timeZone, dayKeys(TREND_DAYS, timeZone));
  });
