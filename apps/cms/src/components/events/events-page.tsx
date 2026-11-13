import { groupEventDates } from '@ll/content';
import { useEffect, useRef, useState } from 'react';
import { CalendarClockIcon, PanelRightIcon, PlusIcon } from '@/components/icons';
import {
  DialogActions,
  ListColumn,
  ListDialog,
  ListPageLayout,
  ListRows,
  NoMatches,
  isDesktop,
  PaneActions,
  PaneColumn,
  PaneEmpty,
  PaneFrame,
  useListPane,
} from '@/components/list/list-page';
import { ListRow } from '@/components/list/list-row';
import { ListFilter } from '@/components/list/list-filter';
import { CardMeta, ListCard, ListCards } from '@/components/list/list-card';
import { ViewSwitch, useListView } from '@/components/list/view-switch';
import { RowCell } from '@/components/list/row-cell';
import { TrendChart } from '@/components/list/trend-chart';
import { dummyTrend } from '@/components/list/dummy-trend';
import { cn } from '@/lib/utils';
import { formatDate, formatTimeRange } from '@/lib/format';
import {
  ConfirmBulkDelete,
  SearchInput,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/list/list-tools';
import { PageActions } from '@/components/shell/page-actions';
import { SegmentedControl } from '@/components/segmented-control';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { removedNotice } from '@/lib/notify';
import { RevealWords } from '@/components/dashboard/reveal-words';
import { useAction } from '@/lib/use-action';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { type EventRow, type EventsData, type LocationOption, deleteEvents } from '@/server/events';
import { EventForm, type FormActions } from './event-form';
import { EventDashboardPanel } from './dashboard/event-dashboard';
import { EventGuests } from './event-guests';
import { SeriesDatePicker, dateStatus, startsIn } from './series-date-picker';

const NOUN: [string, string] = ['event', 'events'];

/** What the pane shows: a saved event, or a new one. */
type Target = { kind: 'edit'; id: string } | { kind: 'new' };

type Filter = 'upcoming' | 'drafts' | 'past' | 'all';
const filters: { value: Filter; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'drafts', label: 'Drafts' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All' },
];

function inFilter(e: EventRow, filter: Filter, now: number) {
  // Upcoming includes drafts (they say so), so a new event stays in view.
  if (filter === 'upcoming') return e.endsAt >= now;
  if (filter === 'drafts') return e.status === 'draft';
  if (filter === 'past') return e.endsAt < now;
  return true;
}

export type PanelView = 'details' | 'guests' | 'dashboard';

export function EventsPage({
  data,
  initialOpen,
  initialView,
  onOpenedInitial,
}: {
  data: EventsData;
  /** An event date to open on arrival, from ?open= in the address. */
  initialOpen?: string;
  /** Its tab to open on, from ?view=. */
  initialView?: PanelView;
  /** Clears ?open= once used, so going back does not open it again. */
  onOpenedInitial?: () => void;
}) {
  const view = useListPane<Target>();
  // Kept after the address is cleared, so the panel it opens starts on that tab.
  const [arrival] = useState({ id: initialOpen, view: initialView });
  useEffect(() => {
    if (!initialOpen) return;
    view.open({ kind: 'edit', id: initialOpen });
    onOpenedInitial?.();
    // Only on arrival with ?open=, not on every render that has it.
  }, [initialOpen]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('upcoming');
  // Ticked values per group; empty means that group does not narrow the list.
  const [picked, setPicked] = useState<Record<string, string[]>>({ places: [], statuses: [] });
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const { run, pending } = useAction();
  const revealing = useRevealOnce();

  const now = Date.now();
  // One row for each event, however many dates it repeats on. Coming up reads
  // soonest first; looking back reads latest first.
  const visible = groupEventDates(
    data.events
      .filter((e) => inFilter(e, filter, now))
      .filter((e) => !picked.places?.length || picked.places.includes(e.locationId ?? ''))
      .filter((e) => !picked.statuses?.length || picked.statuses.includes(e.status))
      .filter((e) => matchesSearch(query, [e.title, e.locationName, e.venue])),
    now
  ).sort((a, b) =>
    filter === 'upcoming' ? a.lead.startsAt - b.lead.startsAt : b.lead.startsAt - a.lead.startsAt
  );
  // Only what is shown: a row ticks the dates it stands for under this filter.
  const selection = useSelection(visible.map((row) => row.key));
  const idsOf = (rows: typeof visible) => rows.flatMap((row) => row.dates.map((d) => d.id));

  const editing = (target: Target | null) =>
    target?.kind === 'edit' ? (data.events.find((e) => e.id === target.id) ?? null) : null;
  // An event removed elsewhere closes the pane.
  const pane = view.pane?.kind === 'edit' && !editing(view.pane) ? null : view.pane;

  async function remove(ids: string[]) {
    const result = await run(async () => (await deleteEvents({ data: { ids } })).dates, {
      success: (n) => removedNotice(n, NOUN),
      error: 'Could not remove',
    });
    if (result === undefined) return;
    if (view.pane?.kind === 'edit' && ids.includes(view.pane.id)) view.closePane();
    selection.clear();
  }

  const form = (target: Target, onDone: (id: string | null) => void, actions: FormActions) => {
    const event = editing(target);
    return (
      <EventPanel
        // The dates of an event share a panel, so its open tab stays when moving between them.
        key={event ? (event.seriesId ?? event.id) : 'new'}
        event={event}
        dates={
          event?.seriesId
            ? data.events
                .filter((e) => e.seriesId === event.seriesId)
                .sort((a, b) => a.startsAt - b.startsAt)
            : []
        }
        onPickDate={(id) => view.open({ kind: 'edit', id })}
        initialView={event && event.id === arrival.id ? arrival.view : undefined}
        locations={data.locations}
        onSaved={onDone}
        actions={actions}
      />
    );
  };
  const paneEvent = pane ? editing(pane) : null;
  // Closed, the list takes the whole width and its rows show more. The pane keeps what it last
  // showed while it slides shut.
  // The toolbar button can also open the pane with nothing chosen yet.
  const [layout, setLayout] = useListView('events');
  const grid = layout === 'grid';
  const [emptyPaneOpen, setEmptyPaneOpen] = useState(false);
  useEffect(() => {
    if (pane) setEmptyPaneOpen(false);
  }, [pane]);
  const paneOpen = pane !== null || emptyPaneOpen;
  const togglePane = () => {
    view.closePane();
    setEmptyPaneOpen(!paneOpen);
  };
  const lastPane = useRef<Target | null>(null);
  if (pane) lastPane.current = pane;
  const shown = pane ?? lastPane.current;

  const newButton = (
    <Button size="sm" className="touch:min-h-11" onClick={() => view.open({ kind: 'new' })}>
      <PlusIcon aria-hidden data-icon="inline-start" />
      New event
    </Button>
  );

  return (
    <div
      data-slot="list-page"
      data-revealing={revealing || undefined}
      className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:flex-none"
    >
      <div data-slot="list-toolbar" className="flex flex-wrap items-center gap-3">
        <h1 data-slot="page-title" className="mr-auto text-xl">
          <RevealWords text="Events" />
        </h1>
        {data.events.length > 0 && (
          // Under the title and New event on phones, beside them from sm.
          <div className="order-last w-full sm:order-none sm:w-auto">
            <SearchInput
              label="Search events"
              placeholder="Search events"
              value={query}
              onChange={setQuery}
            />
          </div>
        )}
        {data.events.length > 0 && (
          <ListFilter
            groups={[
              {
                key: 'places',
                label: 'Place',
                options: data.locations.map((l) => ({ value: l.id, label: l.name })),
              },
              {
                key: 'statuses',
                label: 'Status',
                options: [
                  { value: 'published', label: 'Published' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'cancelled', label: 'Cancelled' },
                ],
              },
            ]}
            values={picked}
            onChange={(key, next) => {
              setPicked((prev) => ({ ...prev, [key]: next }));
              selection.clear();
            }}
            onClear={() => {
              setPicked({ places: [], statuses: [] });
              selection.clear();
            }}
          />
        )}
        {data.events.length > 0 && <ViewSwitch value={layout} onChange={setLayout} />}
        {data.events.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={paneOpen ? 'Expand list' : 'Show details pane'}
            aria-pressed={!paneOpen}
            title={paneOpen ? 'Expand list' : 'Show details pane'}
            className="max-lg:hidden"
            onClick={togglePane}
          >
            <PanelRightIcon aria-hidden />
          </Button>
        )}
        <div className="max-md:hidden">{newButton}</div>
        <PageActions
          edit={{
            editing: selection.selecting,
            onToggle: selection.selecting ? selection.clear : selection.startEditing,
          }}
          add={{ label: 'New event', onClick: () => view.open({ kind: 'new' }) }}
        />
      </div>

      {data.events.length === 0 && pane === null ? (
        <Empty className="flex-1 rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarClockIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No events yet</EmptyTitle>
            <EmptyDescription>
              Create an open day or information session and keep its guest list here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{newButton}</EmptyContent>
        </Empty>
      ) : (
        // Rows carry a date, its times and the place, so the list gets room for them;
        // the pane takes the rest.
        // Plain fr tracks so the columns glide between open and closed.
        <ListPageLayout
          className={cn(
            // Cards reflow into fewer columns as the list narrows, so gliding the width would
            // reshuffle them every frame. In grid view the columns snap; the pane still slides.
            !grid &&
              'motion-reduce:transition-none lg:transition-[grid-template-columns] lg:duration-300 lg:ease-[cubic-bezier(0.32,0.72,0,1)]',
            paneOpen ? 'lg:grid-cols-[2fr_3fr]' : 'lg:grid-cols-[1fr_0fr]'
          )}
        >
          <ListColumn
            className={cn(
              'min-w-96 transition-[border-color] duration-300',
              !paneOpen && 'border-transparent'
            )}
            label="Events"
            header={
              <div className="space-y-2">
                <SegmentedControl
                  label="Show events"
                  value={filter}
                  onValueChange={(next) => {
                    setFilter(next);
                    selection.clear();
                  }}
                  options={filters}
                  className="px-3 pt-2.5 max-md:mx-0 max-md:mb-3"
                />
                <SelectionBar
                  selection={selection}
                  visibleIds={visible.map((row) => row.key)}
                  title={filters.find((f) => f.value === filter)!.label}
                  total={visible.length}
                  pending={pending}
                  onDelete={() =>
                    setToDelete(idsOf(visible.filter((row) => selection.isChecked(row.key))))
                  }
                />
              </div>
            }
          >
            {visible.length === 0 ? (
              query ? (
                <NoMatches onClear={() => setQuery('')}>No events match that search.</NoMatches>
              ) : (
                <p className="text-muted-foreground px-4 py-10 text-center text-sm">
                  {filter === 'drafts'
                    ? 'No drafts.'
                    : filter === 'past'
                      ? 'No past events.'
                      : 'No upcoming events.'}
                </p>
              )
            ) : grid ? (
              <ListCards>
                {visible.map((row) => (
                  <EventCard
                    key={row.key}
                    row={row}
                    current={paneEvent !== null && (paneEvent.seriesId ?? paneEvent.id) === row.key}
                    onOpen={() =>
                      isDesktop() &&
                      paneEvent !== null &&
                      (paneEvent.seriesId ?? paneEvent.id) === row.key
                        ? view.closePane()
                        : view.open({ kind: 'edit', id: row.lead.id })
                    }
                    onDelete={() => setToDelete(idsOf([row]))}
                  />
                ))}
              </ListCards>
            ) : (
              <ListRows>
                {visible.map((row) => (
                  <ListRow
                    key={row.key}
                    current={paneEvent !== null && (paneEvent.seriesId ?? paneEvent.id) === row.key}
                    align="start"
                    select={{
                      label: `Select ${row.lead.title}`,
                      checked: selection.isChecked(row.key),
                      selecting: selection.selecting,
                      onToggle: () => selection.toggle(row.key),
                    }}
                    swipe={{ label: 'Delete', onAction: () => setToDelete(idsOf([row])) }}
                    onOpen={() =>
                      // Choosing the event already open closes the pane again.
                      isDesktop() &&
                      paneEvent !== null &&
                      (paneEvent.seriesId ?? paneEvent.id) === row.key
                        ? view.closePane()
                        : view.open({ kind: 'edit', id: row.lead.id })
                    }
                  >
                    <EventSummary row={row} wide={!paneOpen} />
                  </ListRow>
                ))}
              </ListRows>
            )}
          </ListColumn>

          <PaneColumn
            label="Edit event"
            inert={!paneOpen}
            className={cn(
              'min-w-0 overflow-hidden transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
              !paneOpen && 'translate-x-4 opacity-0'
            )}
          >
            {shown === null ? (
              <PaneEmpty
                title="No event selected"
                description="Choose one from the list, or create a new event."
              />
            ) : (
              <PaneFrame
                title={shown.kind === 'edit' ? (editing(shown)?.title ?? 'Event') : 'New event'}
                width="xl"
              >
                {form(
                  shown,
                  (id) => view.setPane(id ? { kind: 'edit', id } : null),
                  (submit, start) => (
                    <PaneActions start={start} onCancel={view.closePane}>
                      {submit}
                    </PaneActions>
                  )
                )}
              </PaneFrame>
            )}
          </PaneColumn>
        </ListPageLayout>
      )}

      <ConfirmBulkDelete
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        count={toDelete?.length ?? 0}
        noun={NOUN}
        description="Their guest lists are deleted too. This cannot be undone."
        onConfirm={() => toDelete && remove(toDelete)}
      />

      <ListDialog
        open={view.dialog !== null}
        onClose={view.closeDialog}
        title={
          view.dialog?.kind === 'edit' ? (editing(view.dialog)?.title ?? 'Event') : 'New event'
        }
        // A saved event's sheet needs the room more than the explanation.
        description={
          view.dialog?.kind === 'new' ? 'An open day or information session.' : undefined
        }
      >
        {view.dialog &&
          form(view.dialog, view.closeDialog, (submit, start) => (
            <DialogActions compact start={start}>
              {submit}
            </DialogActions>
          ))}
      </ListDialog>
    </div>
  );
}

/** The same for several dates. Capacities are per date, so only people add up. */
function rowStatus(dates: EventRow[]) {
  if (dates.length === 1) return dateStatus(dates[0]!);
  const published = dates.filter((d) => d.status === 'published');
  if (published.length > 0) return `${published.reduce((n, d) => n + d.booked, 0)} booked`;
  if (dates.some((d) => d.status === 'draft' && d.publishAt)) return 'Scheduled';
  return dates.some((d) => d.status === 'draft') ? 'Draft' : 'Cancelled';
}

/** One event as a card in the grid view: hero image, title, status, when and where. */
function EventCard({
  row,
  current,
  onOpen,
  onDelete,
}: {
  row: ReturnType<typeof groupEventDates<EventRow>>[number];
  current: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { lead, dates, upcoming } = row;
  const when =
    dates.length > 1
      ? `${dates.length} dates · ${upcoming ? 'Next' : 'Last'} ${startsIn(lead)}`
      : `${lead.seriesId ? 'Repeats · ' : ''}${startsIn(lead)}`;
  const booked = dates.reduce((n, d) => n + d.booked, 0);
  const capacity = dates.reduce((n, d) => n + (d.capacity ?? 0), 0);
  return (
    <ListCard
      title={lead.title}
      image={lead.heroMediaId ? `/api/media/${lead.heroMediaId}?w=640` : null}
      icon={<CalendarClockIcon aria-hidden />}
      current={current}
      onOpen={onOpen}
      remove={{ label: 'Delete', onAction: onDelete }}
    >
      <span className="flex min-w-0 items-center gap-2 text-xs">
        <Badge variant="outline" className="shrink-0 tabular-nums">
          {rowStatus(dates)}
        </Badge>
        <span className="text-muted-foreground truncate">{when}</span>
      </span>
      {lead.locationName && <CardMeta>{lead.locationName}</CardMeta>}
      <CardMeta>
        <span className="tabular-nums">
          {capacity > 0 ? `${booked} of ${capacity} booked` : `${booked} booked`}
        </span>
      </CardMeta>
      <TrendChart series={dummyTrend(lead.id)} label="Bookings" className="mt-1 h-10 w-full" />
    </ListCard>
  );
}

function EventSummary({
  row,
  wide,
}: {
  row: ReturnType<typeof groupEventDates<EventRow>>[number];
  /** The pane is closed, so there is room for the columns it would have covered. */
  wide: boolean;
}) {
  const { lead, dates, upcoming } = row;
  const when =
    dates.length > 1
      ? `${dates.length} dates · ${upcoming ? 'Next' : 'Last'} ${startsIn(lead)}`
      : `${lead.seriesId ? 'Repeats · ' : ''}${startsIn(lead)}`;
  const booked = dates.reduce((n, d) => n + d.booked, 0);
  const capacity = dates.reduce((n, d) => n + (d.capacity ?? 0), 0);
  return (
    <span className="flex items-center gap-4">
      <span className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-md">
        {lead.heroMediaId ? (
          <img
            src={`/api/media/${lead.heroMediaId}?w=320`}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <span className="text-muted-foreground/60 flex size-full items-center justify-center">
            <CalendarClockIcon aria-hidden className="size-5" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-ui min-w-0 flex-1 truncate font-medium">{lead.title}</span>
          <Badge variant="outline" className="shrink-0 tabular-nums">
            {rowStatus(dates)}
          </Badge>
        </span>
        <span className="text-muted-foreground mt-0.5 block truncate text-xs">
          {when}
          {/* On its own line on phones, where it would otherwise be cut off. */}
          {lead.locationName && (
            <span className={cn('block truncate lg:inline', wide && 'lg:hidden')}>
              <span className="hidden lg:inline"> · </span>
              {lead.locationName}
            </span>
          )}
        </span>
      </span>
      <span className={cn('flex shrink-0 max-sm:hidden', wide && 'lg:max-xl:hidden')}>
        <TrendChart series={dummyTrend(lead.id)} label="Bookings" showTotal={wide} />
      </span>
      {wide && (
        <span className="animate-in fade-in slide-in-from-right-2 hidden shrink-0 items-center gap-6 text-xs duration-300 lg:flex">
          <RowCell className="w-40" primary={lead.locationName ?? ''} secondary={lead.venue} />
          <RowCell
            className="w-36"
            primary={formatDate(lead.startsAt, lead.timeZone)}
            secondary={formatTimeRange(lead.startsAt, lead.endsAt, lead.timeZone)}
          />
          <RowCell
            className="hidden w-28 xl:block"
            primary={capacity > 0 ? `${booked} of ${capacity}` : `${booked} booked`}
            secondary={dates.length > 1 ? `${dates.length} dates` : 'Booked'}
          />
        </span>
      )}
    </span>
  );
}

/** A saved event's details, or who is coming; a new event has details only. */
function EventPanel({
  event,
  dates,
  onPickDate,
  initialView = 'details',
  locations,
  onSaved,
  actions,
}: {
  event: EventRow | null;
  /** All the dates of its series, soonest first; empty if it does not repeat. */
  dates: EventRow[];
  onPickDate: (id: string) => void;
  initialView?: PanelView;
  locations: LocationOption[];
  onSaved: (id: string | null) => void;
  actions: FormActions;
}) {
  const [view, setView] = useState<PanelView>(initialView);
  // The Dashboard tab can also show every date together; the others show one.
  const [allDates, setAllDates] = useState(false);
  const showingAll = view === 'dashboard' && allDates && dates.length > 1;
  const details = (
    <EventForm
      key={event?.id ?? 'new'}
      event={event}
      locations={locations}
      onSaved={onSaved}
      actions={actions}
    />
  );
  if (!event) return details;
  return (
    <div className="space-y-5">
      {/* One row: the tabs, and the date (or a single date's status) beside them, so
          neither moves when switching tabs. On phones the date sits above the tabs. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Tabs value={view} onValueChange={(next) => setView(next as PanelView)}>
          <TabsList aria-label="Show">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="guests">Guests</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex min-w-0 justify-end max-sm:order-first max-sm:w-full max-sm:*:w-full sm:ml-auto">
          {dates.length > 1 ? (
            <SeriesDatePicker
              compact
              event={showingAll ? null : event}
              dates={dates}
              allDates={view === 'dashboard'}
              onPick={(id) => {
                setAllDates(id === null);
                if (id) onPickDate(id);
              }}
            />
          ) : (
            <Badge variant="outline">{dateStatus(event)}</Badge>
          )}
        </div>
      </div>
      <div key={view} className="animate-in fade-in duration-200 motion-reduce:animate-none">
        {view === 'details' ? (
          details
        ) : view === 'guests' ? (
          <EventGuests key={event.id} event={event} />
        ) : (
          <EventDashboardPanel
            eventId={event.id}
            date={showingAll ? undefined : event.id}
            onDateChange={(id) => {
              setAllDates(id === undefined);
              if (id) onPickDate(id);
            }}
            onOpenGuests={() => setView('guests')}
          />
        )}
      </div>
    </div>
  );
}
