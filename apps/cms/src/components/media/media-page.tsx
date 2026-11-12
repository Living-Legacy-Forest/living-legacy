import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
  ConfirmBulkDelete,
  RowCheckbox,
  SearchInput,
  SelectionBar,
  useSelection,
} from '@/components/list/list-tools';
import {
  ArrowRightLeft,
  CircleCheckIcon,
  CropIcon,
  DownloadIcon,
  LinkIcon,
  MediaIcon,
  PanelRightIcon,
  Trash2Icon,
  UploadIcon,
} from '@/components/icons';
import { FormCell, FormSection } from '@/components/form-cells';
import { DialogActions, ListDialog } from '@/components/list/list-page';
import { type RowMenuItem, RowMenu } from '@/components/list/list-row';
import { PageActions } from '@/components/shell/page-actions';
import { ImageCropDialog } from '@/components/media/image-crop-dialog';
import { MediaUsageList } from '@/components/media/media-usage';
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
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useLoadMore } from '@/hooks/use-load-more';
import { MEDIA_MAX_SHOWN, MEDIA_PAGE_SIZE } from '@/lib/media-paging';
import { useIsMobile } from '@/hooks/use-mobile';
import { readableError } from '@/lib/errors';
import { notify, removedNotice } from '@/lib/notify';
import { splitFilename } from '@/lib/filename';
import { formatBytes } from '@/lib/format';
import { canCrop } from '@/lib/prepare-image';
import { IMAGE_ACCEPT, mediaSrc, uploadMedia } from '@/lib/upload-media';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import { type MediaItem, type MediaListData, deleteMedia, updateMedia } from '@/server/media';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { RevealWords } from '@/components/dashboard/reveal-words';

const NOUN: [string, string] = ['file', 'files'];

