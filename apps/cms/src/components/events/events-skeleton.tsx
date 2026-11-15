import { ChartCard, Grid, Tiles } from '@/components/analytics/analytics-skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** The events list: its toolbar over one full-width column of rows with a thumbnail each. */
export function EventsListSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:flex-none">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="mr-auto h-7 w-24" />
        <Skeleton className="order-last h-8 w-full sm:order-none sm:w-56" />
        <Skeleton className="h-8 w-20 max-md:hidden" />
        <Skeleton className="h-8 w-16 max-md:hidden" />
        <Skeleton className="h-8 w-28 max-md:hidden" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
        <div className="space-y-2 border-b px-3 pt-2.5 pb-3">
          <Skeleton className="h-8 w-full max-w-xs" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-3 py-3">
              <Skeleton className="size-14 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4" style={{ width: `${60 - ((i * 9) % 25)}%` }} />
                <Skeleton className="h-3 w-2/5" />
              </div>
              <Skeleton className="h-9 w-24 shrink-0 max-sm:hidden" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Events overview: the title and location, the stat cards beside what is coming up, then results. */
export function EventsOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-full sm:w-52" />
      </div>
      <div className="space-y-4 max-md:space-y-3">
        <Tiles count={4} />
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-36" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="ml-auto h-4 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-56 max-md:w-full" />
        </div>
        <Grid className="grid-cols-2 lg:grid-cols-4">
          <ChartCard height={256} className="col-span-2 lg:col-span-4" />
          <ChartCard height={224} className="col-span-2" />
          <ChartCard height={224} className="col-span-2" />
        </Grid>
      </section>
    </div>
  );
}

/** The event editor: a form card with its toolbar, beside the details panel from lg. */
export function EventEditorSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:gap-0">
      <div className="bg-background flex min-w-0 flex-col overflow-hidden rounded-lg border lg:mr-6 lg:h-[calc(100svh-7.5rem)] lg:flex-[7]">
        <div className="flex min-h-12 shrink-0 items-center gap-3 border-b px-3 py-1.5">
          <Skeleton className="h-6 w-40 max-md:hidden" />
          <div className="ml-auto flex items-center gap-1.5">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="size-7" />
          </div>
        </div>
        <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-6 max-md:px-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="aspect-video w-full" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className={cn('w-full', i === 2 ? 'h-24' : 'h-9')} />
            </div>
          ))}
        </div>
      </div>
      <aside className="space-y-6 lg:flex-[3] lg:border-l lg:pl-6">
        {[4, 3, 2].map((rows, s) => (
          <div key={s} className={cn('space-y-4', s > 0 && 'border-t pt-6')}>
            <Skeleton className="h-3.5 w-24" />
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        ))}
      </aside>
    </div>
  );
}

/**
 * Stand-in for the lazy charts: a wide card, then two. `wide` and `half` are the grid spans, as
 * the overview and an event's dashboard size their grids differently.
 */
export function ChartsPlaceholder({ wide, half }: { wide: string; half: string }) {
  return (
    <>
      <Card className={cn('h-80 p-4', wide)} aria-busy>
        <Skeleton className="size-full" />
      </Card>
      <Card className={cn('h-72 p-4', half)} aria-busy>
        <Skeleton className="size-full" />
      </Card>
      <Card className={cn('h-72 p-4', half)} aria-busy>
        <Skeleton className="size-full" />
      </Card>
    </>
  );
}
