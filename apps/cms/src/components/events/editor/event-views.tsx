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
 * beside the tabs so neither moves when switching between them. The editor's
 * Details view moves it into the side panel when there is room (`showDate`).
 */
export function EventViewBar({
  view,
  onViewChange,
  event,
  dates,
  showingAll,
  onPickDate,
  showDate = true,
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
  /** False when the date is shown somewhere else. */
  showDate?: boolean;
}) {
  return (
    <>
      {/* Phones: the tabs share the full width, as a segmented control. */}
      <Tabs
        value={view}
        onValueChange={(next) => onViewChange(next as EventView)}
        // The list sits in a scroll wrapper, which has to grow too.
        className="max-md:w-full max-md:[&_[data-slot=tabs-list-shell]>*]:flex-1"
      >
        <TabsList aria-label="Show" className="max-md:w-full">
          <TabsTrigger value="details" className="max-md:flex-1!">
            Details
          </TabsTrigger>
          <TabsTrigger value="guests" className="max-md:flex-1!">
            Guests
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="max-md:flex-1!">
            Dashboard
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {showDate && dates.length > 1 && (
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
      {/* A repeating event's date picker already says where it stands; phones leave this out. */}
      <Badge variant="outline" className={props.dates.length > 1 ? 'max-md:hidden' : undefined}>
        {dateStatus(props.event)}
      </Badge>
      <EventViewBar {...props} />
    </header>
  );
}
