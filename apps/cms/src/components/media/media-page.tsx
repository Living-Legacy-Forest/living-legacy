import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConfirmBulkDelete,
  RowCheckbox,
  SearchInput,
  SelectionBar,
  useSelection,
} from '@/components/list/list-tools';
import {
  CircleCheckIcon,
  FileTextIcon,
  DownloadIcon,
  LinkIcon,
  MediaIcon,
  PanelRightIcon,
  Trash2Icon,
  UploadIcon,
} from '@/components/icons';
import { type RowMenuItem, RowMenu } from '@/components/list/list-row';
import { PageActions } from '@/components/shell/page-actions';
import { ListFilter } from '@/components/list/list-filter';
import { ListSort, useListSort } from '@/components/list/list-sort';
import { ViewSwitch, useListView } from '@/components/list/view-switch';
import { DocumentThumb } from '@/components/media/document-card';
import {
  copyLink,
  download,
  extensionLabel,
  fileFacts,
  focalStyle,
} from '@/components/media/media-file';
import { MediaUploadDialog } from '@/components/media/upload-dialog';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { useLoadMore } from '@/hooks/use-load-more';
import { MEDIA_MAX_SHOWN, MEDIA_PAGE_SIZE } from '@/lib/media-paging';
import { formatDate } from '@/lib/format';
import { type MediaLibrarySearch, rememberMediaSearch } from '@/lib/media-return';
import { notify, removedNotice } from '@/lib/notify';
import { addPdfCover } from '@/lib/pdf-cover';
import { useSortLayout } from '@/lib/sort-motion';
import { useTimeZone } from '@/lib/use-time-zone';
import { mediaSrc } from '@/lib/upload-media';
import { isDocumentMime, mediaSorts } from '@ll/content';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import { type MediaItem, type MediaListData, deleteMedia } from '@/server/media';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { RevealWords } from '@/components/dashboard/reveal-words';

const NOUN: [string, string] = ['file', 'files'];

/** Only this many files glide to a new sort order; further down they just move. */
const ANIMATED_ITEMS = 120;

