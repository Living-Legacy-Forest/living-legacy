import { Suspense, lazy, useState } from 'react';
import { Flag } from '@/components/flag';
import { SegmentedControl } from '@/components/segmented-control';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { AudiencePage } from '@/server/analytics';
import { RankedList, type RankedRow } from './ranked-card';

// The map library loads with the map, after the rest of the page is on screen.
const PlacesMap = lazy(() => import('./places-map').then((m) => ({ default: m.PlacesMap })));

const VIEWS = [
  { value: 'countries', label: 'Countries' },
  { value: 'cities', label: 'Cities' },
] as const;
type View = (typeof VIEWS)[number]['value'];

/**
 * Where visitors are: a map of bubbles, one for each busy city, beside the countries or cities
 * ranked. The map shows the cities whichever list is chosen.
 */
export function PlacesCard({ data, className }: { data: AudiencePage; className?: string }) {
  const [view, setView] = useState<View>('countries');
  const rows: RankedRow[] = (view === 'countries' ? data.countries : data.cities).map((r) => ({
    key: r.key,
    label: r.label,
    value: r.value,
    leading: <Flag code={r.code} />,
  }));

  return (
    <Card className={cn('gap-4', className)}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Where visitors are</CardTitle>
        <CardAction>
          <SegmentedControl
            label="List"
            value={view}
            options={[...VIEWS]}
            onValueChange={setView}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="bg-muted/40 relative h-64 overflow-hidden rounded-lg border sm:h-80 lg:h-[26rem]">
          {data.places.length === 0 ? (
            <p className="text-muted-foreground absolute inset-0 grid place-items-center text-sm">
              No cities to show in this period
            </p>
          ) : (
            <Suspense fallback={<Skeleton className="size-full rounded-none" />}>
              <PlacesMap places={data.places} />
            </Suspense>
          )}
        </div>
        <div className="flex flex-col">
          <RankedList
            rows={rows}
            total={data.visits}
            counted="visits"
            limit={10}
            emptyLabel="No visits with a known place."
          />
        </div>
      </CardContent>
    </Card>
  );
}
