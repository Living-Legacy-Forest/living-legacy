import { groupEventDates } from '@ll/content';
import { useState } from 'react';
import { CalendarClockIcon, PlusIcon } from '@/components/icons';
import {
  DialogActions,
  ListColumn,
  ListDialog,
  ListPageLayout,
  ListRows,
  NoMatches,
  PaneActions,
  PaneColumn,
  PaneEmpty,
  PaneFrame,
  useListPane,
} from '@/components/list/list-page';
import { ListRow } from '@/components/list/list-row';
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { removedNotice } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { type EventRow, type EventsData, type LocationOption, deleteEvents } from '@/server/events';
import { EventForm, type FormActions } from './event-form';
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

export function EventsPage({ data }: { data: EventsData }) {
  const view = useListPane<Target>();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const { run, pending } = useAction();

  const now = Date.now();
  // One row for each event, however many dates it repeats on. Coming up reads
  // soonest first; looking back reads latest first.
  const visible = groupEventDates(
    data.events
      .filter((e) => inFilter(e, filter, now))
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
        locations={data.locations}
        onSaved={onDone}
        actions={actions}
      />
    );
  };
  const paneEvent = pane ? editing(pane) : null;

  const newButton = (
    <Button size="sm" className="touch:min-h-11" onClick={() => view.open({ kind: 'new' })}>
      <PlusIcon aria-hidden data-icon="inline-start" />
      New event
    </Button>
  );

  return (
    <div className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:flex-none">
      <div className="flex flex-wrap items-center gap-3">
        <h1 data-slot="page-title" className="mr-auto text-xl">
          Events
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
        // The form is long, so the list stays narrow and the pane takes the rest.
        <ListPageLayout className="lg:grid-cols-[minmax(22rem,30rem)_minmax(0,1fr)]">
          <ListColumn
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
                    onOpen={() => view.open({ kind: 'edit', id: row.lead.id })}
                  >
                    <EventSummary row={row} />
                  </ListRow>
                ))}
              </ListRows>
            )}
          </ListColumn>

          <PaneColumn label="Edit event">
            {pane === null ? (
              <PaneEmpty
                title="No event selected"
                description="Choose one from the list, or create a new event."
              />
            ) : (
              <PaneFrame
                title={pane.kind === 'edit' ? (editing(pane)?.title ?? 'Event') : 'New event'}
              >
                {form(
                  pane,
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

function EventSummary({ row }: { row: ReturnType<typeof groupEventDates<EventRow>>[number] }) {
  const { lead, dates, upcoming } = row;
  const when =
    dates.length > 1
      ? `${dates.length} dates · ${upcoming ? 'Next' : 'Last'} ${startsIn(lead)}`
      : `${lead.seriesId ? 'Repeats · ' : ''}${startsIn(lead)}`;
  return (
    <>
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
          <span className="block truncate lg:inline">
            <span className="hidden lg:inline"> · </span>
            {lead.locationName}
          </span>
        )}
      </span>
    </>
  );
}

/** A saved event's details, or who is coming; a new event has details only. */
function EventPanel({
  event,
  dates,
  onPickDate,
  locations,
  onSaved,
  actions,
}: {
  event: EventRow | null;
  /** All the dates of its series, soonest first; empty if it does not repeat. */
  dates: EventRow[];
  onPickDate: (id: string) => void;
  locations: LocationOption[];
  onSaved: (id: string | null) => void;
  actions: FormActions;
}) {
  const [view, setView] = useState<'details' | 'guests'>('details');
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
      {dates.length > 1 && <SeriesDatePicker event={event} dates={dates} onPick={onPickDate} />}
      <SegmentedControl
        label="Show"
        value={view}
        onValueChange={setView}
        options={[
          { value: 'details', label: 'Details' },
          { value: 'guests', label: 'Guests' },
        ]}
      />
      <div key={view} className="animate-in fade-in duration-200 motion-reduce:animate-none">
        {view === 'details' ? details : <EventGuests key={event.id} event={event} />}
      </div>
    </div>
  );
}
