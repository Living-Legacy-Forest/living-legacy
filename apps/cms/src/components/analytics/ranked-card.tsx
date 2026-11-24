import { Link, type LinkProps } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPercent, percentOf } from '@/lib/analytics';
import { formatInteger } from '@/lib/format';
import { cn } from '@/lib/utils';

export type RankedRow = {
  key: string;
  label: React.ReactNode;
  value: number;
  /** Before the label: a flag, an icon. */
  leading?: React.ReactNode;
  /** Opens the page on the website, in a new tab. */
  href?: string;
  /** Under the label, quieter. */
  detail?: React.ReactNode;
};

/** The rows alone: each with a bar for its size against the biggest, its count and its share. */
export function RankedList({
  rows,
  total,
  counted,
  limit,
  emptyLabel = 'Nothing in this period.',
}: {
  rows: RankedRow[];
  total?: number;
  counted: string;
  limit?: number;
  emptyLabel?: string;
}) {
  const shown = limit ? rows.slice(0, limit) : rows;
  const whole = total ?? rows.reduce((n, r) => n + r.value, 0);
  const top = Math.max(1, ...shown.map((r) => r.value));

  return (
    <>
      {shown.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">{emptyLabel}</p>
      ) : (
        // The rows share the card's height when a card beside it is taller, up to a limit, so a short
        // list does not leave a gap under it.
        <ol className="flex flex-1 flex-col gap-1">
          {shown.map((row) => {
            const share = percentOf(row.value, whole);
            // Touch screens: the link's tap area covers the whole row, as a cell's does on iOS.
            const label = row.href ? (
              <a
                href={row.href}
                target="_blank"
                rel="noreferrer"
                className="touch:after:absolute touch:after:inset-0 truncate hover:underline"
              >
                {row.label}
              </a>
            ) : (
              <span className="truncate">{row.label}</span>
            );
            return (
              <li
                key={row.key}
                // Isolated, with the bar a layer down, so the row's text needs no positioning of
                // its own and the link's tap area (above) is measured against the row.
                className="touch:min-h-11 touch:has-[a:active]:bg-muted relative isolate flex min-h-9 flex-1 items-center gap-3 rounded-md px-2.5 py-1.5 [&:not(:only-child)]:max-h-14"
              >
                <span
                  aria-hidden
                  className="bg-primary/10 absolute inset-y-0 left-0 -z-10 rounded-md"
                  style={{ width: `${(row.value / top) * 100}%` }}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-ui flex min-w-0 items-center gap-2">
                    {row.leading}
                    {label}
                  </span>
                  {row.detail && (
                    <span className="text-muted-foreground truncate text-xs">{row.detail}</span>
                  )}
                </span>
                <span className="shrink-0 text-right text-sm tabular-nums">
                  {formatInteger(row.value)}
                  <span className="sr-only"> {counted}</span>
                  <span className="text-muted-foreground ml-2 inline-block w-11 text-xs">
                    {formatPercent(share)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

/**
 * A ranked list, biggest first, each row with a bar for its size against the biggest so the
 * order reads at a glance, and its count and share of the whole on the right.
 */
export function RankedCard({
  title,
  rows,
  total,
  counted,
  limit,
  more,
  emptyLabel = 'Nothing in this period.',
  className,
}: {
  title: string;
  rows: RankedRow[];
  /** The whole the shares are of; the rows' sum when left out. */
  total?: number;
  /** What the numbers count, for screen readers ("visits"). */
  counted: string;
  limit?: number;
  /** "View all", to the page with the full list. */
  more?: LinkProps;
  emptyLabel?: string;
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
              className="-my-1.5"
              render={<Link {...more} />}
              nativeButton={false}
            >
              View all
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <RankedList
          rows={rows}
          total={total}
          counted={counted}
          limit={limit}
          emptyLabel={emptyLabel}
        />
      </CardContent>
    </Card>
  );
}
