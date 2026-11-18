import {
  type AustralianState,
  type LocationStage,
  australianStateLabels,
  locationStageLabels,
} from '@ll/content';
import { useNavigate } from '@tanstack/react-router';
import { useIsDesktop } from '@/components/editor-page/use-is-desktop';
import { useState } from 'react';
import { CardMeta, ListCard, ListCards } from '@/components/list/list-card';
import { ListFilter, passes, publishStatusOptions } from '@/components/list/list-filter';
import { ListSort, byText, sortedBy, useListSort } from '@/components/list/list-sort';
import { ViewSwitch, useListView } from '@/components/list/view-switch';
import {
  ListColumn,
  ListPageLayout,
  ListRows,
  NoMatches,
  isDesktop,
} from '@/components/list/list-page';
import {
  ListRow,
  type RowMenuItem,
  copyMenuItem,
  editMenuItems,
  publishMenuItem,
} from '@/components/list/list-row';
import {
  ConfirmBulkDelete,
  SearchInput,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/list/list-tools';
import {
  ExternalLink,
  List as ListIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
} from '@/components/icons';
import { LocationsOverviewMap } from '@/components/locations/location-map';
import { pinOf } from '@/components/locations/editor/location-values';
import { DeleteLocation } from '@/components/locations/delete-location';
import { PageActions } from '@/components/shell/page-actions';
import { useMediaItem } from '@/components/media/image-field';
import { cn } from '@/lib/utils';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { removedNotice, statusNotice } from '@/lib/notify';
import { openInNewTab, siteUrl } from '@/lib/site';
import { RevealWords } from '@/components/dashboard/reveal-words';
import { useAction } from '@/lib/use-action';
import { useRevealOnce } from '@/lib/use-reveal-once';
import {
  type LocationItem,
  type LocationsData,
  deleteLocations,
  setLocationStatus,
} from '@/server/locations';

type Search = { selected?: string };

const NOUN: [string, string] = ['location', 'locations'];

const stateItems = (Object.keys(australianStateLabels) as AustralianState[]).map((value) => ({
  value,
  label: australianStateLabels[value],
}));

const stageItems = (Object.keys(locationStageLabels) as LocationStage[]).map((value) => ({
  value,
  label: locationStageLabels[value],
}));

const SORTS = [
  { value: 'order', label: 'Your order' },
  { value: 'name-az', label: 'Name, A to Z' },
  { value: 'name-za', label: 'Name, Z to A' },
  { value: 'state-az', label: 'State, A to Z' },
] as const;

export function LocationsPage({
  data,
  search,
  canWrite,
}: {
  data: LocationsData;
  search: Search;
  canWrite: boolean;
}) {
  const navigate = useNavigate({ from: '/locations/' });
  const { run, pending } = useAction();
  const revealing = useRevealOnce();
  // The add and edit pages; `navigate` above is for ?selected= on this list.
  const go = useNavigate();
  const openEdit = (id: string) =>
    void go({ to: '/locations/$locationId', params: { locationId: id } });
  const openNew = () => void go({ to: '/locations/new' });
  const [query, setQuery] = useState('');
  // Ticked values per filter group; an empty group does not narrow the list.
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [layout, setLayout] = useListView('locations');
  const grid = layout === 'grid';
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  // From lg the page is the map, and the list opens beside it from the toolbar; smaller
  // screens have no map, so they keep the list.
  const [listOpen, setListOpen] = useState(false);
  const bleed = data.length > 0;
  const desktop = useIsDesktop();
  const selection = useSelection(data.map((l) => l.id));
  const [sort, setSort] = useListSort(SORTS);
  const ordered = sortedBy(data, sort, {
    'name-az': (a, b) => byText(a.name, b.name),
    'name-za': (a, b) => byText(b.name, a.name),
    'state-az': (a, b) => byText(a.state, b.state) || byText(a.name, b.name),
  });
  const visible = ordered.filter(
    (l) =>
      passes(picked.statuses, l.status) &&
      passes(picked.states, l.state) &&
      passes(picked.stages, l.stage) &&
      matchesSearch(query, [l.name, l.region, australianStateLabels[l.state], l.address])
  );
  const clearFilters = () => {
    setPicked({});
    selection.clear();
  };

  const locationMenu = (l: LocationItem): RowMenuItem[] => [
    ...editMenuItems(canWrite, () => openEdit(l.id)),
    ...(l.latitude !== null && l.longitude !== null
      ? [
          {
            label: 'Open in Maps',
            icon: <MapPinIcon aria-hidden />,
            onSelect: () =>
              openInNewTab(
                `https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}`
              ),
            shortcut: { key: 'm' },
          },
        ]
      : []),
    ...(l.address ? [copyMenuItem('Address', l.address)] : []),
    ...(l.status === 'published'
      ? [
          {
            label: 'View on website',
            icon: <ExternalLink aria-hidden />,
            onSelect: () => openInNewTab(siteUrl(`/locations/${l.slug}/`)),
            shortcut: { key: 'v' },
          },
        ]
      : []),
    ...(canWrite
      ? [
          publishMenuItem(l.status === 'published', (status) =>
            run(() => setLocationStatus({ data: { id: l.id, status } }), {
              success: statusNotice(status),
              error: 'Could not change it',
            })
          ),
        ]
      : []),
  ];

  // The right-hand side maps every location; selecting one, from the list or its
  // pin, opens its details in a sheet.
  const selectedId = data.find((l) => l.id === search.selected)?.id ?? null;
  const selected = data.find((l) => l.id === selectedId) ?? null;
  // Open on arrival when a location is already chosen, e.g. from the dashboard map.
  const [sheetOpen, setSheetOpen] = useState(search.selected !== undefined);
  const select = (id: string) => {
    navigate({ search: (prev) => ({ ...prev, selected: id }), replace: true });
    setSheetOpen(true);
  };
  const remove = (id: string) =>
    run(() => deleteLocations({ data: { ids: [id] } }), {
      success: removedNotice(1, NOUN),
      error: 'Could not remove the location',
    });

  async function removeMany(ids: string[]) {
    const result = await run(() => deleteLocations({ data: { ids } }), {
      success: removedNotice(ids.length, NOUN),
      error: 'Could not remove',
    });
    if (!result) return;
    selection.clear();
  }

  const addButton = (
    <Button size="sm" className="touch:min-h-11" onClick={openNew}>
      <PlusIcon aria-hidden data-icon="inline-start" />
      Add location
    </Button>
  );

  return (
    <div
      data-slot="list-page"
      data-revealing={revealing || undefined}
      className={cn(
        'flex flex-col gap-4 lg:h-[calc(100svh-7.5rem)]',
        // From lg the map fills the whole page area, past the page's padding, with the
        // toolbar floating over it and the list sliding in over its left side.
        bleed && 'lg:relative lg:-m-6 lg:h-[calc(100svh-4.5rem)] lg:gap-0'
      )}
    >
      <div
        data-slot="list-toolbar"
        className={cn(
          'flex flex-wrap items-center gap-3',
          bleed &&
            'lg:bg-background/90 lg:absolute lg:inset-x-3 lg:top-3 lg:z-10 lg:rounded-xl lg:border lg:px-3 lg:py-2 lg:shadow-sm lg:backdrop-blur'
        )}
      >
        <h1 data-slot="page-title" className="mr-auto text-xl">
          <RevealWords text="Locations" />
        </h1>
        {data.length > 0 && (
          // Under the title and Add location on phones, beside them from sm.
          <div className="order-last w-full sm:order-none sm:w-auto">
            <SearchInput
              label="Search locations"
              placeholder="Search locations"
              value={query}
              onChange={setQuery}
            />
          </div>
        )}
        {data.length > 0 && <ListSort options={SORTS} value={sort} onChange={setSort} />}
        {data.length > 0 && (
          <ListFilter
            groups={[
              { key: 'statuses', label: 'Status', options: publishStatusOptions },
              // Only the states and stages some location is in.
              {
                key: 'states',
                label: 'State',
                options: stateItems.filter((s) => data.some((l) => l.state === s.value)),
              },
              {
                key: 'stages',
                label: 'Stage',
                options: stageItems.filter((s) => data.some((l) => l.stage === s.value)),
              },
            ]}
            values={picked}
            onChange={(key, next) => {
              setPicked((prev) => ({ ...prev, [key]: next }));
              selection.clear();
            }}
            onClear={clearFilters}
          />
        )}
        {data.length > 0 && (
          // Only means something while the list is open. Its width glides to nothing, on
          // the same curve as the list, so the toolbar does not jump when it goes.
          <div
            inert={!listOpen && desktop}
            className={cn(
              'grid motion-reduce:transition-none lg:transition-[grid-template-columns,opacity,translate,margin] lg:duration-300 lg:ease-[cubic-bezier(0.32,0.72,0,1)]',
              !listOpen && 'lg:-ml-3 lg:-translate-x-2 lg:grid-cols-[0fr] lg:opacity-0',
              listOpen && 'lg:grid-cols-[1fr]'
            )}
          >
            <div className="min-w-0 overflow-hidden">
              <ViewSwitch
                value={layout}
                onChange={(next) => {
                  setLayout(next);
                  selection.clear();
                }}
              />
            </div>
          </div>
        )}
        {data.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={listOpen ? 'Hide the list' : 'Show the list'}
            aria-pressed={listOpen}
            title={listOpen ? 'Hide the list' : 'Show the list'}
            className="max-lg:hidden"
            onClick={() => setListOpen((open) => !open)}
          >
            <ListIcon aria-hidden />
          </Button>
        )}
        {canWrite && <div className="max-md:hidden">{addButton}</div>}
        {canWrite && (
          <PageActions
            edit={
              grid
                ? undefined
                : {
                    editing: selection.selecting,
                    onToggle: selection.selecting ? selection.clear : selection.startEditing,
                  }
            }
            add={{ label: 'Add location', onClick: openNew }}
          />
        )}
      </div>

      {data.length === 0 ? (
        <Empty className="flex-1 rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MapPinIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No locations yet</EmptyTitle>
            <EmptyDescription>
              Add a location and it joins the location directory on the website.
            </EmptyDescription>
          </EmptyHeader>
          {canWrite && <EmptyContent>{addButton}</EmptyContent>}
        </Empty>
      ) : (
        <ListPageLayout className="lg:relative lg:block lg:rounded-none lg:border-0">
          <ListColumn
            // Out of reach while slid away; on smaller screens the list is the page.
            inert={!listOpen && desktop}
            className={cn(
              // From lg a panel over the left of the map; below it the list is the page.
              'lg:bg-background lg:absolute lg:top-[4.75rem] lg:bottom-3 lg:left-3 lg:z-10 lg:w-96 lg:max-w-[calc(100%-1.5rem)] lg:overflow-hidden lg:rounded-xl lg:border lg:shadow-lg',
              'transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
              !listOpen && 'lg:pointer-events-none lg:-translate-x-4 lg:opacity-0'
            )}
            label="Locations"
            header={
              <SelectionBar
                selection={selection}
                visibleIds={visible.map((l) => l.id)}
                title="All"
                total={data.length}
                pending={pending}
                onDelete={canWrite ? () => setToDelete(selection.checkedIds) : undefined}
              />
            }
          >
            {visible.length === 0 ? (
              <NoMatches
                onClear={() => {
                  setQuery('');
                  clearFilters();
                }}
              >
                Nothing matches that search.
              </NoMatches>
            ) : grid ? (
              <ListCards>
                {visible.map((l) => (
                  <ListCard
                    key={l.id}
                    title={l.name}
                    image={l.heroMediaId ? `/api/media/${l.heroMediaId}?w=640` : null}
                    icon={<MapPinIcon aria-hidden />}
                    current={l.id === selectedId}
                    previews={isDesktop()}
                    menu={locationMenu(l)}
                    remove={
                      canWrite
                        ? { label: 'Delete', onAction: () => setToDelete([l.id]) }
                        : undefined
                    }
                    onOpen={() => (isDesktop() ? select(l.id) : canWrite && openEdit(l.id))}
                  >
                    {l.status === 'draft' && (
                      <Badge variant="outline" className="w-fit">
                        Draft
                      </Badge>
                    )}
                    <CardMeta>
                      {australianStateLabels[l.state]} · {locationStageLabels[l.stage]}
                    </CardMeta>
                    {l.region && <CardMeta>{l.region}</CardMeta>}
                  </ListCard>
                ))}
              </ListCards>
            ) : (
              <ListRows inset="media">
                {visible.map((l) => (
                  <ListRow
                    key={l.id}
                    current={l.id === selectedId}
                    select={
                      canWrite
                        ? {
                            label: `Select ${l.name}`,
                            checked: selection.isChecked(l.id),
                            selecting: selection.selecting,
                            onToggle: () => selection.toggle(l.id),
                          }
                        : undefined
                    }
                    swipe={
                      canWrite
                        ? { label: 'Delete', onAction: () => setToDelete([l.id]) }
                        : undefined
                    }
                    previews={isDesktop()}
                    menu={locationMenu(l)}
                    // Large screens preview on a click and edit on a double click; smaller
                    // ones have no preview, so a tap edits.
                    onOpen={() => (isDesktop() ? select(l.id) : canWrite && openEdit(l.id))}
                    onDoubleClick={() => canWrite && openEdit(l.id)}
                  >
                    <LocationSummary item={l} />
                  </ListRow>
                ))}
              </ListRows>
            )}
          </ListColumn>

          <section
            aria-label="Map"
            className="relative hidden min-h-0 min-w-0 overflow-hidden lg:absolute lg:inset-0 lg:flex"
          >
            <LocationsOverviewMap
              // What the search and filters leave, so the map and the list agree.
              locations={visible.map((l) => ({
                id: l.id,
                name: l.name,
                pin: pinOf(l),
                photoUrl: l.heroMediaId ? `/api/media/${l.heroMediaId}?w=640` : null,
              }))}
              selectedId={selectedId}
              onSelect={select}
            />
          </section>
        </ListPageLayout>
      )}

      <LocationSheet
        item={selected}
        open={sheetOpen && selected !== null}
        onOpenChange={setSheetOpen}
        canWrite={canWrite}
        pending={pending}
        onEdit={(l) => {
          setSheetOpen(false);
          openEdit(l.id);
        }}
        onDelete={(id) => {
          setSheetOpen(false);
          remove(id);
        }}
      />

      <ConfirmBulkDelete
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        count={toDelete?.length ?? 0}
        noun={NOUN}
        description="They are removed from the location directory. This cannot be undone."
        onConfirm={() => toDelete && removeMany(toDelete)}
      />
    </div>
  );
}