export function MediaPage({
  data,
  tags,
  extensions,
  search,
  canDelete,
}: {
  data: MediaListData;
  /** Every tag in use, for the filter. */
  tags: { tag: string; count: number }[];
  /** Every file extension in use, for the format filter. */
  extensions: { ext: string; count: number }[];
  search: MediaLibrarySearch;
  canDelete: boolean;
}) {
  const items = data.items;
  const router = useRouter();
  const [view, setView] = useListView('media', 'grid');
  // PDFs uploaded before thumbnails existed, among the files loaded, and the one being drawn now.
  const missingCovers = items.filter((m) => m.mime === 'application/pdf' && !m.hasCover);
  const [coverProgress, setCoverProgress] = useState<number | null>(null);
  async function makeCovers() {
    let failed = 0;
    for (const [i, file] of missingCovers.entries()) {
      setCoverProgress(i + 1);
      try {
        await addPdfCover(file);
      } catch {
        failed += 1;
      }
    }
    setCoverProgress(null);
    await router.invalidate();
    if (failed === 0) {
      notify.success({ title: 'Thumbnails made', description: `${missingCovers.length} done.` });
    } else {
      notify.error(
        'Some thumbnails could not be made',
        `${failed} of ${missingCovers.length} PDFs could not be drawn, so they keep the generic cover.`
      );
    }
  }
  const [sort, setSort] = useListSort(mediaSorts);
  const zone = useTimeZone();
  const [query, setQuery] = useState(search.q ?? '');
  const navigate = useNavigate({ from: '/media/' });
  // Ticked files, or the one a context menu deletes; null when nothing is waiting.
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Files dropped on the page, waiting for the upload dialog to take them.
  const [dropped, setDropped] = useState<File[]>([]);
  const takeDropped = useCallback(() => setDropped([]), []);
  const selection = useSelection(items.map((m) => m.id));
  const { run, pending } = useAction();
  // A file opens on its own page, so it has an address and room for a proper preview.
  const open = (id: string) => void navigate({ to: '/media/$mediaId', params: { mediaId: id } });

  // The library is searched on the server, so the search goes in the URL once
  // typing pauses, and a new search starts again from the first page.
  useEffect(() => {
    if (query === (search.q ?? '')) return;
    const timer = setTimeout(() => {
      void navigate({
        search: (prev) => ({ ...prev, q: query || undefined, show: undefined }),
        replace: true,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search.q, navigate]);

  // Files load a page at a time as the grid scrolls.
  const loading = useRouterState({ select: (s) => s.status === 'pending' });
  const hasMore = data.nextCursor !== null && items.length < MEDIA_MAX_SHOWN;
  const showMore = () =>
    void navigate({
      search: (prev) => ({
        ...prev,
        show: Math.min(MEDIA_MAX_SHOWN, items.length + MEDIA_PAGE_SIZE),
      }),
      replace: true,
      resetScroll: false,
    });
  const sentinel = useLoadMore<HTMLDivElement>(showMore, hasMore && !loading);
  // So a file's page can come back to this view.
  useEffect(() => rememberMediaSearch(search), [search]);
  const chosenTypes = search.types ?? [];
  const chosenTags = search.tags ?? [];
  const chosenExts = search.exts ?? [];
  const filtered = chosenTypes.length > 0 || chosenTags.length > 0 || chosenExts.length > 0;
  const libraryEmpty = data.total === 0 && !search.q && !filtered;
  // What the count above the files describes: one filter by name, several as "Filtered".
  const kindsOfFilter = [chosenTypes.length, chosenTags.length, chosenExts.length].filter(Boolean);
  const filterTitle =
    kindsOfFilter.length > 1
      ? 'Filtered'
      : chosenTags.length
        ? chosenTags.map((t) => `#${t}`).join(' ')
        : chosenExts.length
          ? chosenExts.map((e) => e.toUpperCase()).join(', ')
          : chosenTypes.length === 1
            ? chosenTypes[0] === 'images'
              ? 'Images'
              : 'Documents'
            : 'All';
  // One Filter button, the same as on the other lists: a group each for type, format and tags.
  const filterValues = { types: chosenTypes, formats: chosenExts, tags: chosenTags };
  // A new filter starts again from the first page.
  const changeFilter = (key: string, next: string[]) =>
    void navigate({
      search: (prev) => ({
        ...prev,
        ...(key === 'types' && {
          types: next.length ? (next as ('images' | 'documents')[]) : undefined,
        }),
        ...(key === 'formats' && { exts: next.length ? next : undefined }),
        ...(key === 'tags' && { tags: next.length ? next : undefined }),
        show: undefined,
      }),
      replace: true,
    });
  const clearFilters = () =>
    void navigate({
      search: (prev) => ({
        ...prev,
        types: undefined,
        exts: undefined,
        tags: undefined,
        show: undefined,
      }),
      replace: true,
    });

  async function remove(ids: string[]) {
    const result = await run(() => deleteMedia({ data: { ids } }), {
      success: (r) => removedNotice(r.removed, NOUN),
      error: 'Could not remove',
    });
    if (!result) return;
    selection.clear();
  }

  const revealing = useRevealOnce();

  return (
    <div
      data-slot="stack-page"
      data-revealing={revealing || undefined}
      className="flex flex-1 flex-col gap-4"
      // A drop on the upload dialog's own target is handled there (it bubbles through the portal).
      onDragOver={(e) => {
        if (e.defaultPrevented || uploading) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (e.defaultPrevented || uploading) return;
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;
        setDropped(files);
        setUploading(true);
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h1 data-slot="page-title" className="mr-auto text-xl">
          <RevealWords text="Media" />
        </h1>
        {!libraryEmpty && (
          <SearchInput
            label="Search media"
            placeholder="Search filenames and captions"
            value={query}
            onChange={setQuery}
          />
        )}
        {!libraryEmpty && (
          <>
            <ListFilter
              groups={[
                {
                  key: 'types',
                  label: 'Type',
                  options: [
                    { value: 'images', label: 'Images' },
                    { value: 'documents', label: 'Documents' },
                  ],
                },
                {
                  key: 'formats',
                  label: 'Format',
                  options: extensions.map((e) => ({
                    value: e.ext,
                    label: `${e.ext.toUpperCase()} (${e.count})`,
                  })),
                },
                {
                  key: 'tags',
                  label: 'Tag',
                  options: tags.map((t) => ({ value: t.tag, label: `${t.tag} (${t.count})` })),
                },
              ]}
              values={filterValues}
              onChange={changeFilter}
              onClear={clearFilters}
            />
            <ListSort options={mediaSorts} value={sort} onChange={setSort} />
            {missingCovers.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={coverProgress !== null}
                onClick={() => void makeCovers()}
              >
                {coverProgress !== null && <Spinner data-icon="inline-start" />}
                {coverProgress !== null
                  ? `Making ${coverProgress} of ${missingCovers.length}`
                  : `Make ${missingCovers.length} PDF ${missingCovers.length === 1 ? 'thumbnail' : 'thumbnails'}`}
              </Button>
            )}
            <ViewSwitch value={view} onChange={setView} />
          </>
        )}
        <Button size="sm" className="max-md:hidden" onClick={() => setUploading(true)}>
          <UploadIcon aria-hidden data-icon="inline-start" />
          Upload
        </Button>
        <PageActions
          edit={
            canDelete
              ? {
                  editing: selection.selecting,
                  onToggle: selection.selecting ? selection.clear : selection.startEditing,
                }
              : undefined
          }
          add={{
            label: 'Upload files',
            onClick: () => setUploading(true),
          }}
        />
      </div>

      {libraryEmpty ? (
        <Empty className={cn('flex-1 rounded-lg border', dragOver && 'border-ring bg-accent/40')}>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MediaIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No media yet</EmptyTitle>
            <EmptyDescription>
              Upload images, and PDF or Word documents, for posts, events and team members. Drag and
              drop works too.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => setUploading(true)}>
              <UploadIcon aria-hidden data-icon="inline-start" />
              Upload files
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border',
            // Phones: no frame. The grid keeps the page's side gutters; the list runs edge to edge.
            'max-md:flex-none max-md:overflow-visible max-md:rounded-none max-md:border-0',
            dragOver && 'ring-ring ring-2'
          )}
        >
          <SelectionBar
            selection={selection}
            visibleIds={items.map((m) => m.id)}
            title={filterTitle}
            total={data.total}
            pending={pending}
            onDelete={canDelete ? () => setToDelete(selection.checkedIds) : undefined}
          />
          {items.length === 0 ? (
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm">
              No media match{search.q ? ' that search' : ' this filter'}.
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery('');
                  void navigate({
                    search: (prev) => ({
                      ...prev,
                      q: undefined,
                      types: undefined,
                      tags: undefined,
                      exts: undefined,
                      show: undefined,
                    }),
                    replace: true,
                  });
                }}
              >
                Clear search and filters
              </Button>
            </div>
          ) : (
            <div
              // Coming back from a file returns to where the grid was.
              data-scroll-restoration-id="media-grid"
              className="flex-1 overflow-y-auto p-3 max-md:-mx-4 max-md:overflow-visible max-md:p-0"
            >
              {view === 'grid' ? (
                <div className="grid grid-cols-2 gap-3 max-md:grid-cols-3 max-md:gap-2 max-md:px-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {items.map((m, index) => (
                    <MediaTile
                      key={m.id}
                      animate={index < ANIMATED_ITEMS}
                      item={m}
                      checked={selection.isChecked(m.id)}
                      selecting={selection.selecting || selection.checkedIds.length > 0}
                      onToggle={() => selection.toggle(m.id)}
                      // In Edit mode a tap ticks the tile, as in Photos.
                      onOpen={() => (selection.selecting ? selection.toggle(m.id) : open(m.id))}
                      onEdit={() => open(m.id)}
                      onDelete={canDelete ? () => setToDelete([m.id]) : undefined}
                    />
                  ))}
                </div>
              ) : (
                <ul className="divide-y rounded-md border max-md:rounded-none max-md:border-x-0">
                  {items.map((m, index) => (
                    <MediaRow
                      key={m.id}
                      animate={index < ANIMATED_ITEMS}
                      item={m}
                      zone={zone}
                      checked={selection.isChecked(m.id)}
                      selecting={selection.selecting || selection.checkedIds.length > 0}
                      onToggle={() => selection.toggle(m.id)}
                      onOpen={() => (selection.selecting ? selection.toggle(m.id) : open(m.id))}
                      onEdit={() => open(m.id)}
                      onDelete={canDelete ? () => setToDelete([m.id]) : undefined}
                    />
                  ))}
                </ul>
              )}
              {hasMore && (
                <div ref={sentinel} className="flex justify-center pt-4 max-md:py-4">
                  <Button variant="ghost" size="sm" disabled={loading} onClick={showMore}>
                    {loading && <Spinner data-icon="inline-start" />}
                    Show more
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <MediaUploadDialog
        open={uploading}
        onOpenChange={setUploading}
        dropped={dropped}
        onTaken={takeDropped}
      />

      <ConfirmBulkDelete
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        count={toDelete?.length ?? 0}
        noun={NOUN}
        description="They are removed for good. Anything using one, like a post or a team member, loses that file."
        onConfirm={() => toDelete && remove(toDelete)}
      />
    </div>
  );
}

function MediaTile({
  item,
  checked,
  selecting,
  onToggle,
  onOpen,
  onEdit,
  onDelete,
  animate,
}: {
  item: MediaItem;
  checked: boolean;
  selecting: boolean;
  onToggle: () => void;
  onOpen: () => void;
  /** Glides when the library is re-sorted; off beyond the first screens of a very long list. */
  animate: boolean;
  /** Opens the details panel, even in Edit mode. */
  onEdit: () => void;
  /** Absent for people who cannot delete files. */
  onDelete?: () => void;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const sortLayout = useSortLayout(animate);
  const tile = (
    <motion.div
      {...sortLayout}
      ref={anchor}
      className={cn(
        'group max-md:bg-muted relative aspect-square overflow-hidden rounded-md border',
        checked && 'ring-ring ring-2',
        // While its context menu is open, so it is clear which file the menu acts on.
        'group-data-popup-open/row-menu:ring-ring group-data-popup-open/row-menu:ring-2'
      )}
    >
      <RowCheckbox
        label={`Select ${item.filename}`}
        checked={checked}
        selecting={selecting}
        onToggle={onToggle}
        className="bg-background/80 absolute top-1.5 left-1.5 z-10 backdrop-blur-sm"
      />
      <button
        type="button"
        onClick={onOpen}
        className="focus-visible:ring-ring absolute inset-0 outline-none focus-visible:ring-2"
      >
        {isDocumentMime(item.mime) ? (
          <DocumentThumb
            item={item}
            width={320}
            className="size-full transition-opacity group-hover:opacity-80"
          />
        ) : (
          <img
            src={mediaSrc(item, 320)}
            alt={item.alt || item.filename}
            loading="lazy"
            style={focalStyle(item)}
            className="size-full object-cover transition-opacity group-hover:opacity-80"
          />
        )}
      </button>
      {/* A generic document cover already carries its own badge. */}
      {(!isDocumentMime(item.mime) || item.hasCover) && (
        <ExtensionBadge
          item={item}
          className="pointer-events-none absolute right-1.5 bottom-1.5 z-10"
        />
      )}
    </motion.div>
  );

  // In Edit mode a tap ticks; the menu would only get in the way, as in the lists.
  if (selecting) return tile;

  const { actions, destructive } = mediaMenu(item, { onToggle, onEdit, onDelete });

  return (
    <RowMenu
      actions={actions}
      destructive={destructive}
      anchorRef={anchor}
      previewClassName="p-0"
      preview={
        isDocumentMime(item.mime) ? (
          <DocumentThumb item={item} width={640} className="aspect-square w-full" />
        ) : (
          <img src={mediaSrc(item, 640)} alt="" className="aspect-square w-full object-cover" />
        )
      }
    >
      {tile}
    </RowMenu>
  );
}

/** The file's type (WEBP, PDF, DOCX…) on its picture, so a tile says what it is at a glance. */
function ExtensionBadge({ item, className }: { item: MediaItem; className?: string }) {
  return (
    <span
      className={cn(
        'bg-background/80 text-foreground rounded px-1.5 py-0.5 text-[0.625rem] leading-none font-semibold tracking-wide backdrop-blur-sm',
        className
      )}
    >
      {extensionLabel(item)}
    </span>
  );
}

/** The context menu a tile and a row share. */
function mediaMenu(
  item: MediaItem,
  {
    onToggle,
    onEdit,
    onDelete,
  }: { onToggle: () => void; onEdit: () => void; onDelete?: () => void }
) {
  const actions: RowMenuItem[] = [
    { label: 'Open', icon: <PanelRightIcon aria-hidden />, onSelect: onEdit },
    { label: 'Select', icon: <CircleCheckIcon aria-hidden />, onSelect: onToggle },
    { label: 'Copy link', icon: <LinkIcon aria-hidden />, onSelect: () => void copyLink(item) },
    { label: 'Download', icon: <DownloadIcon aria-hidden />, onSelect: () => download(item) },
  ];
  const destructive: RowMenuItem[] = onDelete
    ? [{ label: 'Delete', icon: <Trash2Icon aria-hidden />, onSelect: onDelete }]
    : [];
  return { actions, destructive };
}

/** A file as a row: a small picture, its name and facts, then its type, size and date. */
function MediaRow({
  item,
  zone,
  checked,
  selecting,
  onToggle,
  onOpen,
  onEdit,
  onDelete,
  animate,
}: {
  item: MediaItem;
  zone: string;
  animate: boolean;
  checked: boolean;
  selecting: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const sortLayout = useSortLayout(animate);
  const isDocument = isDocumentMime(item.mime);
  const row = (
    <div
      ref={anchor}
      className={cn(
        'group hover:bg-accent/40 flex items-center gap-3 px-3 py-2 transition-colors max-md:px-4',
        checked && 'bg-accent/60',
        'group-data-popup-open/row-menu:bg-accent/60'
      )}
    >
      <RowCheckbox
        label={`Select ${item.filename}`}
        checked={checked}
        selecting={selecting}
        onToggle={onToggle}
      />
      <button
        type="button"
        onClick={onOpen}
        className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2"
      >
        <span className="bg-muted relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-md border p-0.5">
          {!isDocument ? (
            <img
              src={mediaSrc(item, 320)}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : item.hasCover ? (
            // The whole first page, as a reader's sidebar shows it.
            <img
              src={mediaSrc(item, 320)}
              alt=""
              loading="lazy"
              className="max-h-full max-w-full rounded-[2px] bg-white object-contain shadow-sm ring-1 ring-black/10"
            />
          ) : (
            <FileTextIcon aria-hidden className="text-muted-foreground size-5" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{item.filename}</span>
          <span className="text-muted-foreground block truncate text-xs md:hidden">
            {extensionLabel(item)} · {fileFacts(item)}
          </span>
        </span>
      </button>
      <span className="text-muted-foreground w-16 shrink-0 text-xs max-md:hidden">
        {extensionLabel(item)}
      </span>
      <span className="text-muted-foreground w-40 shrink-0 text-xs max-md:hidden">
        {fileFacts(item)}
      </span>
      <span className="text-muted-foreground w-28 shrink-0 text-xs max-lg:hidden">
        {formatDate(item.createdAt, zone)}
      </span>
    </div>
  );

  if (selecting) return <motion.li {...sortLayout}>{row}</motion.li>;

  const { actions, destructive } = mediaMenu(item, { onToggle, onEdit, onDelete });
  return (
    <motion.li {...sortLayout}>
      <RowMenu
        actions={actions}
        destructive={destructive}
        anchorRef={anchor}
        previewClassName="p-0"
        preview={
          isDocument ? (
            <DocumentThumb item={item} width={640} className="aspect-square w-full" />
          ) : (
            <img src={mediaSrc(item, 640)} alt="" className="aspect-square w-full object-cover" />
          )
        }
      >
        {row}
      </RowMenu>
    </motion.li>
  );
}
