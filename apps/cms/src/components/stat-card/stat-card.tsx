import { Suspense, lazy } from 'react';
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatInteger } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type Stat, change } from './shared';

export { MUTED, type Part, type Stat, type Trend } from './shared';

const TrendChart = lazy(() => import('./stat-charts').then((m) => ({ default: m.TrendChart })));
const PartsChart = lazy(() => import('./stat-charts').then((m) => ({ default: m.PartsChart })));

/** A figure with a label, an optional chart under it and a line of context below. */
export function StatCard({ stat }: { stat: Stat }) {
  const { label, value, display, hint, trend, parts } = stat;
  const delta = trend && change(trend.weeks);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-normal">{label}</CardTitle>
        {delta && (
          <CardAction
            className="text-muted-foreground row-span-1 text-xs leading-none tabular-nums"
            title={`${delta.text} ${trend.counted} in the last 4 weeks, against the 4 before`}
          >
            <span className={cn(delta.diff > 0 && 'text-foreground')}>{delta.text}</span>
            <span className="sr-only">
              {' '}
              {trend.counted} in the last 4 weeks, against the 4 before
            </span>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight text-balance tabular-nums">
          {display ?? formatInteger(value)}
        </p>
        {(trend || parts) && (
          // Holds the chart's height while the chart library loads.
          <Suspense fallback={<div className="mt-3 h-10" />}>
            {trend && <TrendChart {...trend} />}
            {parts && <PartsChart parts={parts} />}
          </Suspense>
        )}
      </CardContent>
      <CardFooter className="mt-auto gap-1.5 text-xs">
        <span className="text-muted-foreground text-pretty">{hint}</span>
      </CardFooter>
    </Card>
  );
}
