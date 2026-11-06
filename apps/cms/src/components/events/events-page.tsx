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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatDate } from '@/lib/format';
import { removedNotice } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { useTimeZone } from '@/lib/use-time-zone';
import { type EventRow, type EventsData, type LocationOption, deleteEvent } from '@/server/events';
import { EventForm, type FormActions } from './event-form';
import { EventGuests } from './event-guests';

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
  const selection = useSelection(data.events.map((e) => e.id));
  const { run, pending } = useAction();
  const zone = useTimeZone();

  const now = Date.now();
  // Coming up reads soonest first; looking back reads latest first.
  const visible = data.events
    .filter((e) => inFilter(e, filter, now))
    .filter((e) => matchesSearch(query, [e.title, e.locationName, e.venue]))
    .sort((a, b) => (filter === 'upcoming' ? a.startsAt - b.startsAt : b.startsAt - a.startsAt));

  const editing = (target: Target | null) =>
    target?.kind === 'edit' ? (data.events.find((e) => e.id === target.id) ?? null) : null;
  // An event removed elsewhere closes the pane.
  const pane = view.pane?.kind === 'edit' && !editing(view.pane) ? null : view.pane;

  async function remove(ids: string[]) {
    const result = await run(
      async () => {
        for (const id of ids) await deleteEvent({ data: { id, scope: 'one' } });
        return ids.length;
      },
      { success: (n) => removedNotice(n, NOUN), error: 'Could not remove' }
    );
    if (result === undefined) return;
    if (view.pane?.kind === 'edit' && ids.includes(view.pane.id)) view.closePane();
    selection.clear();
  }

  const form = (target: Target, onDone: (id: string | null) => void, actions: FormActions) => (
    <EventPanel
      key={target.kind === 'edit' ? target.id : 'new'}
      event={editing(target)}
      locations={data.locations}
      onSaved={onDone}
      actions={actions}
    />
  );

  const newButton = (
    <Button size="sm" onClick={() => view.open({ kind: 'new' })}>
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
          <SearchInput
            label="Search events"
            placeholder="Search events"
            value={query}
            onChange={setQuery}
          />
        )}
        {newButton}
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
        <ListPageLayout className="lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
          <ListColumn
            label="Events"
            header={
              <div className="space-y-2">
                <ToggleGroup
                  variant="outline"
                  size="sm"
                  value={[filter]}
                  onValueChange={(value) => value[0] && setFilter(value[0] as Filter)}
                  aria-label="Show events"
                  className="px-3 pt-2.5"
                >
                  {filters.map((f) => (
                    <ToggleGroupItem key={f.value} value={f.value} className="text-xs">
                      {f.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <SelectionBar
                  selection={selection}
                  visibleIds={visible.map((e) => e.id)}
                  title={filters.find((f) => f.value === filter)!.label}
                  total={visible.length}
                  pending={pending}
                  onDelete={() => setToDelete(selection.checkedIds)}
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
                {visible.map((e) => (
                  <ListRow
                    key={e.id}
                    current={pane?.kind === 'edit' && pane.id === e.id}
                    align="start"
                    select={{
                      label: `Select ${e.title}`,
                      checked: selection.isChecked(e.id),
                      selecting: selection.selecting,
                      onToggle: () => selection.toggle(e.id),
                    }}
                    swipe={{ label: 'Delete', onAction: () => setToDelete([e.id]) }}
                    onOpen={() => view.open({ kind: 'edit', id: e.id })}
                  >
                    <EventSummary event={e} zone={zone} />
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
        description="An open day or information session, and who is coming."
      >
        {view.dialog &&
          form(view.dialog, view.closeDialog, (submit, start) => (
            <DialogActions start={start}>{submit}</DialogActions>
          ))}
      </ListDialog>
    </div>
  );
}

function EventSummary({ event: e, zone }: { event: EventRow; zone: string }) {
  return (
    <>
      <span className="flex items-center gap-2">
        <span className="text-ui min-w-0 flex-1 truncate font-medium">{e.title}</span>
        {e.status === 'published' ? (
          <Badge variant="outline" className="shrink-0 tabular-nums">
            {e.booked} / {e.capacity ?? '∞'} booked
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0">
            {e.status === 'draft' ? 'Draft' : 'Cancelled'}
          </Badge>
        )}
      </span>
      <span className="text-muted-foreground mt-0.5 block truncate text-xs">
        {e.seriesId && 'Repeats · '}
        {formatDate(e.startsAt, zone)}
        {e.locationName ? ` · ${e.locationName}` : ''}
      </span>
    </>
  );
}

/** A saved event's details, or who is coming; a new event has details only. */
function EventPanel({
  event,
  locations,
  onSaved,
  actions,
}: {
  event: EventRow | null;
  locations: LocationOption[];
  onSaved: (id: string | null) => void;
  actions: FormActions;
}) {
  const [view, setView] = useState<'details' | 'guests'>('details');
  const details = (
    <EventForm event={event} locations={locations} onSaved={onSaved} actions={actions} />
  );
  if (!event) return details;
  return (
    <div className="space-y-5">
      <ToggleGroup
        variant="outline"
        size="sm"
        value={[view]}
        onValueChange={(value) => value[0] && setView(value[0] as typeof view)}
        aria-label="Show"
      >
        <ToggleGroupItem value="details" className="text-xs">
          Details
        </ToggleGroupItem>
        <ToggleGroupItem value="guests" className="text-xs">
          Guests
        </ToggleGroupItem>
      </ToggleGroup>
      <div key={view} className="animate-in fade-in duration-200 motion-reduce:animate-none">
        {view === 'details' ? details : <EventGuests event={event} />}
      </div>
    </div>
  );
}
