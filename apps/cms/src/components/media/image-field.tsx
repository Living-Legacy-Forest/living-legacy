// An image picked from the Media library, with its alt text, for any form
// that stores a media id (posts, team members, testimonials). The alt text
// belongs to the image itself, so it is edited here and saved straight to the
// library: the same photo used twice describes itself the same way.
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { SearchInput, matchesSearch } from '@/components/bulk/list-tools';
import { ImageIcon, UploadIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { readableError } from '@/lib/errors';
import { IMAGE_ACCEPT, uploadMedia } from '@/lib/upload-media';
import { cn } from '@/lib/utils';
import { type MediaItem, getMediaItems, listMedia, updateMedia } from '@/server/media';

// Images seen this session, so reopening a form shows its image at once.
const known = new Map<string, MediaItem>();
const remember = (item: MediaItem) => known.set(item.id, item);

export function useMediaItem(id: string | null) {
  const [item, setItem] = useState<MediaItem | null>(id ? (known.get(id) ?? null) : null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setMissing(false);
    if (!id) return setItem(null);
    const cached = known.get(id);
    if (cached) return setItem(cached);
    setItem(null);
    let current = true;
    getMediaItems({ data: { ids: [id] } })
      .then(([found]) => {
        if (!current) return;
        if (found) remember(found);
        setItem(found ?? null);
        setMissing(!found);
      })
      .catch(() => current && setMissing(true));
    return () => {
      current = false;
    };
  }, [id]);

  const update = (next: MediaItem) => {
    remember(next);
    setItem(next);
  };
  return { item, missing, update };
}

export function ImageField({
  id,
  label,
  description,
  mediaId,
  onChange,
  shape = 'wide',
  hideLabel = false,
}: {
  id: string;
  label: string;
  /** When a section heading above already names the field. */
  hideLabel?: boolean;
  description?: string;
  mediaId: string | null;
  onChange: (mediaId: string | null) => void;
  /** Featured and share images are wide; portraits are square. */
  shape?: 'wide' | 'square';
}) {
  const { item, missing, update } = useMediaItem(mediaId);
  const [picking, setPicking] = useState(false);

  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <Label
          htmlFor={mediaId ? `${id}-alt` : `${id}-choose`}
          className={cn(hideLabel && 'sr-only')}
        >
          {label}
        </Label>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>

      {mediaId ? (
        <div className={cn('flex gap-3', shape === 'wide' && 'flex-col')}>
          <div
            className={cn(
              'bg-muted relative shrink-0 overflow-hidden rounded-md border',
              shape === 'wide' ? 'aspect-video w-full' : 'size-24'
            )}
          >
            {item ? (
              <img
                src={item.url}
                alt={item.alt || item.filename}
                className="size-full object-cover"
              />
            ) : (
              <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
                {missing ? 'Image not found' : <Spinner />}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            {item && <AltText id={`${id}-alt`} item={item} onSaved={update} />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
                Change
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => onChange(null)}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          id={`${id}-choose`}
          type="button"
          onClick={() => setPicking(true)}
          className={cn(
            'text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:ring-ring flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed text-xs transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-60',
            shape === 'wide' ? 'aspect-video w-full' : 'size-24'
          )}
        >
          <ImageIcon aria-hidden className="size-4" />
          Choose image
        </button>
      )}

      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        selectedId={mediaId}
        onSelect={(picked) => {
          update(picked);
          onChange(picked.id);
          setPicking(false);
        }}
      />
    </div>
  );
}

function AltText({
  id,
  item,
  onSaved,
}: {
  id: string;
  item: MediaItem;
  onSaved: (item: MediaItem) => void;
}) {
  const [alt, setAlt] = useState(item.alt);
  const [saving, setSaving] = useState(false);

  useEffect(() => setAlt(item.alt), [item.id, item.alt]);

  async function save() {
    const next = alt.trim();
    if (next === item.alt) return;
    setSaving(true);
    try {
      await updateMedia({ data: { id: item.id, alt: next } });
      onSaved({ ...item, alt: next });
      toast.success('Alt text saved.');
    } catch (error) {
      toast.error(readableError(error));
      setAlt(item.alt);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          id={id}
          aria-label="Alt text"
          maxLength={300}
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void save();
            }
          }}
          placeholder="Alt text: describe the image"
          className="pr-8"
        />
        {saving && (
          <Spinner className="text-muted-foreground absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2" />
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        {item.alt ? 'Saved with the image in Media.' : 'Needed for screen readers and search.'}
      </p>
    </div>
  );
}

/** The Media library as a picker: choose an image, or upload one first. */
export function MediaPicker({
  open,
  onOpenChange,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId: string | null;
  onSelect: (item: MediaItem) => void;
}) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string | null>(selectedId);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setChosen(selectedId);
    setQuery('');
    let current = true;
    listMedia()
      .then((list) => {
        if (!current) return;
        list.forEach(remember);
        setItems(list);
      })
      .catch((error) => toast.error(readableError(error)));
    return () => {
      current = false;
    };
  }, [open, selectedId]);

  async function upload(file: File) {
    setUploading(true);
    try {
      const item = await uploadMedia(file);
      remember(item);
      setItems((list) => [item, ...(list ?? [])]);
      setChosen(item.id);
      setQuery('');
    } catch (error) {
      toast.error(readableError(error));
    } finally {
      setUploading(false);
    }
  }

  const visible = (items ?? []).filter((m) => matchesSearch(query, [m.filename, m.alt, m.caption]));
  const picked = items?.find((m) => m.id === chosen) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose an image</DialogTitle>
          <DialogDescription>Pick one from Media, or upload a new one.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            label="Search media"
            placeholder="Search filenames and alt text"
            value={query}
            onChange={setQuery}
          />
          <input
            ref={fileInput}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? <Spinner /> : <UploadIcon aria-hidden data-icon="inline-start" />}
            Upload
          </Button>
        </div>

        <div className="-mx-1 min-h-48 flex-1 overflow-y-auto px-1 py-1">
          {items === null ? (
            <div className="flex h-48 items-center justify-center">
              <Spinner />
            </div>
          ) : visible.length === 0 ? (
            <p className="text-muted-foreground flex h-48 items-center justify-center text-center text-sm">
              {items.length === 0
                ? 'No images yet. Upload one to get started.'
                : 'No images match.'}
            </p>
          ) : (
            <div
              role="listbox"
              aria-label="Images"
              className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5"
            >
              {visible.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={m.id === chosen}
                  onClick={() => setChosen(m.id)}
                  onDoubleClick={() => onSelect(m)}
                  className={cn(
                    'focus-visible:ring-ring relative aspect-square overflow-hidden rounded-md border outline-none focus-visible:ring-2',
                    m.id === chosen && 'ring-foreground ring-2 ring-offset-1'
                  )}
                >
                  <img
                    src={m.url}
                    alt={m.alt || m.filename}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-muted-foreground min-w-0 truncate text-xs">
            {picked ? picked.filename : 'No image selected'}
          </p>
          <div className="flex gap-2">
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="button" disabled={!picked} onClick={() => picked && onSelect(picked)}>
              Use image
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
