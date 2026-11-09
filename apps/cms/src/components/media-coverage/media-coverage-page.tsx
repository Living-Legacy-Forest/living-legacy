import { type MediaCoverageKind, mediaCoverageKindLabels, slugify, youtubeId } from '@ll/content';
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
import {
  ListRow,
  editMenuItems,
  featureMenuItem,
  publishMenuItem,
} from '@/components/list/list-row';
import {
  ConfirmBulkDelete,
  SearchInput,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/list/list-tools';
import { DateTimePicker } from '@/components/date-time-picker';
import {
  ChevronDownIcon,
  ExternalLink,
  NewspaperIcon,
  PanelRightIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
  XIcon,
} from '@/components/icons';
import { FormCell, FormSection, FormSwitchCell } from '@/components/form-cells';
import { ImageField, useMediaItem } from '@/components/media/image-field';
import { PageActions } from '@/components/shell/page-actions';
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/format';
import { reportInvalid } from '@/lib/form-validation';
import { featuredNotice, removedNotice, statusNotice } from '@/lib/notify';
import { openInNewTab } from '@/lib/site';
import { useAction } from '@/lib/use-action';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import {
  type MediaCoverageData,
  type MediaCoverageItem,
  deleteMediaCoverage,
  saveMediaCoverage,
  setMediaCoverageFlags,
} from '@/server/media-coverage';

type Search = { selected?: string };

const NOUN: [string, string] = ['item', 'items'];

/** Where the published items appear. */
const PAGE_URL = 'https://livinglegacy.com.au/about/in-the-media/';

const kindItems = (Object.keys(mediaCoverageKindLabels) as MediaCoverageKind[]).map((value) => ({
  value,
  label: mediaCoverageKindLabels[value],
}));

/** What the pane edits in place of the preview (or the dialog shows, on smaller screens). */
type Target = { kind: 'edit'; id: string } | { kind: 'new' };

export function MediaCoveragePage({
  data,
  search,
  canWrite,
}: {
  data: MediaCoverageData;
  search: Search;
  canWrite: boolean;
}) {
  const navigate = useNavigate({ from: '/media-coverage/' });
  const { run, pending } = useAction();
  const view = useListPane<Target>();
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const selection = useSelection(data.map((m) => m.id));
  const visible = data.filter((m) =>
    matchesSearch(query, [m.title, m.source, m.category, m.excerpt])
  );
  // Offered as suggestions, so the page's topic filter stays tidy.
  const categories = [...new Set(data.map((m) => m.category).filter(Boolean))] as string[];

  const itemFor = (target: Target | null) =>
    target?.kind === 'edit' ? (data.find((m) => m.id === target.id) ?? null) : null;
  // Without anything being edited, the pane previews the selected item.
  const selectedId = data.find((m) => m.id === search.selected)?.id ?? data[0]?.id ?? null;
  const selected = data.find((m) => m.id === selectedId) ?? null;
  const select = (id: string) => {
    view.closePane();
    navigate({ search: (prev) => ({ ...prev, selected: id }), replace: true });
  };
  const pane = canWrite ? view.pane : null;
  const remove = (id: string) =>
    run(() => deleteMediaCoverage({ data: { ids: [id] } }), {
      success: removedNotice(1, NOUN),
      error: 'Could not remove the item',
    });

  async function removeMany(ids: string[]) {
    const result = await run(() => deleteMediaCoverage({ data: { ids } }), {
      success: removedNotice(ids.length, NOUN),
      error: 'Could not remove',
    });
    if (!result) return;
    if (view.pane?.kind === 'edit' && ids.includes(view.pane.id)) view.closePane();
    selection.clear();
  }

  // Shown after the last item, so a new one lands at the end by default.
  const nextOrder = Math.max(0, ...data.map((m) => m.sortOrder)) + 1;

  const coverageForm = (
    target: Target,
    onSaved: (id: string) => void,
    actions: (submit: React.ReactNode) => React.ReactNode
  ) => (
    <CoverageForm
      key={target.kind === 'edit' ? target.id : 'new'}
      item={itemFor(target)}
      categories={categories}
      nextOrder={nextOrder}
      onSaved={onSaved}
      footer={(formPending, isNew) => actions(<SubmitButton pending={formPending} isNew={isNew} />)}
    />
  );

  const addButton = (
    <Button size="sm" onClick={() => view.open({ kind: 'new' })}>
      <PlusIcon aria-hidden data-icon="inline-start" />
      Add coverage
    </Button>
  );

  const paneItem = itemFor(pane);
  const dialogItem = itemFor(view.dialog);

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100svh-7.5rem)]">
      <div className="flex flex-wrap items-center gap-3">
        <h1 data-slot="page-title" className="mr-auto text-xl">
          Media coverage
        </h1>
        {data.length > 0 && (
          <SearchInput
            label="Search media coverage"
            placeholder="Search titles and outlets"
            value={query}
            onChange={setQuery}
          />
        )}
        <div className="flex gap-3 max-md:hidden">
          <Button
            size="sm"
            variant="outline"
            render={<a href={PAGE_URL} target="_blank" rel="noreferrer" />}
            nativeButton={false}
          >
            <ExternalLink aria-hidden data-icon="inline-start" />
            View on website
          </Button>
          {canWrite && addButton}
        </div>
        <PageActions
          edit={
            canWrite
              ? {
                  editing: selection.selecting,
                  onToggle: selection.selecting ? selection.clear : selection.startEditing,
                }
              : undefined
          }
          add={
            canWrite
              ? { label: 'Add coverage', onClick: () => view.open({ kind: 'new' }) }
              : undefined
          }
          more={[
            {
              label: 'View on website',
              onClick: () => window.open(PAGE_URL, '_blank', 'noreferrer'),
            },
          ]}
        />
      </div>

      {data.length === 0 && pane === null ? (
        <Empty className="flex-1 rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <NewspaperIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No media coverage yet</EmptyTitle>
            <EmptyDescription>
              Add a news article or video and it appears on the In the media page.
            </EmptyDescription>
          </EmptyHeader>
          {canWrite && <EmptyContent>{addButton}</EmptyContent>}
        </Empty>
      ) : (
        <ListPageLayout>
          <ListColumn
            label="Media coverage"
            header={
              <SelectionBar
                selection={selection}
                visibleIds={visible.map((m) => m.id)}
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
              <ListRows>
                {visible.map((m) => (
                  <ListRow
                    key={m.id}
                    align="start"
                    current={
                      pane === null ? m.id === selectedId : pane.kind === 'edit' && pane.id === m.id
                    }
                    select={
                      canWrite
                        ? {
                            label: `Select ${m.title}`,
                            checked: selection.isChecked(m.id),
                            selecting: selection.selecting,
                            onToggle: () => selection.toggle(m.id),
                          }
                        : undefined
                    }
                    swipe={
                      canWrite
                        ? { label: 'Delete', onAction: () => setToDelete([m.id]) }
                        : undefined
                    }
                    // Large screens preview on a click and edit on a double click; smaller
                    // ones have no preview, so a tap edits.
                    onOpen={() =>
                      isDesktop() ? select(m.id) : canWrite && view.open({ kind: 'edit', id: m.id })
                    }
                    onDoubleClick={() => canWrite && view.open({ kind: 'edit', id: m.id })}
                    previews={isDesktop()}
                    menu={[
                      ...editMenuItems(canWrite && isDesktop(), () =>
                        view.open({ kind: 'edit', id: m.id })
                      ),
                      {
                        label: m.kind === 'article' ? 'Open article' : 'Open video',
                        icon: <ExternalLink aria-hidden />,
                        onSelect: () => openInNewTab(m.externalUrl),
                        shortcut: { key: 'v' },
                      },
                      ...(canWrite
                        ? [
                            featureMenuItem(m.featured, (featured) =>
                              run(() => setMediaCoverageFlags({ data: { id: m.id, featured } }), {
                                success: featuredNotice(featured),
                                error: 'Could not change it',
                              })
                            ),
                            publishMenuItem(m.status === 'published', (status) =>
                              run(() => setMediaCoverageFlags({ data: { id: m.id, status } }), {
                                success: statusNotice(status),
                                error: 'Could not change it',
                              })
                            ),
                          ]
                        : []),
                    ]}
                  >
                    <CoverageSummary item={m} />
                  </ListRow>
                ))}
              </ListRows>
            )}
          </ListColumn>

          {pane !== null ? (
            <PaneColumn label="Edit coverage">
              <PaneFrame title={paneItem ? `Edit ${paneItem.title}` : 'New coverage'}>
                {coverageForm(pane, select, (submit) => (
                  <PaneActions onCancel={view.closePane}>{submit}</PaneActions>
                ))}
              </PaneFrame>
            </PaneColumn>
          ) : (
            <PreviewPane
              item={selected}
              canWrite={canWrite}
              pending={pending}
              onEdit={(m) => view.open({ kind: 'edit', id: m.id })}
              onDelete={remove}
            />
          )}
        </ListPageLayout>
      )}

      <ConfirmBulkDelete
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        count={toDelete?.length ?? 0}
        noun={NOUN}
        description="They are removed from the In the media page. This cannot be undone."
        onConfirm={() => toDelete && removeMany(toDelete)}
      />

      {canWrite && (
        <ListDialog
          open={view.dialog !== null}
          onClose={view.closeDialog}
          title={view.dialog?.kind === 'new' ? 'Add coverage' : 'Edit coverage'}
          description="A news article or video, shown on In the media."
        >
          {view.dialog &&
            coverageForm(view.dialog, view.closeDialog, (submit) => (
              <DialogActions
                start={
                  dialogItem && (
                    <DeleteCoverage
                      item={dialogItem}
                      disabled={pending}
                      onConfirm={() => remove(dialogItem.id).then(view.closeDialog)}
                    />
                  )
                }
              >
                {submit}
              </DialogActions>
            ))}
        </ListDialog>
      )}
    </div>
  );
}

