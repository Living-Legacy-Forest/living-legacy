import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  type TrendMetric,
  bucketByDay,
  dayKeys,
  trendMetricKeys,
  trendMetrics,
} from '@/lib/dashboard-trend';
import { authMiddleware } from '@/lib/session';
import { readSiteSettings } from '@/lib/site-settings';
import { loadContent, loadVisits } from './dashboard-trend-store';

const DAY_MS = 86_400_000;

/**
 * One metric per day over the last `days` days and the `days` before them, in the site's time
 * zone. Today counts so far, so the last point is a day in progress.
 */
export const getDashboardTrend = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      metric: z.enum(trendMetricKeys as [TrendMetric, ...TrendMetric[]]),
      days: z.union([z.literal(7), z.literal(30), z.literal(90)]),
    })
  )
  .handler(async ({ data }) => {
    const { metric, days } = data;
    const { timeZone } = await readSiteSettings();
    const keys = dayKeys(days * 2, timeZone);
    const readings = trendMetrics[metric].analytics
      ? (await loadVisits(days * 2, timeZone))[metric as 'visits' | 'pageviews']
      : // A day's margin either side of the zone's midnight; days outside the keys are dropped.
        await loadContent(
          metric as 'booked' | 'published',
          Date.now() - (days * 2 + 1) * DAY_MS,
          timeZone
        );
    const totals = bucketByDay(keys, readings);
    return {
      days: keys.slice(days),
      current: totals.slice(days),
      previous: totals.slice(0, days),
    };
  });

export type DashboardTrend = Awaited<ReturnType<typeof getDashboardTrend>>;
