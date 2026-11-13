import { Link } from '@tanstack/react-router';
import { Suspense, lazy, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatInteger } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CountUp } from './count-up';
import { type Period, type Stat, change } from './shared';

export { MUTED, type Part, type Stat, type Trend } from './shared';

const TrendChart = lazy(() => import('./stat-charts').then((m) => ({ default: m.TrendChart })));
const PartsChart = lazy(() => import('./stat-charts').then((m) => ({ default: m.PartsChart })));

/**
 * The title, what the figure counts, the figure and how it changed, then the chart at the
 * foot. The same order as the dashboard's trend card; a row of cards lines up its numbers
 * at the top and its charts at the bottom.
 */
const PERIODS = [
  { value: 'weeks', label: '12 weeks' },
  { value: 'months', label: '12 months' },
] satisfies { value: Period; label: string }[];

export function StatCard({ stat }: { stat: Stat }) {
  const { label, value, display, hint, trend, parts, link } = stat;
  const [chosen, setPeriod] = useState<Period>('weeks');
  // Only cards with monthly counts offer the choice.
  const period = trend?.months ? chosen : 'weeks';
  const span = period === 'months' ? 3 : 4;
  // A card whose figure is a total over the span shows the total for the span chosen.
  const shown =
    period === 'months' && trend?.months?.value !== undefined ? trend.months.value : value;
  const delta = trend && change(period === 'months' ? trend.months!.counts : trend.weeks, span);

  const figure = (
    <span className="text-3xl font-medium tracking-tight text-balance tabular-nums">
      {display ?? <CountUp value={shown} />}
    </span>
  );
  const figureClass = 'flex items-center justify-between gap-2';

  return (
    <Card className="gap-0">
      <div className="flex items-center justify-between gap-2 px-(--card-spacing)">
        <CardTitle data-reveal="1" className="text-sm font-medium">
          {label}
        </CardTitle>
        {trend?.months && (
          <Select
            items={PERIODS}
            value={period}
            onValueChange={(next) => next && setPeriod(next as Period)}
          >
            <SelectTrigger
              aria-label={`${label}: period shown`}
              size="sm"
              className="text-muted-foreground -my-1 -mr-2 h-7 gap-1 border-transparent bg-transparent text-xs shadow-none dark:bg-transparent"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {PERIODS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
            {delta.text} vs previous {span} {period}
            <span className="sr-only"> ({trend.counted})</span>
          </p>
        )}
      </div>
      {(trend || parts) && (
        // Holds the chart's height while the chart library loads.
        <Suspense
          fallback={
            <div className="mt-auto px-(--card-spacing) pt-4">
              <div className={trend ? 'h-32' : 'h-24'} />
            </div>
          }
        >
          <div data-reveal="4" className="mt-auto px-(--card-spacing) pt-4">
            {trend && <TrendChart trend={trend} period={period} />}
            {parts && <PartsChart parts={parts} />}
          </div>
        </Suspense>
      )}
    </Card>
  );
}
