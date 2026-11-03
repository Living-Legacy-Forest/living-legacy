import { Suspense, lazy } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { SessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';
import type { DashboardData } from '@/server/dashboard';
import { AppVersion } from './app-version';
import { QuickActions } from './quick-actions';
import { RecentPosts } from './recent-posts';
import { DashboardStats } from './stats';

// The chart library is most of this page's JavaScript; the rest of the
// dashboard should not wait for it.
const PublishingChart = lazy(() =>
  import('./publishing-chart').then((m) => ({ default: m.PublishingChart }))
);
const CategoryChart = lazy(() =>
  import('./category-chart').then((m) => ({ default: m.CategoryChart }))
);

export function Dashboard({ data, user }: { data: DashboardData; user: SessionUser }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <DashboardStats data={data} />
      <Suspense
        fallback={
          <ChartPlaceholder
            title="Publishing activity"
            className="col-span-2 lg:col-span-4"
            chartClassName="h-60"
            footer
          />
        }
      >
        <PublishingChart activity={data.activity} />
      </Suspense>
      <Suspense
        fallback={
          <ChartPlaceholder
            title="Posts by category"
            className="col-span-2"
            chartClassName="h-72"
          />
        }
      >
        <CategoryChart categories={data.categories} />
      </Suspense>
      <RecentPosts drafts={data.recentDrafts} published={data.recentlyPublished} />
      <QuickActions user={user} />
      <AppVersion />
    </div>
  );
}

/** Holds a chart card's space while its code loads, so nothing jumps. */
function ChartPlaceholder({
  title,
  className,
  chartClassName,
  footer = false,
}: {
  title: string;
  className: string;
  chartClassName: string;
  footer?: boolean;
}) {
  return (
    <Card className={className} aria-busy>
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
