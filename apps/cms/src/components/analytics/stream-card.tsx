import { Streamgraph } from '@/components/arc/streamgraph/streamgraph';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DailySplit } from '@/lib/analytics';
import { axisEvery, longDate, shortDate } from '@/lib/dashboard-trend';
import { formatInteger } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * How the mix of a few parts changes day by day, as a stream: for where the shape over time
 * matters more than exact figures. The biggest part runs through the middle.
 */
export function StreamCard({
  title,
  split,
  unit,
  className,
}: {
  title: string;
  split: DailySplit;
  /** What the figures count ("visits"). */
  unit: string;
  className?: string;
}) {
  const every = axisEvery(split.days.length);
  const data = split.days.map((key, i) => ({
    key,
    label: longDate(key),
    // Counted back from today, so the latest date is always labelled.
    axisLabel: (split.days.length - 1 - i) % every === 0 ? shortDate(key) : undefined,
    values: Object.fromEntries(split.layers.map((l) => [l.key, l.counts[i] ?? 0])),
  }));

  return (
    <Card className={cn('gap-4', className)}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Streamgraph
          label={title}
          unit={unit}
          data={data}
          series={split.layers.map((l) => ({ key: l.key, label: l.label }))}
          height={260}
          formatValue={formatInteger}
          categoryLabel="Day"
          emptyLabel="No visits in this period"
        />
      </CardContent>
    </Card>
  );
}
