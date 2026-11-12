import {
  type AustralianState,
  type LocationStage,
  type RichTextDoc,
  australianStateLabels,
  locationStageLabels,
  slugify,
} from '@ll/content';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  DialogActions,
  ListColumn,
  ListDialog,
  ListPageLayout,
  ListRows,
  NoMatches,
  PaneActions,
  PaneColumn,
  PaneFrame,
  isDesktop,
  useListPane,
} from '@/components/list/list-page';
import { ListRow, editMenuItems, publishMenuItem } from '@/components/list/list-row';
import {
  ConfirmBulkDelete,
  SearchInput,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/list/list-tools';
import { FormBlock, FormCell, FormSection, FormSwitchCell } from '@/components/form-cells';
import { FormStep, FormSteps, TOUCH_FIELDS, useFormSteps } from '@/components/form-steps';
import { ExternalLink, MapPinIcon, PencilIcon, PlusIcon, Trash2Icon } from '@/components/icons';
import { LocationsOverviewMap, PinPicker, type Pin } from '@/components/locations/location-map';
import { PageActions } from '@/components/shell/page-actions';
import { ImageField, useMediaItem } from '@/components/media/image-field';
import { RichTextField } from '@/components/rich-text-field';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { reportInvalid } from '@/lib/form-validation';
import { removedNotice, statusNotice } from '@/lib/notify';
import { openInNewTab } from '@/lib/site';
import { RevealWords } from '@/components/dashboard/reveal-words';
import { useAction } from '@/lib/use-action';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { cn } from '@/lib/utils';
import {
  type LocationItem,
  type LocationsData,
  deleteLocations,
  saveLocation,
  setLocationStatus,
} from '@/server/locations';

type Search = { selected?: string };

const NOUN: [string, string] = ['location', 'locations'];

const STEPS = ['Details', 'Content', 'Visit', 'Publish'] as const;

const stateItems = (Object.keys(australianStateLabels) as AustralianState[]).map((value) => ({
  value,
  label: australianStateLabels[value],
}));

const stageItems = (Object.keys(locationStageLabels) as LocationStage[]).map((value) => ({
  value,
  label: locationStageLabels[value],
}));

const stageHints: Record<LocationStage, string> = {
  live: 'Has its own page on this website, at the address below.',
  external: 'Listed in the directory, linking to its current website until it moves here.',
  coming_soon: 'Listed in the directory as coming soon, with no page to visit.',
};

/** What the pane edits in place of the preview (or the dialog shows, on smaller screens). */
type Target = { kind: 'edit'; id: string } | { kind: 'new' };

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
  const view = useListPane<Target>();
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const selection = useSelection(data.map((l) => l.id));
  const visible = data.filter((l) =>
    matchesSearch(query, [l.name, l.region, australianStateLabels[l.state], l.address])
  );

  const itemFor = (target: Target | null) =>
    target?.kind === 'edit' ? (data.find((l) => l.id === target.id) ?? null) : null;
  // Without anything being edited, the pane maps every location; selecting
  // one, from the list or its pin, opens its details in a sheet.
  const selectedId = data.find((l) => l.id === search.selected)?.id ?? null;
  const selected = data.find((l) => l.id === selectedId) ?? null;
  // Open on arrival when a location is already chosen, e.g. from the dashboard map.
  const [sheetOpen, setSheetOpen] = useState(search.selected !== undefined);
  const select = (id: string) => {
    view.closePane();
    navigate({ search: (prev) => ({ ...prev, selected: id }), replace: true });
    setSheetOpen(true);
  };
  const pane = canWrite ? view.pane : null;
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
    if (view.pane?.kind === 'edit' && ids.includes(view.pane.id)) view.closePane();
    selection.clear();
  }

  // Shown after the last location, so a new one lands at the end by default.
  const nextOrder = Math.max(0, ...data.map((l) => l.sortOrder)) + 1;

  const locationForm = (
    target: Target,
    onSaved: (id: string) => void,
    actions: (submit: React.ReactNode, start: React.ReactNode) => React.ReactNode,
    deleteButton?: React.ReactNode
  ) => (
    <LocationForm
      key={target.kind === 'edit' ? target.id : 'new'}
      item={itemFor(target)}
      nextOrder={nextOrder}
      onSaved={onSaved}
      actions={actions}
      deleteButton={deleteButton}
    />
  );

  const addButton = (
    <Button size="sm" className="touch:min-h-11" onClick={() => view.open({ kind: 'new' })}>
      <PlusIcon aria-hidden data-icon="inline-start" />
      Add location
    </Button>
  );

  const paneItem = itemFor(pane);
  const dialogItem = itemFor(view.dialog);

  return (
    <div
      data-slot="list-page"
      data-revealing={revealing || undefined}
      className="flex flex-col gap-4 lg:h-[calc(100svh-7.5rem)]"
    >
      <div data-slot="list-toolbar" className="flex flex-wrap items-center gap-3">
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
        {canWrite && <div className="max-md:hidden">{addButton}</div>}
        {canWrite && (
          <PageActions
            edit={{
              editing: selection.selecting,
              onToggle: selection.selecting ? selection.clear : selection.startEditing,
            }}
            add={{ label: 'Add location', onClick: () => view.open({ kind: 'new' }) }}
          />
        )}
      </div>

      {data.length === 0 && pane === null ? (
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
        <ListPageLayout>
          <ListColumn
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
              <NoMatches onClear={() => setQuery('')}>Nothing matches that search.</NoMatches>
            ) : (
              <ListRows inset="media">
                {visible.map((l) => (
                  <ListRow
                    key={l.id}
                    current={
                      pane === null ? l.id === selectedId : pane.kind === 'edit' && pane.id === l.id
                    }
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
                    menu={[
                      ...editMenuItems(canWrite && isDesktop(), () =>
                        view.open({ kind: 'edit', id: l.id })
                      ),
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
                    ]}
                    // Large screens preview on a click and edit on a double click; smaller
                    // ones have no preview, so a tap edits.
                    onOpen={() =>
                      isDesktop() ? select(l.id) : canWrite && view.open({ kind: 'edit', id: l.id })
                    }
                    onDoubleClick={() => canWrite && view.open({ kind: 'edit', id: l.id })}
                  >
                    <LocationSummary item={l} />
                  </ListRow>
                ))}
              </ListRows>
            )}
          </ListColumn>

          {pane !== null ? (
            <PaneColumn label="Edit location">
              <PaneFrame title={paneItem ? `Edit ${paneItem.name}` : 'New location'}>
                {locationForm(pane, select, (submit, start) => (
                  <PaneActions start={start} onCancel={view.closePane}>
                    {submit}
                  </PaneActions>
                ))}
              </PaneFrame>
            </PaneColumn>
          ) : (
            <section aria-label="Map" className="relative hidden min-h-0 lg:flex">
              <LocationsOverviewMap
                locations={data.map((l) => ({
                  id: l.id,
                  name: l.name,
                  pin: pinOf(l),
                  photoUrl: l.heroMediaId ? `/api/media/${l.heroMediaId}?w=640` : null,
                }))}
                selectedId={selectedId}
                onSelect={select}
              />
            </section>
          )}
        </ListPageLayout>
      )}

      <LocationSheet
        item={selected}
        open={sheetOpen && selected !== null && pane === null}
        onOpenChange={setSheetOpen}
        canWrite={canWrite}
        pending={pending}
        onEdit={(l) => {
          setSheetOpen(false);
          view.open({ kind: 'edit', id: l.id });
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

      {canWrite && (
        <ListDialog
          open={view.dialog !== null}
          onClose={view.closeDialog}
          title={view.dialog?.kind === 'new' ? 'Add location' : 'Edit location'}
          // A saved location's sheet needs the room more than the explanation.
          description={
            view.dialog?.kind === 'new'
              ? 'A location in the directory, with the details for its page.'
              : undefined
          }
        >
          {view.dialog &&
            locationForm(
              view.dialog,
              view.closeDialog,
              (submit, start) => (
                <DialogActions compact start={start}>
                  {submit}
                </DialogActions>
              ),
              dialogItem && (
                <DeleteLocation
                  item={dialogItem}
                  disabled={pending}
                  onConfirm={() => remove(dialogItem.id).then(view.closeDialog)}
                />
              )
            )}
        </ListDialog>
      )}
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

const pinOf = (l: { latitude: number | null; longitude: number | null }): Pin | null =>
  l.latitude !== null && l.longitude !== null
    ? { latitude: l.latitude, longitude: l.longitude }
    : null;

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

function DeleteLocation({
  item,
  disabled,
  onConfirm,
}: {
  item: LocationItem;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={`Remove ${item.name}`}
            className="text-muted-foreground hover:text-destructive touch:size-11"
          />
        }
      >
        <Trash2Icon aria-hidden className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this location?</AlertDialogTitle>
          <AlertDialogDescription>
            “{item.name}” is removed from the location directory. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Shared fields + submit logic, used inline (desktop pane) and in the mobile dialog. */
function LocationForm({
  item,
  nextOrder,
  onSaved,
  actions,
  deleteButton,
}: {
  item: LocationItem | null;
  nextOrder: number;
  onSaved: (id: string) => void;
  actions: (submit: React.ReactNode, start: React.ReactNode) => React.ReactNode;
  /** Where the form has one: on its last step, out of the way of moving between them. */
  deleteButton?: React.ReactNode;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [slug, setSlug] = useState(item?.slug ?? '');
  // A new location's slug follows its name until someone edits the slug itself.
  const [slugTouched, setSlugTouched] = useState(item !== null);
  const [state, setState] = useState<AustralianState>(item?.state ?? 'QLD');
  const [region, setRegion] = useState(item?.region ?? '');
  const [stage, setStage] = useState<LocationStage>(item?.stage ?? 'coming_soon');
  const [externalUrl, setExternalUrl] = useState(item?.externalUrl ?? '');
  const [heroMediaId, setHeroMediaId] = useState(item?.heroMediaId ?? null);
  const [intro, setIntro] = useState(item?.intro ?? '');
  const [about, setAbout] = useState<RichTextDoc | null>(item?.about ?? null);
  const [address, setAddress] = useState(item?.address ?? '');
  const [pin, setPin] = useState<Pin | null>(item ? pinOf(item) : null);
  const [mapUrl, setMapUrl] = useState(item?.mapUrl ?? '');
  const [hours, setHours] = useState(item?.hours ?? '');
  const [phone, setPhone] = useState(item?.phone ?? '');
  const [email, setEmail] = useState(item?.email ?? '');
  const [hubspotFormId, setHubspotFormId] = useState(item?.hubspotFormId ?? '');
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? nextOrder));
  const [published, setPublished] = useState(item ? item.status === 'published' : true);
  const { run, pending } = useAction();
  const heroUrl = useMediaItem(heroMediaId).item?.url;
  const steps = useFormSteps({ count: STEPS.length });
  const { step } = steps;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    // A new location moves on until its last step, then is added; a saved one saves.
    if (!item && !steps.isLast) {
      steps.goTo(step + 1);
      return;
    }
    const result = await run(
      () =>
        saveLocation({
          data: {
            id: item?.id,
            name,
            slug,
            state,
            region,
            stage,
            externalUrl,
            heroMediaId,
            intro,
            about,
            address,
            pin,
            mapUrl,
            hours,
            phone,
            email,
            hubspotFormId,
            sortOrder: Number(sortOrder) || 0,
            status: published ? 'published' : 'draft',
          },
        }),
      {
        success: {
          title: item ? 'Location saved' : 'Location added',
          description: published
            ? 'Its page and map pin show on the website.'
            : 'It is a draft, so the website does not show it.',
        },
        error: 'Could not save the location',
      }
    );
    if (result) onSaved(result.id);
  }

  const saveButton = (label: string) => (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Spinner />
          Saving…
        </>
      ) : (
        label
      )}
    </Button>
  );

  return (
    <form
      ref={steps.form}
      noValidate
      onSubmit={submit}
      className={cn('scroll-mt-12 space-y-5', TOUCH_FIELDS)}
    >
      <FormSteps labels={STEPS} current={step} onPick={item ? steps.goTo : undefined} />
      <FormStep step={step} forward={steps.forward} className="space-y-4 max-md:space-y-7">
        {step === 0 && (
          <>
            <FormSection>
              <FormCell
                label="Name"
                htmlFor="loc-name"
                hint="The public name, as it appears on signage."
              >
                <Input
                  id="loc-name"
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slugTouched) setSlug(slugify(e.target.value));
                  }}
                  placeholder="The location’s public name"
                />
              </FormCell>
              <FormCell
                label="Slug"
                htmlFor="loc-slug"
                hint={
                  <>
                    Its page lives at /locations/{slug || 'slug'}/. Keep it short, e.g. the town
                    name.
                  </>
                }
              >
                <Input
                  id="loc-slug"
                  maxLength={80}
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugTouched(true);
                  }}
                  onBlur={() => setSlug(slugify(slug || name))}
                  placeholder="made-from-the-name"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="md:text-ui font-mono"
                />
              </FormCell>
            </FormSection>
            <FormSection
              title="Place"
              footer="The state filters the directory; it is never a page of its own."
            >
              <div className="grid grid-cols-2 gap-3 max-md:contents">
                <FormCell label="State" htmlFor="loc-state">
                  <Select
                    items={stateItems}
                    value={state}
                    onValueChange={(v) => v && setState(v as AustralianState)}
                  >
                    <SelectTrigger id="loc-state" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stateItems.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormCell>
                <FormCell label="Region" htmlFor="loc-region">
                  <Input
                    id="loc-region"
                    maxLength={80}
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="Optional, e.g. a nearby town"
                  />
                </FormCell>
              </div>
            </FormSection>
            <FormSection title="Listing">
              <FormCell label="Stage" htmlFor="loc-stage" hint={stageHints[stage]}>
                <Select
                  items={stageItems}
                  value={stage}
                  onValueChange={(v) => v && setStage(v as LocationStage)}
                >
                  <SelectTrigger id="loc-stage" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stageItems.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormCell>
              {stage === 'external' && (
                <FormCell
                  label="Current website"
                  htmlFor="loc-external"
                  hint="Where the directory sends visitors until this location moves here."
                >
                  <Input
                    id="loc-external"
                    type="url"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://"
                  />
                </FormCell>
              )}
            </FormSection>
          </>
        )}
        {step === 1 && (
          <>
            <FormSection>
              <ImageField
                id="loc-hero"
                label="Hero photo"
                description="A genuine photo of this location, never a generic one."
                mediaId={heroMediaId}
                onChange={setHeroMediaId}
              />
              <FormCell
                label="Intro"
                htmlFor="loc-intro"
                hint="A sentence or two for its card in the directory."
              >
                <Textarea
                  id="loc-intro"
                  rows={3}
                  maxLength={400}
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  placeholder="What makes this place special, in a sentence or two"
                />
              </FormCell>
            </FormSection>
            <FormBlock
              label="About"
              labelId="loc-about-label"
              htmlFor="loc-about"
              hint="The local introduction on its page: the landscape, trees and what a visit is like."
            >
              <RichTextField
                id="loc-about"
                labelId="loc-about-label"
                value={about}
                onChange={setAbout}
                placeholder="Tell visitors about this place and what to expect when they visit"
              />
            </FormBlock>
          </>
        )}
        {step === 2 && (
          <>
            <FormSection>
              <FormCell label="Address" htmlFor="loc-address">
                <Input
                  id="loc-address"
                  maxLength={200}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, suburb, state and postcode"
                />
              </FormCell>
            </FormSection>
            <FormBlock
              label="Map pin"
              htmlFor="loc-pin"
              hint="Find it from the address, then drag the pin or click the map to fine-tune it."
            >
              <PinPicker
                id="loc-pin"
                pin={pin}
                address={address}
                photoUrl={heroUrl}
                onChange={setPin}
              />
            </FormBlock>
            <FormSection title="Visiting">
              <FormCell label="Map link" htmlFor="loc-map" hint="The Share link from Google Maps.">
                <Input
                  id="loc-map"
                  type="url"
                  value={mapUrl}
                  onChange={(e) => setMapUrl(e.target.value)}
                  placeholder="https://"
                />
              </FormCell>
              <FormCell label="Hours" htmlFor="loc-hours" hint="One line per day or range.">
                <Textarea
                  id="loc-hours"
                  rows={3}
                  maxLength={400}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder={'Monday to Friday, 9am to 5pm\nWeekends by appointment'}
                />
              </FormCell>
              <div className="grid grid-cols-2 gap-3 max-md:contents">
                <FormCell label="Phone" htmlFor="loc-phone">
                  <Input
                    id="loc-phone"
                    type="tel"
                    maxLength={40}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number"
                  />
                </FormCell>
                <FormCell label="Email" htmlFor="loc-email">
                  <Input
                    id="loc-email"
                    type="email"
                    maxLength={120}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                  />
                </FormCell>
              </div>
            </FormSection>
          </>
        )}
        {step === 3 && (
          <>
            <FormSection>
              <FormCell
                label="HubSpot form ID"
                htmlFor="loc-form"
                hint="Found in HubSpot under the form’s embed code. Tour bookings and enquiries from its page go to this form, so they reach this location’s team. Blank uses the general enquiry form."
              >
                <Input
                  id="loc-form"
                  maxLength={36}
                  value={hubspotFormId}
                  onChange={(e) => setHubspotFormId(e.target.value)}
                  placeholder="Optional"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="md:text-ui font-mono"
                />
              </FormCell>
            </FormSection>
            <FormSection>
              <FormCell
                label="Order"
                htmlFor="loc-order"
                hint="Lower numbers come first in the directory."
              >
                <Input
                  id="loc-order"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={9999}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-28"
                />
              </FormCell>
              <FormSwitchCell
                id="loc-published"
                label="Published"
                description="Show this on the website."
                checked={published}
                onCheckedChange={setPublished}
              />
            </FormSection>
          </>
        )}
      </FormStep>
      {actions(
        item ? (
          <>
            {!steps.isLast && (
              <Button type="button" variant="outline" onClick={() => steps.goTo(step + 1)}>
                Next
              </Button>
            )}
            {saveButton('Save')}
          </>
        ) : steps.isLast ? (
          saveButton('Add location')
        ) : (
          <Button type="submit">Next</Button>
        ),
        (step > 0 || (steps.isLast && deleteButton)) && (
          <div className="flex items-center gap-1">
            {step > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => steps.goTo(step - 1)}>
                Back
              </Button>
            )}
            {steps.isLast && deleteButton}
          </div>
        )
      )}
    </form>
  );
}
