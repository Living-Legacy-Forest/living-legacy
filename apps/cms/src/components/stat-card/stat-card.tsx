import { Link } from '@tanstack/react-router';
import { Suspense, lazy, useState, useSyncExternalStore } from 'react';
import { RangeSelect } from '@/components/range-select';
import { RollingNumber } from '@/components/rolling-number';
import { Card, CardTitle } from '@/components/ui/card';
import { formatBytes, formatInteger } from '@/lib/format';
import { addedIn } from '@/lib/media-growth';
import { cn } from '@/lib/utils';
import { type Range, type Stat, change, sum } from './shared';

export { MUTED, type Part, type Stat, type Trend } from './shared';

const TrendChart = lazy(() => import('./stat-charts').then((m) => ({ default: m.TrendChart })));
const PartsChart = lazy(() => import('./stat-charts').then((m) => ({ default: m.PartsChart })));
const UsageMeter = lazy(() =>
  import('@/components/arc/usage-meter/usage-meter').then((m) => ({ default: m.UsageMeter }))
);

const noop = () => () => {};
/** False on the server and during hydration, then true: the lazy charts' styles load with
 * their code, so the server leaves them out rather than send markup that shows unstyled. */
const useOnClient = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false
  );

/** "6 files, 42 MB added in 30 days", or that nothing was. */
function uploaded({ files, bytes }: { files: number; bytes: number }, days: number) {
  if (files === 0) return `Nothing added in ${days} days`;
  return `${formatInteger(files)} ${files === 1 ? 'file' : 'files'}, ${formatBytes(bytes)} added in ${days} days`;
}

/**
 * The title, what the figure counts, the figure and how it changed, then the chart at the
 * foot. The same order as the dashboard's trend card; a row of cards lines up its numbers
 * at the top and its charts at the bottom.
 */
export function StatCard({ stat }: { stat: Stat }) {
  const { label, value, display, hint, trend, parts, meter, growth, link } = stat;
  const [range, setRange] = useState<Range>(30);
  const onClient = useOnClient();
  // Cards with daily counts offer 7, 30 or 90 days; the rest show their twelve weeks.
  const days = trend?.days;
  const span = days ? range : 4;
  // A card whose figure is a total over the span shows the total for the span chosen.
  const shown = days?.headline ? sum(days.counts.slice(-range)) : value;
  const delta = trend && change(days?.counts ?? trend.weeks ?? [], span);

  const figure = (
    <span className="text-3xl font-medium tracking-tight text-balance tabular-nums">
      {display ?? <RollingNumber value={shown} />}
    </span>
  );
  const figureClass = 'flex items-center justify-between gap-2';

  return (
    <Card className="gap-0">
      <div className="flex items-center justify-between gap-2 px-(--card-spacing)">
        <CardTitle data-reveal="1" className="text-sm font-medium">
          {label}
        </CardTitle>
        {(days || growth) && <RangeSelect label={label} value={range} onChange={setRange} />}
      </div>
      <div className="mt-3 space-y-1 px-(--card-spacing)">
        <p data-reveal="2" className="text-muted-foreground text-xs text-pretty">
          {hint}
        </p>
        {link ? (
          <Link
            {...link}
            data-reveal="3"
            aria-label={`${label}: ${display ?? formatInteger(shown)}. Open the list.`}
            className={cn(
              figureClass,
              'focus-visible:ring-ring/50 touch:min-h-11 -mx-1.5 rounded-md px-1.5 outline-none focus-visible:ring-[3px]'
            )}
          >
            {figure}
          </Link>
        ) : (
          <div data-reveal="3" className={figureClass}>
            {figure}
          </div>
        )}
        {delta && (
          <p
            data-reveal="5"
            className={cn(
              'text-xs tabular-nums',
              delta.diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
            )}
          >
            <RollingNumber value={delta.diff} signed /> vs previous {span} {days ? 'days' : 'weeks'}
            <span className="sr-only"> ({trend.counted})</span>
          </p>
        )}
        {growth && (
          <p data-reveal="5" className="text-muted-foreground text-xs tabular-nums">
            {uploaded(addedIn(growth, range), range)}
          </p>
        )}
      </div>
      {(trend || parts || meter) && (
        // Holds the chart's height while the chart library loads.
        <Suspense
          fallback={
            <div className="mt-auto px-(--card-spacing) pt-4">
              <div className={trend ? 'h-32' : meter ? 'h-36' : 'h-28'} />
            </div>
          }
        >
          {!onClient ? (
            <div className="mt-auto px-(--card-spacing) pt-4">
              <div className={trend ? 'h-32' : meter ? 'h-36' : 'h-28'} />
            </div>
          ) : (
            <div data-reveal="4" className="mt-auto px-(--card-spacing) pt-4">
              {trend && <TrendChart trend={trend} range={range} />}
              {parts && <PartsChart parts={parts} />}
              {meter && (
                // Compact, and without the legend (hovering the bar names each kind): the full
                // breakdown is on the System page.
                <div className="[--meter-gap:0.25rem] [--meter-item-pad:0.125rem] [--meter-legend-display:none] [--meter-legend-min:3.5rem] [--meter-text-base:0.625rem] [--meter-text-sm:0.5625rem] [--meter-text-xs:0.5625rem] [--meter-top:20px] [--meter-total-size:0.875rem] [--meter-track:8px]">
                  <UsageMeter {...meter} />
                </div>
              )}
            </div>
          )}
        </Suspense>
      )}
    </Card>
  );
}
