import { Link, type LinkProps } from '@tanstack/react-router';
import { DonutChart } from '@/components/arc/donut-chart/donut-chart';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Ranked } from '@/lib/analytics';
import { formatInteger } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * A few parts of one whole as a ring, with its legend: for where the share matters more than
 * the order, such as devices or channels. Long lists stay in a RankedCard.
 */
export function DonutCard({
  title,
  rows,
  unit,
  totalLabel = 'Total',
  more,
  className,
}: {
  title: string;
  rows: Ranked[];
  /** What the numbers count ("visits"). */
  unit: string;
  totalLabel?: string;
  /** "View all", to the page with the full breakdown. */
  more?: LinkProps;
  className?: string;
}) {
  return (
    <Card className={cn('gap-4', className)}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {more && (
          <CardAction>
            <Button
              size="sm"
              variant="ghost"
              className="touch:min-h-11 -my-1.5"
              render={<Link {...more} />}
              nativeButton={false}
            >
              View all
            </Button>
          </CardAction>
        )}
      </CardHeader>
      {/* The chart puts its legend beside the ring when there is room, measured by a container
          query; the figure cannot query itself, so the card body is that container. */}
      <CardContent className="@container flex flex-1 flex-col justify-center">
        <DonutChart
          label={title}
          unit={unit}
          totalLabel={totalLabel}
          formatValue={formatInteger}
          data={rows.map((r) => ({ key: r.key, label: r.label, value: r.value }))}
          size={184}
          thickness={22}
          emptyLabel="Nothing in this period"
        />
      </CardContent>
    </Card>
  );
}