function LocationSummary({ item }: { item: LocationItem }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      {/* Locations without a hero photo keep the space, so the names line up. */}
      <span className="bg-muted text-muted-foreground flex h-10 w-15 shrink-0 items-center justify-center overflow-hidden rounded-md border">
        {item.heroMediaId ? (
          <img
            src={`/api/media/${item.heroMediaId}?w=640`}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <MapPinIcon aria-hidden className="size-4" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-ui min-w-0 flex-1 truncate font-medium">{item.name}</span>
          {item.status === 'draft' && (
            <span className="text-muted-foreground shrink-0 text-xs">Draft</span>
          )}
        </span>
        <span className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
          {australianStateLabels[item.state]} · {locationStageLabels[item.stage]}
        </span>
      </span>
    </span>
  );
}

/** A location's details, opened from its row or its pin on the map. */
function LocationSheet({
  item,
  open,
  onOpenChange,
  canWrite,
  pending,
  onEdit,
  onDelete,
}: {
  item: LocationItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
  pending: boolean;
  onEdit: (l: LocationItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    // Not modal, and with no backdrop, so the map stays in view and its other
    // pins stay clickable while the sheet is open.
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent showOverlay={false} initialFocus={false} className="gap-0 sm:max-w-md">
        {item && (
          <>
            <SheetHeader className="gap-2 border-b pr-12">
              <div className="flex items-center gap-1.5">
                <Badge
                  variant={item.status === 'published' ? 'secondary' : 'outline'}
                  className="capitalize"
                >
                  {item.status}
                </Badge>
                <Badge variant="outline">{locationStageLabels[item.stage]}</Badge>
              </div>
              <SheetTitle className="text-lg">{item.name}</SheetTitle>
              <SheetDescription>
                {[australianStateLabels[item.state], item.region].filter(Boolean).join(' · ')}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <LocationCard item={item} />
            </div>
            <SheetFooter className="flex-row items-center border-t">
              {item.stage === 'external' && item.externalUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  render={<a href={item.externalUrl} target="_blank" rel="noopener noreferrer" />}
                  nativeButton={false}
                >
                  <ExternalLink aria-hidden data-icon="inline-start" />
                  Its website
                </Button>
              )}
              {canWrite && (
                <div className="ml-auto flex items-center gap-1.5">
                  <DeleteLocation
                    item={item}
                    disabled={pending}
                    onConfirm={() => onDelete(item.id)}
                  />
                  <Button size="sm" onClick={() => onEdit(item)}>
                    <PencilIcon aria-hidden data-icon="inline-start" />
                    Edit
                  </Button>
                </div>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** The details the directory and the location's page draw on. */
function LocationCard({ item }: { item: LocationItem }) {
  const { item: image } = useMediaItem(item.heroMediaId);
  const details = [
    ['Address', item.address],
    ['Hours', item.hours],
    ['Phone', item.phone],
    ['Email', item.email],
  ].filter((d): d is [string, string] => Boolean(d[1]));

  return (
    <article>
      <div className="bg-muted mb-4 aspect-[3/2] overflow-hidden rounded-xl border">
        {image ? (
          <img src={image.url} alt={image.alt} className="size-full object-cover" />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center p-4 text-center text-xs">
            No hero photo yet
          </div>
        )}
      </div>
      {item.intro && <p className="text-muted-foreground text-sm">{item.intro}</p>}
      {item.stage === 'live' && (
        <p className="text-muted-foreground mt-3 font-mono text-xs">/locations/{item.slug}/</p>
      )}
      {details.length > 0 && (
        <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
          {details.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[4.5rem_1fr] gap-2">
              <dt className="text-muted-foreground text-xs leading-5">{label}</dt>
              <dd className="whitespace-pre-line">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
