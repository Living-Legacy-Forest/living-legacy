import { Suspense, lazy } from 'react';
import { SegmentedControl } from '@/components/segmented-control';
import { type Stat, StatCard } from '@/components/stat-card/stat-card';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatInteger } from '@/lib/format';
import type { EventsOverview as Overview, OverviewRange } from '@/server/event-stats';
import { UpcomingEvents } from './upcoming-events';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { RevealWords } from '@/components/dashboard/reveal-words';

const ResultsCharts = lazy(() =>
  import('./results-charts').then((m) => ({ default: m.ResultsCharts }))
);

const ALL_LOCATIONS = 'all';

const rangeOptions: { value: OverviewRange; label: string }[] = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '12m', label: '12 months' },
];

function buildStats({ upcoming, weeklyBookings }: Overview): Stat[] {
  const booked = upcoming.reduce((n, e) => n + e.booked, 0);
  const limited = upcoming.filter((e) => e.capacity !== null);
  const places = limited.reduce((n, e) => n + (e.capacity ?? 0), 0);
  const bookedLimited = limited.reduce((n, e) => n + Math.min(e.booked, e.capacity ?? 0), 0);
  const full = limited.filter((e) => e.booked >= (e.capacity ?? 0)).length;
  const fill = places > 0 ? Math.round((bookedLimited / places) * 100) : null;
  const thisWeek = weeklyBookings.at(-1) ?? 0;
  const lastFour = weeklyBookings.slice(-4).reduce((n, w) => n + w, 0);

  return [
    {
      label: 'Upcoming events',
      value: upcoming.length,
      hint: 'In the next 30 days',
    },
    {
      label: 'People booked',
      value: booked,
      hint: places > 0 ? `Of ${formatInteger(places)} places` : 'No limits set',
      parts:
        places > 0
          ? [
              { key: 'booked', label: 'Booked', value: bookedLimited },
              { key: 'open', label: 'Places left', value: places - bookedLimited },
            ]
          : undefined,
    },
    {
      label: 'Average fill',
      value: fill ?? 0,
      display: fill === null ? 'Not set' : `${fill}%`,
      hint:
        fill === null
          ? 'No upcoming event has a limit'
          : full > 0
            ? `${formatInteger(full)} ${full === 1 ? 'event is' : 'events are'} full`
            : 'None full yet',
    },
    {
      label: 'Booked this week',
      value: thisWeek,
      hint: `${formatInteger(lastFour)} people in the last 4 weeks`,
      trend: { kind: 'bar', weeks: weeklyBookings, counted: 'people booked' },
    },
  ];
}

/** What's coming up and how full it is, then how bookings and turn-up went. */
export function EventsOverview({
  data,
  now,
  onRangeChange,
  onLocationChange,
}: {
  data: Overview;
  now: number;
  onRangeChange: (range: OverviewRange) => void;
  onLocationChange: (location: string | undefined) => void;
}) {
  const locationItems = [
    { value: ALL_LOCATIONS, label: 'All locations' },
    ...data.locations.map((l) => ({ value: l.id, label: l.name })),
  ];

  const revealing = useRevealOnce();

  return (
    <div data-slot="stack-page" data-revealing={revealing || undefined} className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 data-slot="page-title" className="text-2xl">
          <RevealWords text="Events overview" />
        </h1>
        {data.locations.length > 1 && (
          <Select
            items={locationItems}
            value={data.location ?? ALL_LOCATIONS}
            onValueChange={(value) =>
              onLocationChange(value && value !== ALL_LOCATIONS ? value : undefined)
            }
          >
            <SelectTrigger aria-label="Location" className="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locationItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 max-md:gap-3 lg:grid-cols-4">
        {buildStats(data).map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
        <UpcomingEvents events={data.upcoming} now={now} />
      </div>

      <section aria-labelledby="results" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="results" className="text-lg font-medium">
            Results
          </h2>
          <SegmentedControl
            label="Period"
            value={data.range}
            onValueChange={onRangeChange}
            options={rangeOptions}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 max-md:gap-3 lg:grid-cols-4">
          <Suspense fallback={<ResultsPlaceholder />}>
            <ResultsCharts data={data} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}

function ResultsPlaceholder() {
  return (
    <>
      <Card className="col-span-2 h-80 p-4 lg:col-span-4" aria-busy>
        <Skeleton className="size-full" />
      </Card>
      <Card className="col-span-2 h-72 p-4" aria-busy>
        <Skeleton className="size-full" />
      </Card>
      <Card className="col-span-2 h-72 p-4" aria-busy>
        <Skeleton className="size-full" />
      </Card>
    </>
  );
}
