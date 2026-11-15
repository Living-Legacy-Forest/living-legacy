import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Which Analytics page: the part of its path after /analytics/, or '' for Overview. */
export type AnalyticsSkeletonKind =
  '' | 'pages' | 'traffic' | 'audience' | 'visitors' | 'enquiries';

const kinds = new Set<string>(['', 'pages', 'traffic', 'audience', 'visitors', 'enquiries']);
export const analyticsKind = (child: string | undefined): AnalyticsSkeletonKind =>
  kinds.has(child ?? '') ? ((child ?? '') as AnalyticsSkeletonKind) : '';

/** A whole Analytics page while it loads: the heading, the period and the page's own cards. */
export function AnalyticsSkeleton({ kind }: { kind: AnalyticsSkeletonKind }) {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="w-full max-w-xl space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-8 w-56 max-md:h-9 max-md:w-full" />
      </div>
      <AnalyticsBodySkeleton kind={kind} />
    </div>
  );
}

/** The cards of one Analytics page, without its heading: also shown while a new period loads. */
export function AnalyticsBodySkeleton({ kind }: { kind: AnalyticsSkeletonKind }) {
  return (
    <div className="space-y-4 max-md:space-y-3">
      {kind === '' && (
        <>
          <Tiles count={4} />
          <ChartCard height={240} />
          <Grid className="lg:grid-cols-3">
            <RankedCard rows={6} />
            <DonutCard stacked />
            <RankedCard rows={3} />
          </Grid>
        </>
      )}
      {kind === 'pages' && <TableSkeleton columns={6} rows={10} tableFrom="lg" />}
      {kind === 'traffic' && (
        <Grid className="lg:grid-cols-2">
          <DonutCard />
          <DonutCard />
          <ChartCard height={260} className="lg:col-span-2" />
          <RankedCard rows={2} className="lg:col-span-2" />
        </Grid>
      )}
      {kind === 'audience' && (
        <Grid className="lg:grid-cols-2">
          <ChartCard height={420} className="lg:col-span-2" />
          {Array.from({ length: 2 }, (_, i) => (
            <DonutCard key={i} />
          ))}
          <ChartCard height={260} className="lg:col-span-2" />
          <DonutCard wide />
        </Grid>
      )}
      {kind === 'visitors' && <TableSkeleton columns={5} rows={10} tableFrom="md" />}
      {kind === 'enquiries' && (
        <>
          <Tiles count={2} />
          <ChartCard height={200} />
          <Grid className="lg:grid-cols-2">
            <DonutCard />
            <RankedCard rows={3} />
            <RankedCard rows={4} />
            <RankedCard rows={3} />
          </Grid>
        </>
      )}
    </div>
  );
}

function Grid({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('grid gap-4 max-md:gap-3', className)}>{children}</div>;
}

const CardTitle = () => <Skeleton className="h-4 w-24" />;

/** The figures across the top: a title, a hint, the number and how it changed. */
function Tiles({ count }: { count: number }) {
  return (
    <Grid className={count === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="gap-0">
          <CardHeader>
            <CardTitle />
          </CardHeader>
          <CardContent className="mt-3 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-32 max-w-full" />
          </CardContent>
        </Card>
      ))}
    </Grid>
  );
}

function ChartCard({ height, className }: { height: number; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="w-full rounded-lg" style={{ height }} />
      </CardContent>
    </Card>
  );
}

/** A bar list: rows of a label against a bar, a count and a share. */
function RankedCard({ rows, className }: { rows: number; className?: string }) {
  return (
    <Card className={cn('gap-4', className)}>
      <CardHeader>
        <CardTitle />
      </CardHeader>
      <CardContent className="space-y-1">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex min-h-9 items-center gap-3">
            <Skeleton className="h-7" style={{ width: `${Math.max(18, 88 - i * 16)}%` }} />
            <Skeleton className="ml-auto h-3.5 w-10 shrink-0" />
            <Skeleton className="h-3 w-8 shrink-0" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * A ring beside its legend, or above it when the card is narrow (`stacked`, or any card on a
 * phone), as the donut chart lays itself out.
 */
function DonutCard({ stacked = false, wide = false }: { stacked?: boolean; wide?: boolean }) {
  return (
    <Card className={cn('gap-4', wide && 'lg:col-span-2')}>
      <CardHeader>
        <CardTitle />
      </CardHeader>
      <CardContent
        className={cn(
          'grid items-center gap-6',
          !stacked && 'sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8'
        )}
      >
        <div className="border-muted mx-auto size-[170px] animate-pulse rounded-full border-[22px]" />
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2.5">
              <Skeleton className="size-2.5 shrink-0 rounded-full" />
              <Skeleton className="h-3.5" style={{ width: `${60 - i * 9}%` }} />
              <Skeleton className="ml-auto h-3.5 w-9 shrink-0" />
              <Skeleton className="h-3.5 w-8 shrink-0" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** A table on wider screens and a list of cards below `tableFrom`, as Pages and Visitors do. */
function TableSkeleton({
  columns,
  rows,
  tableFrom,
}: {
  columns: number;
  rows: number;
  tableFrom: 'md' | 'lg';
}) {
  return (
    <>
      <div
        className={cn(
          'overflow-hidden rounded-lg border',
          tableFrom === 'lg' ? 'max-lg:hidden' : 'max-md:hidden'
        )}
      >
        <div className="flex h-10 items-center gap-6 border-b px-4">
          <Skeleton className="h-3.5 w-16" />
          <div className="ml-auto flex gap-8">
            {Array.from({ length: columns }, (_, i) => (
              <Skeleton key={i} className="h-3.5 w-14" />
            ))}
          </div>
        </div>
        <div className="divide-y">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-6 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4" style={{ width: `${46 - ((i * 7) % 20)}%` }} />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <div className="flex gap-8">
                {Array.from({ length: columns }, (_, c) => (
                  <Skeleton key={c} className="h-3.5 w-14" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <ul
        className={cn(
          'divide-y overflow-hidden rounded-lg border max-md:divide-(--ios-separator) max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)',
          tableFrom === 'lg' ? 'lg:hidden' : 'md:hidden'
        )}
      >
        {Array.from({ length: Math.min(rows, 7) }, (_, i) => (
          <li key={i} className="space-y-2 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4" style={{ width: `${62 - ((i * 9) % 25)}%` }} />
              <Skeleton className="h-4 w-16 shrink-0" />
            </div>
            <Skeleton className="h-3 w-4/5" />
          </li>
        ))}
      </ul>
    </>
  );
}
