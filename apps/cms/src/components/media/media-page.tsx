import { useRouter } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import {
  ConfirmBulkDelete,
  RowCheckbox,
  SearchInput,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/list/list-tools';
import { CropIcon, MediaIcon, Trash2Icon, UploadIcon } from '@/components/icons';
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
import { notify, removedNotice } from '@/lib/notify';
import { formatBytes } from '@/lib/format';
import { canCrop } from '@/lib/prepare-image';
import { IMAGE_ACCEPT, uploadMedia } from '@/lib/upload-media';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import { type MediaItem, type MediaListData, deleteMedia, updateMedia } from '@/server/media';

const NOUN: [string, string] = ['file', 'files'];

export function MediaPage({ data, canDelete }: { data: MediaListData; canDelete: boolean }) {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const selection = useSelection(data.map((m) => m.id));
  const { run, pending } = useAction();

  const visible = data.filter((m) => matchesSearch(query, [m.filename, m.alt, m.caption]));
  const editing = data.find((m) => m.id === editingId) ?? null;

  async function upload(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) return;
    await run(
      async () => {
        for (const file of list) await uploadMedia(file);
        return list.length;
      },
      {
        success: (n) => ({
          title: n === 1 ? 'Image uploaded' : `${n} images uploaded`,
          description: 'Resized for the web and ready to use in posts and pages.',
        }),
        error: 'Could not upload',
      }
    );
  }

  async function removeChecked() {
    const ids = selection.checkedIds;
    const result = await run(() => deleteMedia({ data: { ids } }), {
      success: (r) => removedNotice(r.removed, NOUN),
      error: 'Could not remove',
    });
    if (!result) return;
    if (editingId && ids.includes(editingId)) setEditingId(null);
    selection.clear();
  }

  return (
    <div
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
          Media
        </h1>
        {data.length > 0 && (
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
        <Button size="sm" disabled={pending} onClick={() => fileInput.current?.click()}>
          {pending ? <Spinner /> : <UploadIcon aria-hidden data-icon="inline-start" />}
          Upload
        </Button>
      </div>

      {data.length === 0 ? (
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
            dragOver && 'ring-ring ring-2'
          )}
        >
          <SelectionBar
            selection={selection}
            visibleIds={visible.map((m) => m.id)}
            title="All"
            total={data.length}
            pending={pending}
            onDelete={canDelete ? () => setConfirmDelete(true) : undefined}
          />
          {visible.length === 0 ? (
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm">
              No media match that search.
              <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
                Clear search
              </Button>
            </div>
          ) : (
            <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {visible.map((m) => (
                <MediaTile
                  key={m.id}
                  item={m}
                  checked={selection.isChecked(m.id)}
                  selecting={selection.checkedIds.length > 0}
                  onToggle={() => selection.toggle(m.id)}
                  onOpen={() => setEditingId(m.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmBulkDelete
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        count={selection.checkedIds.length}
        noun={NOUN}
        description="They are removed for good. Anything using one, like a post or a team member, loses that image."
        onConfirm={removeChecked}
      />

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
    </div>
  );
}

function MediaTile({
  item,
  checked,
  selecting,
  onToggle,
  onOpen,
}: {
  item: MediaItem;
  checked: boolean;
  selecting: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      className={cn(
        'group relative aspect-square overflow-hidden rounded-md border',
        checked && 'ring-ring ring-2'
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
          src={`${item.url}?w=640`}
          alt={item.alt || item.filename}
          loading="lazy"
          className="size-full object-cover transition-opacity group-hover:opacity-80"
        />
      </button>
    </div>
  );
}

function MediaEditForm({
  item,
  canDelete,
  onClose,
  onOpen,
}: {
  item: MediaItem;
  /** Deleting a file is permanent, so only roles with content:purge see it. */
  canDelete: boolean;
  onClose: () => void;
  /** Shows another file in the panel, e.g. a cropped copy. */
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const [alt, setAlt] = useState(item.alt);
  const [caption, setCaption] = useState(item.caption);
  // The file being cropped, fetched back from the library.
  const [cropping, setCropping] = useState<File | null>(null);
  const [loadingCrop, setLoadingCrop] = useState(false);
  // Deleting asks again in the footer itself, rather than in a second modal.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { run, pending } = useAction();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(() => updateMedia({ data: { id: item.id, alt, caption } }), {
      success: {
        title: 'Details saved',
        description: 'The alt text and caption are updated in the media library.',
      },
      error: 'Could not save the details',
    });
    if (result !== undefined) onClose();
  }

  async function startCrop() {
    setLoadingCrop(true);
    try {
      const res = await fetch(item.url);
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

  async function remove() {
    const result = await run(() => deleteMedia({ data: { ids: [item.id] } }), {
      success: removedNotice(1, NOUN),
      error: 'Could not remove the file',
    });
    if (result) onClose();
  }

  return (
    <>
      <form onSubmit={save} className="flex min-h-0 flex-1 flex-col gap-4">
        <SheetHeader>
          <SheetTitle className="truncate pr-8">{item.filename}</SheetTitle>
          <SheetDescription>
            {formatBytes(item.size)}
            {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
          </SheetDescription>
        </SheetHeader>
        <div className="grid flex-1 auto-rows-min gap-6 overflow-y-auto px-4">
          <img
            src={`${item.url}?w=1280`}
            alt={item.alt || item.filename}
            className="bg-muted max-h-72 w-full rounded-md border object-contain"
          />
          {canCrop({ type: item.mime }) && (
            <div className="-mt-3 flex items-center gap-3">
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
              <p className="text-muted-foreground text-xs">The original stays as it is.</p>
            </div>
          )}
          <div className="grid gap-3">
            <Label htmlFor="m-alt">Alt text</Label>
            <Input
              id="m-alt"
              maxLength={300}
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Describes the image for screen readers and SEO"
            />
          </div>
          <div className="grid gap-3">
            <Label htmlFor="m-caption">Caption</Label>
            <Textarea
              id="m-caption"
              rows={2}
              maxLength={500}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
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
      <ImageCropDialog file={cropping} onCancel={() => setCropping(null)} onDone={saveCopy} />
    </>
  );
}
