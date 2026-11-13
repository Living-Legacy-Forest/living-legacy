import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { authMiddleware } from '@/lib/session';

const DAYS = 30;
const TTL_MS = 10 * 60 * 1000;

type Secrets = {
  POSTHOG_PERSONAL_API_KEY?: string;
  POSTHOG_PROJECT_ID?: string;
  POSTHOG_API_HOST?: string;
};

// Per isolate. The list asks for a page of posts at a time and views change slowly.
const cache = new Map<string, { at: number; views: Record<string, number[]> }>();

/**
 * Page views per post over the last 30 days, oldest first, read from PostHog. `null` when the
 * CMS has no PostHog key, so the list simply leaves the chart out.
 */
export const getPostViews = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ slugs: z.array(z.string().max(200)).max(100) }))
  .handler(async ({ data }): Promise<{ views: Record<string, number[]> } | null> => {
    const {
      POSTHOG_PERSONAL_API_KEY: key,
      POSTHOG_PROJECT_ID: project,
      POSTHOG_API_HOST: host,
    } = env as unknown as Secrets;
    if (!key || !project || data.slugs.length === 0) return null;

    const cacheKey = [...data.slugs].sort().join(',');
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < TTL_MS) return { views: hit.views };

    const response = await fetch(
      `${host || 'https://us.posthog.com'}/api/projects/${project}/query/`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: {
            kind: 'HogQLQuery',
            query: `SELECT replaceRegexpOne(properties.$pathname, '/$', '') AS path,
              dateDiff('day', toDate(timestamp), today()) AS ago, count() AS views
            FROM events
            WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${DAYS} DAY
              AND path IN {paths}
            GROUP BY path, ago`,
            values: { paths: data.slugs.map((slug) => `/blog/${slug}`) },
          },
        }),
      }
    );
    if (!response.ok) throw new Error('Could not load page views');

    const { results } = (await response.json()) as { results: [string, number, number][] };
    const views: Record<string, number[]> = Object.fromEntries(
      data.slugs.map((slug) => [slug, new Array<number>(DAYS).fill(0)])
    );
    for (const [path, ago, count] of results) {
      const series = views[path.replace(/^\/blog\//, '')];
      if (series && ago >= 0 && ago < DAYS) series[DAYS - 1 - ago] = Number(count);
    }
    cache.set(cacheKey, { at: Date.now(), views });
    return { views };
  });