export function MediaPage({
  data,
  search,
  canDelete,
  initialSelected,
}: {
  data: MediaListData;
  search: { q?: string };
  canDelete: boolean;
  /** Opened in the panel on arrival. */
  initialSelected?: string;
}) {
  const items = data.items;
  const [query, setQuery] = useState(search.q ?? '');
  const navigate = useNavigate({ from: '/media/' });
  const [editingId, setEditingId] = useState<string | null>(initialSelected ?? null);
  const isPhone = useIsMobile();
  // Ticked files, or the one a context menu deletes; null when nothing is waiting.
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const selection = useSelection(items.map((m) => m.id));
  const { run, pending } = useAction();
  const router = useRouter();
  const editing =
    items.find((m) => m.id === editingId) ??
    (data.included?.id === editingId ? data.included : null);

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
  const libraryEmpty = data.total === 0 && !search.q;

  async function upload(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) return;
    // One toast follows the whole batch: which file is going up, then the outcome.
    const toastId = `media-upload-${Date.now()}`;
    const total = list.length;
    await run(
      async () => {
        for (const [i, file] of list.entries()) {
          notify.loading({
            id: toastId,
            title: total === 1 ? 'Uploading image' : `Uploading ${i + 1} of ${total}`,
            description: file.name,
          });
          try {
            await uploadMedia(file);
            // Show it in the grid now, while the rest are still uploading.
            void router.invalidate();
          } catch (error) {
            const before = i === 0 ? '' : ` The ${i === 1 ? 'one' : i} before it uploaded.`;
            throw new Error(`${file.name}: ${readableError(error)}${before}`);
          }
        }
        return total;
      },
      {
        toastId,
        success: (n) => ({
          title: n === 1 ? 'Image uploaded' : `${n} images uploaded`,
          description: 'Resized for the web and ready to use in posts and pages.',
        }),
        error: 'Could not upload',
      }
    );
  }

  async function remove(ids: string[]) {
    const result = await run(() => deleteMedia({ data: { ids } }), {
      success: (r) => removedNotice(r.removed, NOUN),
      error: 'Could not remove',
    });
    if (!result) return;
    if (editingId && ids.includes(editingId)) setEditingId(null);
    selection.clear();
  }

  const revealing = useRevealOnce();

  return (
    <div
      data-slot="stack-page"
      data-revealing={revealing || undefined}
      className="flex flex-1 flex-col gap-4"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void upload(e.dataTransfer.files);
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
        <input
          ref={fileInput}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files);
            e.target.value = '';
          }}
        />
        <Button
          size="sm"
          className="max-md:hidden"
          disabled={pending}
          onClick={() => fileInput.current?.click()}
        >
          {pending ? <Spinner /> : <UploadIcon aria-hidden data-icon="inline-start" />}
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
            label: 'Upload images',
            onClick: () => !pending && fileInput.current?.click(),
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
              Upload images for posts, team members and testimonials. Drag and drop works too.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => fileInput.current?.click()}>
              <UploadIcon aria-hidden data-icon="inline-start" />
              Upload images
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border',
            // Phones: no frame; the grid runs edge to edge, as Photos does.
            'max-md:flex-none max-md:overflow-visible max-md:rounded-none max-md:border-0',
            dragOver && 'ring-ring ring-2'
          )}
        >
          <SelectionBar
            selection={selection}
            visibleIds={items.map((m) => m.id)}
            title="All"
            total={data.total}
            pending={pending}
            onDelete={canDelete ? () => setToDelete(selection.checkedIds) : undefined}
          />
          {items.length === 0 ? (
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm">
              No media match that search.
              <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
                Clear search
              </Button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3 max-md:-mx-4 max-md:overflow-visible max-md:p-0">
              <div className="grid grid-cols-2 gap-3 max-md:grid-cols-3 max-md:gap-0.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {items.map((m) => (
                  <MediaTile
                    key={m.id}
                    item={m}
                    checked={selection.isChecked(m.id)}
                    selecting={selection.selecting || selection.checkedIds.length > 0}
                    onToggle={() => selection.toggle(m.id)}
                    // In Edit mode a tap ticks the tile, as in Photos.
                    onOpen={() =>
                      selection.selecting ? selection.toggle(m.id) : setEditingId(m.id)
                    }
                    onEdit={() => setEditingId(m.id)}
                    onDelete={canDelete ? () => setToDelete([m.id]) : undefined}
                  />
                ))}
              </div>
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

      <ConfirmBulkDelete
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        count={toDelete?.length ?? 0}
        noun={NOUN}
        description="They are removed for good. Anything using one, like a post or a team member, loses that image."
        onConfirm={() => toDelete && remove(toDelete)}
      />

      {/* Phones get the iOS form sheet the other pages use; wider screens a side panel. */}
      {isPhone ? (
        <ListDialog
          open={editing !== null}
          onClose={() => setEditingId(null)}
          title={editing?.filename ?? ''}
          description={editing ? fileFacts(editing) : undefined}
        >
          {editing && (
            <MediaEditForm
              key={editing.id}
              item={editing}
              canDelete={canDelete}
              onClose={() => setEditingId(null)}
              onOpen={setEditingId}
              inSheet
            />
          )}
        </ListDialog>
      ) : (
        <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditingId(null)}>
          <SheetContent>
            {editing && (
              <MediaEditForm
                key={editing.id}
                item={editing}
                canDelete={canDelete}
                onClose={() => setEditingId(null)}
                onOpen={setEditingId}
              />
            )}
          </SheetContent>
        </Sheet>
      )}
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
}: {
  item: MediaItem;
  checked: boolean;
  selecting: boolean;
  onToggle: () => void;
  onOpen: () => void;
  /** Opens the details panel, even in Edit mode. */
  onEdit: () => void;
  /** Absent for people who cannot delete files. */
  onDelete?: () => void;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const tile = (
    <div
      ref={anchor}
      className={cn(
        'group max-md:bg-muted relative aspect-square overflow-hidden rounded-md border max-md:rounded-none max-md:border-0',
        checked && 'ring-ring ring-2 max-md:ring-inset',
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
        <img
          src={mediaSrc(item, 320)}
          alt={item.alt || item.filename}
          loading="lazy"
          className="size-full object-cover transition-opacity group-hover:opacity-80"
        />
      </button>
    </div>
  );

  // In Edit mode a tap ticks; the menu would only get in the way, as in the lists.
  if (selecting) return tile;

  const actions: RowMenuItem[] = [
    { label: 'Open', icon: <PanelRightIcon aria-hidden />, onSelect: onEdit },
    { label: 'Select', icon: <CircleCheckIcon aria-hidden />, onSelect: onToggle },
    { label: 'Copy link', icon: <LinkIcon aria-hidden />, onSelect: () => void copyLink(item) },
    { label: 'Download', icon: <DownloadIcon aria-hidden />, onSelect: () => download(item) },
  ];
  const destructive: RowMenuItem[] = onDelete
    ? [{ label: 'Delete', icon: <Trash2Icon aria-hidden />, onSelect: onDelete }]
    : [];

  return (
    <RowMenu
      actions={actions}
      destructive={destructive}
      anchorRef={anchor}
      previewClassName="p-0"
      preview={
        <img src={mediaSrc(item, 640)} alt="" className="aspect-square w-full object-cover" />
      }
    >
      {tile}
    </RowMenu>
  );
}

/** The file's full address, for pasting into an email or another site. */
async function copyLink(item: MediaItem) {
  try {
    await navigator.clipboard.writeText(new URL(item.url, window.location.origin).href);
    notify.success({ title: 'Link copied', description: `${item.filename} is ready to paste.` });
  } catch {
    notify.error('Could not copy the link', 'Open the file and copy its address instead.');
  }
}

/** Saves the original file under its own name. */
function download(item: MediaItem) {
  const link = document.createElement('a');
  link.href = item.url;
  link.download = item.filename;
  link.click();
}

/** Size and dimensions, under the file name. */
function fileFacts(item: MediaItem) {
  return `${formatBytes(item.size)}${item.width && item.height ? ` · ${item.width}×${item.height}` : ''}`;
}

function MediaEditForm({
  item,
  canDelete,
  onClose,
  onOpen,
  inSheet = false,
}: {
  item: MediaItem;
  /** Deleting a file is permanent, so only roles with content:purge see it. */
  canDelete: boolean;
  onClose: () => void;
  /** Shows another file in the panel, e.g. a cropped copy. */
  onOpen: (id: string) => void;
  /** In the phone's form sheet (ListDialog), which has the title and Save in its bar. */
  inSheet?: boolean;
}) {
  const router = useRouter();
  const { base: originalName, ext } = splitFilename(item.filename);
  const [name, setName] = useState(originalName);
  const [alt, setAlt] = useState(item.alt);
  const [caption, setCaption] = useState(item.caption);
  // The file being cropped, fetched back from the library.
  const [cropping, setCropping] = useState<File | null>(null);
  const [loadingCrop, setLoadingCrop] = useState(false);
  // Deleting asks again in the footer itself, rather than in a second modal.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // The file picked to go behind this image, waiting for a yes.
  const [replacement, setReplacement] = useState<File | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const { run, pending } = useAction();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const renamed = name.trim() !== originalName;
    const result = await run(
      () =>
        updateMedia({
          data: { id: item.id, alt, caption, ...(renamed && { filename: name }) },
        }),
      {
        success: {
          title: 'Details saved',
          description: renamed
            ? 'The new name shows in the media library. Anything using the file is unchanged.'
            : 'The alt text and caption are updated in the media library.',
        },
        error: 'Could not save the details',
      }
    );
    if (result !== undefined) onClose();
  }

  async function startCrop() {
    setLoadingCrop(true);
    try {
      const res = await fetch(`${item.url}?v=${item.version}`);
      if (!res.ok) throw new Error('Could not load this image.');
      const blob = await res.blob();
      setCropping(new File([blob], item.filename, { type: blob.type || item.mime }));
    } catch (error) {
      notify.error('Could not open the cropper', error);
    } finally {
      setLoadingCrop(false);
    }
  }

  // A crop is saved as a new file, so anything already using this one keeps
  // it as it is. The copy takes over the alt text and caption.
  async function saveCopy(file: File) {
    const copy = await uploadMedia(file);
    if (item.alt || item.caption) {
      await updateMedia({ data: { id: copy.id, alt: item.alt, caption: item.caption } });
    }
    setCropping(null);
    await router.invalidate();
    notify.success({
      title: 'Cropped copy saved',
      description: 'The original is unchanged, so anything using it stays as it is.',
    });
    onOpen(copy.id);
  }

  // Same id and URL, so every post, page and person using it shows the new file.
  async function replaceFile() {
    if (!replacement) return;
    const result = await run(() => uploadMedia(replacement, item.id), {
      success: {
        title: 'File replaced',
        description:
          'Everything using this image shows the new file. The website updates within a day.',
      },
      error: 'Could not replace the file',
    });
    if (result !== undefined) setReplacement(null);
  }

  async function remove() {
    const result = await run(() => deleteMedia({ data: { ids: [item.id] } }), {
      success: removedNotice(1, NOUN),
      error: 'Could not remove the file',
    });
    if (result) onClose();
  }

  const preview = (
    <img
      src={mediaSrc(item, 1280)}
      alt={item.alt || item.filename}
      className="bg-muted max-h-72 w-full rounded-md border object-contain"
    />
  );
  const crop = (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {canCrop({ type: item.mime }) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loadingCrop || pending}
            onClick={startCrop}
          >
            {loadingCrop ? <Spinner /> : <CropIcon aria-hidden data-icon="inline-start" />}
            Crop a copy
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => replaceInput.current?.click()}
        >
          <ArrowRightLeft aria-hidden data-icon="inline-start" />
          Replace file
        </Button>
        <input
          ref={replaceInput}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            setReplacement(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
      </div>
      {replacement ? (
        <div className="bg-muted/50 grid gap-3 rounded-md border p-3">
          <p className="text-ui">
            Replace with <span className="font-medium break-all">{replacement.name}</span>?
            Everything using this image shows the new file. The alt text and caption stay.
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={replaceFile}>
              {pending ? <Spinner /> : null}
              Replace
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setReplacement(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          A crop is saved as a new file. Replacing keeps this image's address.
        </p>
      )}
    </div>
  );
  const nameInput = (
    <InputGroup>
      <InputGroupInput
        id="m-name"
        required
        maxLength={120}
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-describedby={ext ? 'm-name-ext' : undefined}
      />
      {ext && (
        <InputGroupAddon align="inline-end">
          <InputGroupText id="m-name-ext">{ext}</InputGroupText>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
  const altInput = (
    <Input
      id="m-alt"
      maxLength={300}
      value={alt}
      onChange={(e) => setAlt(e.target.value)}
      placeholder="Describes the image for screen readers and SEO"
    />
  );
  const captionInput = (
    <Textarea
      id="m-caption"
      rows={2}
      maxLength={500}
      value={caption}
      onChange={(e) => setCaption(e.target.value)}
    />
  );
  const cropDialog = (
    <ImageCropDialog file={cropping} onCancel={() => setCropping(null)} onDone={saveCopy} />
  );

  if (inSheet) {
    return (
      <>
        <form onSubmit={save} className="space-y-7">
          <FormSection>
            {preview}
            {crop}
          </FormSection>
          <FormSection>
            <FormCell label="Name" htmlFor="m-name">
              {nameInput}
            </FormCell>
            <FormCell label="Alt text" htmlFor="m-alt">
              {altInput}
            </FormCell>
            <FormCell label="Caption" htmlFor="m-caption">
              {captionInput}
            </FormCell>
          </FormSection>
          <MediaUsageList id={item.id} />
          <DialogActions
            start={
              canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2Icon aria-hidden data-icon="inline-start" />
                  Delete
                </Button>
              )
            }
          >
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner /> : null}
              Save
            </Button>
          </DialogActions>
        </form>
        <ConfirmBulkDelete
          open={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          count={1}
          noun={NOUN}
          description="It is removed for good. Anything using it, like a post or a team member, loses that image."
          onConfirm={remove}
        />
        {cropDialog}
      </>
    );
  }

  return (
    <>
      <form onSubmit={save} className="flex min-h-0 flex-1 flex-col gap-4">
        <SheetHeader>
          <SheetTitle className="truncate pr-8">{item.filename}</SheetTitle>
          <SheetDescription>{fileFacts(item)}</SheetDescription>
        </SheetHeader>
        <div className="grid flex-1 auto-rows-min gap-6 overflow-y-auto px-4">
          {preview}
          {crop && <div className="-mt-3">{crop}</div>}
          <div className="grid gap-3">
            <Label htmlFor="m-name">Name</Label>
            {nameInput}
            <p className="text-muted-foreground -mt-1 text-xs">
              Only the name in the library changes. Anything using this file keeps working.
            </p>
          </div>
          <div className="grid gap-3">
            <Label htmlFor="m-alt">Alt text</Label>
            {altInput}
          </div>
          <div className="grid gap-3">
            <Label htmlFor="m-caption">Caption</Label>
            {captionInput}
          </div>
          <MediaUsageList id={item.id} />
        </div>
        <SheetFooter>
          {confirmingDelete ? (
            <>
              <p className="text-sm">
                Delete this file for good? Anything using it, like a post or a team member, loses
                that image.
              </p>
              <Button type="button" variant="destructive" disabled={pending} onClick={remove}>
                {pending ? <Spinner /> : null}
                Delete
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner /> : null}
                Save changes
              </Button>
              <SheetClose render={<Button type="button" variant="outline" />}>Close</SheetClose>
              {canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2Icon aria-hidden data-icon="inline-start" />
                  Delete
                </Button>
              )}
            </>
          )}
        </SheetFooter>
      </form>
      {cropDialog}
    </>
  );
}