function CoverageSummary({ item }: { item: MediaCoverageItem }) {
  return (
    <>
      <span className="flex items-center gap-2">
        <span className="text-ui min-w-0 flex-1 truncate font-medium">{item.title}</span>
        {item.featured && (
          <StarIcon aria-label="Featured" className="size-3 shrink-0 fill-current" />
        )}
        {item.status === 'draft' && (
          <span className="text-muted-foreground shrink-0 text-xs">Draft</span>
        )}
      </span>
      <span className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
        {item.source} · {mediaCoverageKindLabels[item.kind]}
        {item.category && ` · ${item.category}`}
      </span>
    </>
  );
}

function PreviewPane({
  item,
  canWrite,
  pending,
  onEdit,
  onDelete,
}: {
  item: MediaCoverageItem | null;
  canWrite: boolean;
  pending: boolean;
  onEdit: (m: MediaCoverageItem) => void;
  onDelete: (id: string) => void;
}) {
  if (!item) {
    return (
      <section aria-label="Preview" className="hidden lg:flex">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PanelRightIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Nothing selected</EmptyTitle>
            <EmptyDescription>Choose an item from the list to see it here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    );
  }

  return (
    <section aria-label="Preview" className="hidden min-h-0 flex-col lg:flex">
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b px-3">
        <Badge
          variant={item.status === 'published' ? 'secondary' : 'outline'}
          className="capitalize"
        >
          {item.status}
        </Badge>
        {item.featured && <Badge variant="default">Featured</Badge>}
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="icon-sm"
            variant="ghost"
            render={<a href={item.externalUrl} target="_blank" rel="noopener noreferrer" />}
            aria-label="Open the original"
            nativeButton={false}
          >
            <ExternalLink aria-hidden className="size-4" />
          </Button>
          {canWrite && (
            <>
              <Button size="sm" onClick={() => onEdit(item)}>
                <PencilIcon aria-hidden data-icon="inline-start" />
                Edit
              </Button>
              <DeleteCoverage item={item} disabled={pending} onConfirm={() => onDelete(item.id)} />
            </>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-sm px-6 py-10">
          <CoverageCard item={item} />
        </div>
      </div>
    </section>
  );
}

/** Roughly how the card reads on the website. */
function CoverageCard({ item }: { item: MediaCoverageItem }) {
  const zone = useTimeZone();
  const { item: image } = useMediaItem(item.imageMediaId);
  const videoId = item.kind === 'video' ? youtubeId(item.externalUrl) : null;
  const thumb = image?.url ?? (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);
  const meta = [
    item.coverageDate !== null && formatDate(item.coverageDate, zone),
    item.readingMinutes !== null && `${item.readingMinutes} min read`,
  ].filter(Boolean);

  return (
    <article>
      <div className="bg-muted relative aspect-video overflow-hidden rounded-xl border">
        {thumb ? (
          <img src={thumb} alt={image?.alt ?? ''} className="size-full object-cover" />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center p-4 text-center text-xs">
            {item.kind === 'article' ? 'No image yet' : 'Not a YouTube link, so no thumbnail'}
          </div>
        )}
      </div>
      <p className="text-muted-foreground mt-4 text-xs font-medium tracking-wide uppercase">
        {item.source} · {item.kind === 'video' ? 'Video' : 'News'}
      </p>
      <h2 className="mt-1.5 text-lg leading-snug font-medium text-balance">{item.title}</h2>
      {item.excerpt && <p className="text-muted-foreground mt-2 text-sm">{item.excerpt}</p>}
      {meta.length > 0 && <p className="text-muted-foreground mt-3 text-xs">{meta.join(' · ')}</p>}
      {item.category && (
        <Badge variant="outline" className="mt-4">
          {item.category}
        </Badge>
      )}
    </article>
  );
}

function DeleteCoverage({
  item,
  disabled,
  onConfirm,
}: {
  item: MediaCoverageItem;
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
            aria-label={`Remove ${item.title}`}
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2Icon aria-hidden className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this item?</AlertDialogTitle>
          <AlertDialogDescription>
            “{item.title}” is removed from the In the media page. This cannot be undone.
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

function SubmitButton({ pending, isNew }: { pending: boolean; isNew: boolean }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Spinner />
          Saving…
        </>
      ) : isNew ? (
        'Add coverage'
      ) : (
        'Save'
      )}
    </Button>
  );
}

/** The inline desktop pane: header, scrollable form body, cancel back to the preview. */
/**
 * One category, picked from those already in use or typed new. Styled as a
 * select so it matches Kind beside it.
 */
function CategoryPicker({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const query = search.trim().slice(0, 40);
  const exists = options.some((o) => o.toLowerCase() === query.toLowerCase());
  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              'w-full justify-between pr-2 pl-2.5 font-normal',
              !value && 'text-muted-foreground'
            )}
          />
        }
      >
        <span className="truncate">{value || 'None'}</span>
        <ChevronDownIcon aria-hidden className="text-muted-foreground size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <Command>
          <CommandInput
            placeholder="Find or create a category…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="text-muted-foreground p-4 text-center text-xs">
              No categories yet. Type one to create it.
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  data-checked={option === value}
                  onSelect={() => pick(option)}
                >
                  {option}
                </CommandItem>
              ))}
              {query && !exists && (
                <CommandItem value={`create ${query}`} onSelect={() => pick(query)}>
                  <PlusIcon aria-hidden className="size-3.5" />
                  Create “{query}”
                </CommandItem>
              )}
              {value && (
                <CommandItem value="clear category" onSelect={() => pick('')}>
                  <XIcon aria-hidden className="size-3.5" />
                  No category
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Shared fields + submit logic, used inline (desktop pane) and in the mobile dialog. */
function CoverageForm({
  item,
  categories,
  nextOrder,
  onSaved,
  footer,
}: {
  item: MediaCoverageItem | null;
  categories: string[];
  nextOrder: number;
  onSaved: (id: string) => void;
  footer: (pending: boolean, isNew: boolean) => React.ReactNode;
}) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [slug, setSlug] = useState(item?.slug ?? '');
  // A new item's slug follows its title until someone edits the slug itself.
  const [slugTouched, setSlugTouched] = useState(item !== null);
  const [kind, setKind] = useState<MediaCoverageKind>(item?.kind ?? 'article');
  const [category, setCategory] = useState(item?.category ?? '');
  const [source, setSource] = useState(item?.source ?? '');
  const [coverageDate, setCoverageDate] = useState<number | null>(item?.coverageDate ?? null);
  const [excerpt, setExcerpt] = useState(item?.excerpt ?? '');
  const [readingMinutes, setReadingMinutes] = useState(
    item?.readingMinutes ? String(item.readingMinutes) : ''
  );
  const [imageMediaId, setImageMediaId] = useState(item?.imageMediaId ?? null);
  const [externalUrl, setExternalUrl] = useState(item?.externalUrl ?? '');
  const [featured, setFeatured] = useState(item?.featured ?? false);
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? nextOrder));
  const [published, setPublished] = useState(item ? item.status === 'published' : true);
  const { run, pending } = useAction();

  const notYouTube = kind === 'video' && externalUrl !== '' && youtubeId(externalUrl) === null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    const result = await run(
      () =>
        saveMediaCoverage({
          data: {
            id: item?.id,
            title,
            slug,
            kind,
            category,
            source,
            coverageDate,
            excerpt,
            readingMinutes: readingMinutes ? Number(readingMinutes) : null,
            imageMediaId,
            externalUrl,
            featured,
            sortOrder: Number(sortOrder) || 0,
            status: published ? 'published' : 'draft',
          },
        }),
      {
        success: {
          title: item ? 'Coverage saved' : 'Coverage added',
          description: published
            ? 'It shows on the website.'
            : 'It is a draft, so the website does not show it.',
        },
        error: 'Could not save the coverage',
      }
    );
    if (result) onSaved(result.id);
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4 max-md:space-y-7">
      <FormSection>
        <FormCell label="Title" htmlFor="mc-title">
          <Input
            id="mc-title"
            required
            maxLength={200}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="As the outlet headlined it"
          />
        </FormCell>
        <FormCell label="Slug" htmlFor="mc-slug">
          <Input
            id="mc-slug"
            maxLength={80}
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            onBlur={() => setSlug(slugify(slug || title))}
            placeholder="made-from-the-title"
            className="text-ui font-mono"
          />
        </FormCell>
      </FormSection>
      <FormSection footer="The category drives the topic filter on the page, e.g. Science or Broadcast.">
        <div className="grid grid-cols-2 gap-3 max-md:contents">
          <FormCell label="Kind" htmlFor="mc-kind">
            <Select
              items={kindItems}
              value={kind}
              onValueChange={(v) => v && setKind(v as MediaCoverageKind)}
            >
              <SelectTrigger id="mc-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kindItems.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormCell>
          <FormCell label="Category" htmlFor="mc-category">
            <CategoryPicker
              id="mc-category"
              value={category}
              options={categories}
              onChange={setCategory}
            />
          </FormCell>
        </div>
      </FormSection>
      <FormSection>
        <FormCell
          label="Source"
          htmlFor="mc-source"
          hint="The outlet name, e.g. The Senior, Herald Sun, Today Tonight."
        >
          <Input
            id="mc-source"
            required
            maxLength={80}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Herald Sun"
          />
        </FormCell>
        <FormCell label="Published at" htmlFor="mc-date">
          <DateTimePicker
            id="mc-date"
            value={coverageDate}
            onChange={setCoverageDate}
            placeholder="When the outlet ran it"
          />
        </FormCell>
        <FormCell
          label="Excerpt"
          htmlFor="mc-excerpt"
          hint="A short summary shown beneath the title on the card."
        >
          <Textarea
            id="mc-excerpt"
            rows={3}
            maxLength={400}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
          />
        </FormCell>
        <FormCell
          label="Reading time (min)"
          htmlFor="mc-reading"
          hint="Optional. Shown as the read time on the card."
        >
          <Input
            id="mc-reading"
            type="number"
            inputMode="numeric"
            min={1}
            max={240}
            value={readingMinutes}
            onChange={(e) => setReadingMinutes(e.target.value)}
            className="w-28"
          />
        </FormCell>
      </FormSection>
      <FormSection>
        <ImageField
          id="mc-image"
          aspect={16 / 9}
          label="Image"
          description="Used for news articles and as the thumbnail for video cards."
          mediaId={imageMediaId}
          onChange={setImageMediaId}
        />
      </FormSection>
      <FormSection>
        <FormCell
          label="External URL"
          htmlFor="mc-url"
          hint={
            notYouTube
              ? 'Not a YouTube link, so the card opens it in a new tab instead of playing it.'
              : 'A link to the original article or video.'
          }
        >
          <Input
            id="mc-url"
            type="url"
            required
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://"
          />
        </FormCell>
      </FormSection>
      <FormSection>
        <FormSwitchCell
          id="mc-featured"
          label="Featured"
          description="Shown first, as a larger card."
          checked={featured}
          onCheckedChange={setFeatured}
        />
        <FormCell label="Order" htmlFor="mc-order" hint="Lower numbers come first.">
          <Input
            id="mc-order"
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
          id="mc-published"
          label="Published"
          description="Show this on the website."
          checked={published}
          onCheckedChange={setPublished}
        />
      </FormSection>
      {footer(pending, item === null)}
    </form>
  );
}
