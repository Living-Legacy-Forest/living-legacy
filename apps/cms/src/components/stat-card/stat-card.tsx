import { Link } from '@tanstack/react-router';
import { Suspense, lazy } from 'react';
import { ChevronRightIcon, TrendingDownIcon, TrendingUpIcon } from '@/components/icons';
import { Card, CardTitle } from '@/components/ui/card';
import { formatInteger } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Stat, change } from './shared';

export { MUTED, type Part, type Stat, type Trend } from './shared';

const TrendChart = lazy(() => import('./stat-charts').then((m) => ({ default: m.TrendChart })));
const PartsChart = lazy(() => import('./stat-charts').then((m) => ({ default: m.PartsChart })));

/**
 * A label, a chart, then the figure. The figure sits at the foot of the card,
 * so a row of cards lines its numbers up whether or not each has a chart.
 */
export function StatCard({ stat }: { stat: Stat }) {
  const { label, value, display, hint, trend, parts, link } = stat;
  const delta = trend && change(trend.weeks);
  const Arrow = delta && delta.diff > 0 ? TrendingUpIcon : TrendingDownIcon;

  const figure = (
    <>
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight text-balance tabular-nums">
          {display ?? formatInteger(value)}
        </span>
        {delta && (
          <span
            className="text-muted-foreground inline-flex items-center gap-1 text-xs tabular-nums"
            title={`${delta.text} ${trend.counted} in the last 4 weeks, against the 4 before`}
          >
            <Arrow aria-hidden className="size-3.5" />
            <span className="text-foreground">{delta.text}</span>
            <span className="sr-only">
              {trend.counted} in the last 4 weeks, against the 4 before
            </span>
          </span>
        )}
      </span>
      {link && (
        <ChevronRightIcon
          aria-hidden
          className="text-muted-foreground size-5 shrink-0 transition-transform duration-150 ease-out group-hover/figure:translate-x-0.5 motion-reduce:transition-none"
        />
      )}
    </>
  );
  const figureClass = 'flex items-center justify-between gap-2';

  return (
    <Card className="gap-0">
      <CardTitle className="text-muted-foreground px-(--card-spacing) text-xs font-normal">
        {label}
      </CardTitle>
      {(trend || parts) && (
        // Holds the chart's height while the chart library loads.
        <Suspense fallback={<div className="mt-3 h-24" />}>
          <div className="px-(--card-spacing)">
            {trend && <TrendChart {...trend} />}
            {parts && <PartsChart parts={parts} />}
          </div>
        </Suspense>
      )}
      <div className="mt-auto px-(--card-spacing) pt-4">
        {link ? (
          <Link
            {...link}
            aria-label={`${label}: ${display ?? formatInteger(value)}. Open the list.`}
            className={cn(
              figureClass,
              'group/figure focus-visible:ring-ring/50 touch:min-h-11 -mx-1.5 rounded-md px-1.5 outline-none focus-visible:ring-[3px]'
            )}
          >
            {figure}
          </Link>
        ) : (
          <div className={figureClass}>{figure}</div>
        )}
        <p className="text-muted-foreground mt-1 text-xs text-pretty">{hint}</p>
      </div>
    </Card>
  );
}
