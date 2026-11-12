import { type ReactNode, Suspense, lazy } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { DashboardData } from '@/server/dashboard';
import { AppVersion } from './app-version';
import { NeedsAttention } from './needs-attention';
import { RecentPosts } from './recent-posts';
import { DashboardStats } from './stats';

// The map library is most of this page's JavaScript; the rest should not wait for it.
const LocationsCard = lazy(() =>
  import('./locations-card').then((m) => ({ default: m.LocationsCard }))
);
// The chart library likewise loads with the card that needs it.
const ScoreCard = lazy(() => import('./score-card').then((m) => ({ default: m.ScoreCard })));

/** What needs doing comes first; counts and recent work sit around it for context. */
export function Dashboard({ data }: { data: DashboardData }) {
  return (
    <div data-slot="dashboard" className="grid grid-cols-2 gap-4 max-md:gap-3 lg:grid-cols-4">
      <DashboardStats data={data} />
      <NeedsAttention attention={data.attention} />
      <LazySlot className="col-span-2">
        <Suspense fallback={<ChartPlaceholder title="Locations" chartClassName="h-72" footer />}>
          <LocationsCard locations={data.locations} />
        </Suspense>
      </LazySlot>
      {data.scores && (
        <LazySlot className="col-span-2 lg:col-span-4">
          <Suspense
            fallback={<ChartPlaceholder title="Content score" chartClassName="h-40" footer />}
          >
            <ScoreCard scores={data.scores} />
          </Suspense>
        </LazySlot>
      )}
      <RecentPosts drafts={data.recentDrafts} published={data.recentlyPublished} />
      <AppVersion />
    </div>
  );
}

/**
 * The grid cell around a card whose code loads late. It stays put while the placeholder
 * gives way to the card, so the page's reveal plays once rather than again on the swap.
 */
function LazySlot({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div data-slot="dashboard-lazy" className={cn('flex flex-col *:flex-1', className)}>
      {children}
    </div>
  );
}

/** Holds a chart card's space while its code loads, so nothing jumps. */
function ChartPlaceholder({
  title,
  chartClassName,
  footer = false,
}: {
  title: string;
  chartClassName: string;
  footer?: boolean;
}) {
  return (
    <Card aria-busy>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Skeleton className={cn('w-full', chartClassName)} />
      </CardContent>
      {footer && (
        <CardFooter>
          <Skeleton className="h-4 w-48" />
        </CardFooter>
      )}
    </Card>
  );
}
