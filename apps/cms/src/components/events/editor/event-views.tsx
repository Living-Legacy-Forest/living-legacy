import { Link } from '@tanstack/react-router';
import { ChevronLeftIcon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { EventRow } from '@/server/events';
import { SeriesDatePicker, dateStatus } from '../series-date-picker';

/** What the page shows: the event's form, who is coming, or how it is doing. */
export type EventView = 'details' | 'guests' | 'dashboard';

/**
 * The tabs, and for a repeating event the date being viewed. The date sits
 * beside the tabs so neither moves when switching between them.
 */
export function EventViewBar({
  view,
  onViewChange,
  event,
  dates,
  showingAll,
  onPickDate,
}: {
  view: EventView;
  onViewChange: (view: EventView) => void;
  event: EventRow;
  /** Every date of its series, soonest first; empty if it does not repeat. */
  dates: EventRow[];
  /** The Dashboard is showing every date together. */
  showingAll: boolean;
  /** A date's id, or null for all dates (the Dashboard only). */
  onPickDate: (id: string | null) => void;
}) {
  return (
    <>
      <Tabs value={view} onValueChange={(next) => onViewChange(next as EventView)}>
        <TabsList aria-label="Show">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="guests">Guests</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>
      </Tabs>
      {dates.length > 1 && (
        <div className="flex min-w-0 max-sm:order-first max-sm:w-full max-sm:*:w-full">
          <SeriesDatePicker
            compact
            event={showingAll ? null : event}
            dates={dates}
            allDates={view === 'dashboard'}
            onPick={onPickDate}
          />
        </div>
      )}
    </>
  );
}

/** The bar for the views that are not the form: back, where it stands, then the tabs. */
export function EventViewsHeader(props: Parameters<typeof EventViewBar>[0]) {
  return (
    <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-1.5">
      {/* Phones have ‹ Events in the app's own top bar. */}
      <Button
        variant="ghost"
        size="sm"
        className="max-md:hidden"
        render={<Link to="/events" />}
        nativeButton={false}
      >
        <ChevronLeftIcon aria-hidden data-icon="inline-start" />
        Events
      </Button>
      <Badge variant="outline">{dateStatus(props.event)}</Badge>
      <EventViewBar {...props} />
    </header>
  );
}
