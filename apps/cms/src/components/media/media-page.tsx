import { useRef, useState } from 'react';
import {
  ConfirmBulkDelete,
  RowCheckbox,
  SearchInput,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/bulk/list-tools';
import { ImageIcon, Trash2Icon, UploadIcon } from '@/components/icons';
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
import { formatBytes } from '@/lib/format';
import { IMAGE_ACCEPT, uploadMedia } from '@/lib/upload-media';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import { type MediaItem, type MediaListData, deleteMedia, updateMedia } from '@/server/media';

const NOUN: [string, string] = ['file', 'files'];

export function MediaPage({ data }: { data: MediaListData }) {
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
      (n) => `${n} ${n === 1 ? 'file' : 'files'} uploaded.`
    );
  }

  async function removeChecked() {
    const ids = selection.checkedIds;
    const result = await run(
      () => deleteMedia({ data: { ids } }),
      (r) => `${r.removed} ${r.removed === 1 ? NOUN[0] : NOUN[1]} removed.`
    );
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
        <h1 className="mr-auto text-xl">Media</h1>
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
              <ImageIcon aria-hidden />
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
            onDelete={() => setConfirmDelete(true)}
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
            <MediaEditForm key={editing.id} item={editing} onClose={() => setEditingId(null)} />
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
          src={item.url}
          alt={item.alt || item.filename}
          loading="lazy"
          className="size-full object-cover transition-opacity group-hover:opacity-80"
        />
      </button>
    </div>
  );
}

function MediaEditForm({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const [alt, setAlt] = useState(item.alt);
  const [caption, setCaption] = useState(item.caption);
  // Deleting asks again in the footer itself, rather than in a second modal.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { run, pending } = useAction();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(
      () => updateMedia({ data: { id: item.id, alt, caption } }),
      'Media saved.'
    );
    if (result !== undefined) onClose();
  }

  async function remove() {
    const result = await run(() => deleteMedia({ data: { ids: [item.id] } }), 'File removed.');
    if (result) onClose();
  }

  return (
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
          src={item.url}
          alt={item.alt || item.filename}
          className="bg-muted max-h-72 w-full rounded-md border object-contain"
        />
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
      </div>
      <SheetFooter>
        {confirmingDelete ? (
          <>
            <p className="text-sm">
              Delete this file for good? Anything using it, like a post or a team member, loses that
              image.
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
          </>
        )}
      </SheetFooter>
    </form>
  );
}
