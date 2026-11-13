import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { type TrendMetric, bucketByDay, dayKeys, trendMetricKeys } from '@/lib/dashboard-trend';
import { authMiddleware } from '@/lib/session';
import { readSiteSettings } from '@/lib/site-settings';
import { loadDistinctVisitors, loadVisits } from './dashboard-trend-store';

/**
 * One website metric per day over the last `days` days and the `days` before them, in the site's time
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
    const readings = (await loadVisits(days * 2, timeZone))[metric];
    const totals = bucketByDay(keys, readings);
    // A visitor who came on three days is one visitor, so these are counted over the whole
    // period rather than added up from the days.
    const distinct =
      metric === 'visitors' ? await loadDistinctVisitors(timeZone, keys[days]!, keys[0]!) : null;
    return {
      days: keys.slice(days),
      current: totals.slice(days),
      previous: totals.slice(0, days),
      distinct,
    };
  });

export type DashboardTrend = Awaited<ReturnType<typeof getDashboardTrend>>;
