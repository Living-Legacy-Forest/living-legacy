import { Suspense, lazy, useEffect, useState } from 'react';
import { type Stat, StatCard } from '@/components/stat-card/stat-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartsPlaceholder } from '@/components/events/events-skeleton';
import { Spinner } from '@/components/ui/spinner';
import { formatDate, formatInteger, formatLongDate, formatTimeRange } from '@/lib/format';
import { notify } from '@/lib/notify';
import { type EventDashboard as Dashboard, getEventDashboard } from '@/server/event-stats';

const EventCharts = lazy(() => import('./event-charts').then((m) => ({ default: m.EventCharts })));

type EventDate = Dashboard['dates'][number];

const plural = (n: number, one: string, many = `${one}s`) =>
  `${formatInteger(n)} ${n === 1 ? one : many}`;

function dateStatus(date: EventDate, now: number) {
  if (date.status === 'draft') return 'Draft';
  if (date.status === 'cancelled') return 'Cancelled';
  if (date.endsAt < now) return 'Finished';
  if (date.startsAt <= now) return 'On now';
  return 'Published';
}

function buildStats({ capacity, totals, date, now }: Dashboard): Stat[] {
  const begun = totals.startedPeople > 0;
  const rate = begun ? Math.round((totals.checkedIn / totals.startedPeople) * 100) : 0;
  const average = totals.bookings > 0 ? totals.people / totals.bookings : 0;

  return [
    {
      label: 'People booked',
      value: totals.people,
      hint:
        capacity === null
          ? 'No limit set'
          : totals.people >= capacity
            ? `Full, of ${plural(capacity, 'place')}`
            : `${plural(capacity - totals.people, 'place')} left of ${formatInteger(capacity)}`,
      parts:
        capacity !== null && capacity > 0
          ? [
              {
                key: 'booked',
                label: 'Booked',
                value: Math.min(totals.people, capacity),
              },
              {
                key: 'left',
                label: 'Places left',
                value: Math.max(0, capacity - totals.people),
              },
            ]
          : undefined,
    },
    {
      label: 'Bookings',
      value: totals.bookings,
      hint:
        totals.bookings > 0
          ? `Parties of ${average.toLocaleString('en-AU', { maximumFractionDigits: 1 })} on average`
          : 'None yet',
      parts:
        totals.bookings > 0
          ? [
              { key: 'website', label: 'Website', value: totals.website },
              { key: 'staff', label: 'Staff', value: totals.staff },
            ]
          : undefined,
    },
    {
      label: 'Turn-up',
      value: rate,
      display: begun ? `${rate}%` : 'Not yet',
      hint: begun
        ? `${formatInteger(totals.checkedIn)} of ${plural(totals.startedPeople, 'person', 'people')} checked in`
        : date && date.startsAt <= now
          ? 'Nobody was booked'
          : 'Shows once a date has begun',
      parts: begun
        ? [
            { key: 'in', label: 'Checked in', value: totals.checkedIn },
            {
              key: 'out',
              label: 'Not checked in',
              value: Math.max(0, totals.startedPeople - totals.checkedIn),
            },
          ]
        : undefined,
    },
    {
      label: 'Cancelled',
      value: totals.cancelledBookings,
      hint:
        totals.cancelledBookings === 0
          ? 'No cancellations'
          : `${plural(totals.cancelledPeople, 'place')} freed, ${formatInteger(totals.lateCancellations)} in the last 48 hours`,
    },
  ];
}

/**
 * The Dashboard tab of an event's panel: one date, or all of them. The panel's
 * Viewing date picker chooses which, so it stays put across the tabs.
 */
export function EventDashboardPanel({
  eventId,
  date,
  onDateChange,
  onOpenGuests,
}: {
  eventId: string;
  /** A date's id, or undefined for all of them. */
  date: string | undefined;
  /** A chart picked a date (an id) or went back to all of them. */
  onDateChange: (date: string | undefined) => void;
  onOpenGuests: () => void;
}) {
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    let active = true;
    getEventDashboard({ data: { id: eventId, date } }).then(
      (found) => active && setData(found),
      (error) => notify.error('Could not load the dashboard', error)
    );
    return () => {
      active = false;
    };
  }, [eventId, date]);

  if (data === null) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }
  return <EventDashboard data={data} onDateChange={onDateChange} onOpenGuests={onOpenGuests} />;
}

/** One event: every date together, or one picked out. Lays out by the panel's width. */
function EventDashboard({
  data,
  onDateChange,
  onOpenGuests,
}: {
  data: Dashboard;
  onDateChange: (date: string | undefined) => void;
  onOpenGuests: () => void;
}) {
  const { date, dates, now } = data;
  const firstDate = dates[0];
  const lastDate = dates.at(-1);

  return (
    <div className="@container space-y-4">
      {/* The date picker sits above the tabs; this only adds what it does not say. */}
      {dates.length > 1
        ? !date &&
          firstDate &&
          lastDate && (
            <p className="text-muted-foreground text-sm">
              {plural(dates.length, 'date')}, {formatDate(firstDate.startsAt, data.timeZone)} to{' '}
              {formatDate(lastDate.startsAt, data.timeZone)}
            </p>
          )
        : date && (
            <p className="text-muted-foreground text-sm">
              <Badge variant="outline" className="mr-2 align-middle">
                {dateStatus(date, now)}
              </Badge>
              {formatLongDate(date.startsAt, date.timeZone)},{' '}
              {formatTimeRange(date.startsAt, date.endsAt, date.timeZone)}
            </p>
          )}

      <div className="grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-4">
        {buildStats(data).map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
        <Suspense
          fallback={
            <ChartsPlaceholder wide="@lg:col-span-2 @4xl:col-span-4" half="@lg:col-span-2" />
          }
        >
          <EventCharts data={data} onDateChange={onDateChange} />
        </Suspense>
        <GuestsCard data={data} onOpenGuests={onOpenGuests} />
      </div>
    </div>
  );
}

/** What to follow up: notes to read, returning guests and the CRM. */
function GuestsCard({ data, onOpenGuests }: { data: Dashboard; onOpenGuests: () => void }) {
  const { totals, crm } = data;
  const rows: { label: string; value: string; detail?: string }[] = [
    {
      label: 'Notes',
      value: plural(totals.withNotes, 'booking'),
      detail: totals.withNotes > 0 ? 'Accessibility or dietary needs, in Guests' : undefined,
    },
    {
      label: 'Returning',
      value: plural(totals.repeatBookings, 'booking'),
      detail: totals.repeatBookings > 0 ? 'Booked an earlier event too' : undefined,
    },
    {
      label: 'CRM',
      value:
        crm.failed > 0
          ? `${formatInteger(crm.failed)} failed`
          : crm.waiting > 0
            ? `${formatInteger(crm.waiting)} waiting`
            : totals.bookings > 0
              ? 'All synced'
              : 'Nothing to sync',
      detail: crm.lastError ?? undefined,
    },
  ];
  return (
    <Card className="@lg:col-span-2">
      <CardHeader>
        <CardTitle>Guests</CardTitle>
        <CardDescription>
          What to follow up.{' '}
          <button
            type="button"
            onClick={onOpenGuests}
            className="text-foreground underline-offset-4 hover:underline"
          >
            Open the guest list
          </button>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="divide-y text-sm">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[6rem_1fr] gap-x-4 py-2.5">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="min-w-0">
                <span className="tabular-nums">{row.value}</span>
                {row.detail && (
                  <span className="text-muted-foreground block truncate text-xs" title={row.detail}>
                    {row.detail}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
