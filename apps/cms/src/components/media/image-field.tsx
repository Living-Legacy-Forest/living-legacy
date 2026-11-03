// An image picked from the Media library, with its alt text, for any form
// that stores a media id (posts, team members, testimonials). The alt text
// belongs to the image itself, so it is edited here and saved straight to the
// library: the same photo used twice describes itself the same way.
//
// A new image can be dropped on the field or chosen from the computer, and is
// cropped to the shape the website shows it in before it is uploaded.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SearchInput, matchesSearch } from '@/components/bulk/list-tools';
import { UploadIcon } from '@/components/icons';
import { useImageUpload } from '@/components/media/image-crop-dialog';
import { ImageDropZone, useFileChooser, useImageDrop } from '@/components/media/image-drop-zone';
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
  aspect = shape === 'square' ? 1 : undefined,
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
  /** The width / height the website shows it at; uploads are cropped to it. */
  aspect?: number;
}) {
  const { item, missing, update } = useMediaItem(mediaId);
  const [picking, setPicking] = useState(false);
  const use = (picked: MediaItem) => {
    update(picked);
    onChange(picked.id);
  };
  const upload = useImageUpload({ aspect, onUploaded: use });

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
        <ImageDropZone
          id={`${id}-choose`}
          busy={upload.uploading}
          onFiles={(files) => upload.start(files[0]!)}
          description={
            aspect ? 'It is cropped to the shape the website shows.' : 'JPG, PNG, WebP or GIF.'
          }
        >
          <Button type="button" size="sm" variant="ghost" onClick={() => setPicking(true)}>
            From Media
          </Button>
        </ImageDropZone>
      )}

      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        selectedId={mediaId}
        aspect={aspect}
        onSelect={(picked) => {
          use(picked);
          setPicking(false);
        }}
      />
      {upload.dialog}
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
  aspect,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId: string | null;
  /** Uploads made here are cropped to it; blank lets the editor choose. */
  aspect?: number;
  onSelect: (item: MediaItem) => void;
}) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string | null>(selectedId);
  const upload = useImageUpload({
    aspect,
    onUploaded: (item) => {
      remember(item);
      setItems((list) => [item, ...(list ?? [])]);
      setChosen(item.id);
      setQuery('');
    },
  });
  const chooser = useFileChooser((files) => upload.start(files[0]!));
  const { over, dropProps } = useImageDrop((files) => upload.start(files[0]!), upload.uploading);

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

  const visible = (items ?? []).filter((m) => matchesSearch(query, [m.filename, m.alt, m.caption]));
  const picked = items?.find((m) => m.id === chosen) ?? null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose an image</DialogTitle>
            <DialogDescription>
              Pick one from Media, or upload a new one. You can drop images here too.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              label="Search media"
              placeholder="Search filenames and alt text"
              value={query}
              onChange={setQuery}
            />
            {chooser.element}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto"
              disabled={upload.uploading}
              onClick={chooser.open}
            >
              {upload.uploading ? <Spinner /> : <UploadIcon aria-hidden data-icon="inline-start" />}
              Upload
            </Button>
          </div>

          <div
            {...dropProps}
            className={cn(
              '-mx-1 min-h-48 flex-1 overflow-y-auto rounded-md px-1 py-1 transition-colors',
              over && 'bg-accent/50 ring-ring ring-2'
            )}
          >
            {items === null ? (
              <div className="flex h-48 items-center justify-center">
                <Spinner />
              </div>
            ) : visible.length === 0 ? (
              <p className="text-muted-foreground flex h-48 items-center justify-center text-center text-sm">
                {items.length === 0
                  ? 'No images yet. Upload one, or drop it here.'
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
      {upload.dialog}
    </>
  );
}
