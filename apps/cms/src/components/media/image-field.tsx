// An image picked from the Media library, with its alt text, for any form
// that stores a media id (posts, team members, testimonials). The alt text
// belongs to the image itself, so it is edited here and saved straight to the
// library: the same photo used twice describes itself the same way.
//
// A new image can be dropped on the field or chosen from the computer, and is
// cropped to the shape the website shows it in before it is uploaded.
import { useEffect, useRef, useState } from 'react';
import { mediaSrc } from '@/lib/upload-media';
import { SearchInput } from '@/components/list/list-tools';
import {} from '@/components/icons';
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
import { focalStyle } from '@/components/media/media-file';
import { Spinner } from '@/components/ui/spinner';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { useLoadMore } from '@/hooks/use-load-more';
import { SuggestButton } from '@/components/ai/suggest-button';
import { suggestAltText } from '@/server/ai';
import { type MediaItem, getMediaItems, listMedia, updateMedia } from '@/server/media';
import { isEnterKey } from '@/lib/keyboard';

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

/** Several images at once: one request, rather than one for each. */
export function useMediaItems(ids: string[]) {
  const [, refresh] = useState(0);
  const key = ids.join();
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    const unknown = ids.filter((id) => !known.has(id));
    if (unknown.length === 0) return setLoadedKey(key);
    let current = true;
    getMediaItems({ data: { ids: unknown } })
      .then((found) => found.forEach(remember))
      .catch(() => {})
      .finally(() => current && setLoadedKey(key));
    return () => {
      current = false;
    };
    // `key` is `ids`, by value.
  }, [key]);

  return {
    item: (id: string) => known.get(id) ?? null,
    /** Asked for and not there, rather than still on its way. */
    missing: (id: string) => loadedKey === key && !known.has(id),
    update: (next: MediaItem) => {
      remember(next);
      refresh((n) => n + 1);
    },
  };
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
                src={mediaSrc(item, 640)}
                alt={item.alt || item.filename}
                style={focalStyle(item)}
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="touch:min-h-11"
                onClick={() => setPicking(true)}
              >
                Change
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground touch:min-h-11"
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
          // The crop step shows the shape, so the box keeps to the title and buttons.
          description={null}
        >
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="touch:min-h-11"
            onClick={() => setPicking(true)}
          >
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

export function AltText({
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
  // What is stored now. A Suggest button's Undo can run after this render has gone, so saving
  // compares with this rather than with the `item` it was created with.
  const stored = useRef(item.alt);

  useEffect(() => {
    stored.current = item.alt;
    setAlt(item.alt);
  }, [item.id, item.alt]);

  async function save(value = alt) {
    const next = value.trim();
    if (next === stored.current) return;
    setSaving(true);
    try {
      await updateMedia({ data: { id: item.id, alt: next } });
      stored.current = next;
      onSaved({ ...item, alt: next });
      notify.success({
        title: 'Alt text saved',
        description: 'Screen readers use it to describe the image.',
      });
    } catch (error) {
      notify.error('Could not save the alt text', error);
      setAlt(stored.current);
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
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (isEnterKey(e)) {
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
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {item.alt ? 'Saved with the image in Media.' : 'Needed for screen readers and search.'}
        </p>
        <SuggestButton
          value={alt}
          request={() => suggestAltText({ data: { mediaId: item.id } }).then((r) => r.text)}
          onApply={(next) => {
            setAlt(next);
            void save(next);
          }}
        />
      </div>
    </div>
  );
}

/** The Media library as a picker: choose an image, or upload one first. */
export function MediaPicker({
  open,
  onOpenChange,
  selectedId,
  aspect,
  hiddenIds,
  onSelect,
  onSelectMany,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId: string | null;
  /** Uploads made here are cropped to it; blank lets the editor choose. */
  aspect?: number;
  /** Images not to offer, such as those a gallery already has. */
  hiddenIds?: string[];
  onSelect?: (item: MediaItem) => void;
  /** Lets several be chosen, in the order they were clicked. */
  onSelectMany?: (items: MediaItem[]) => void;
}) {
  const many = onSelectMany !== undefined;
  const [items, setItems] = useState<MediaItem[] | null>(null);
  // The image already chosen, when it is further down than the pages loaded.
  const [current, setCurrent] = useState<MediaItem | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState('');
  // The search sent to the server, once typing pauses.
  const [searched, setSearched] = useState('');
  // Bumped by every new search, so a late page from an older one is dropped.
  const generation = useRef(0);
  const [chosen, setChosen] = useState<string[]>(selectedId ? [selectedId] : []);
  const choose = (id: string) =>
    setChosen((list) => {
      if (!many) return [id];
      return list.includes(id) ? list.filter((other) => other !== id) : [...list, id];
    });
  const upload = useImageUpload({
    aspect,
    onUploaded: (item) => {
      remember(item);
      setItems((list) => [item, ...(list ?? [])]);
      setChosen((list) => (many ? [...list, item.id] : [item.id]));
      setQuery('');
    },
  });
  const take = (files: File[]) => (many ? upload.startAll(files) : upload.start(files[0]!));
  const chooser = useFileChooser(take, many);
  const { over, dropProps } = useImageDrop(take, upload.uploading);

  useEffect(() => {
    if (!open) return;
    setChosen(selectedId ? [selectedId] : []);
    setQuery('');
    setSearched('');
    setItems(null);
  }, [open, selectedId]);

  useEffect(() => {
    const timer = setTimeout(() => setSearched(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const mine = ++generation.current;
    listMedia({
      data: { imagesOnly: true, q: searched || undefined, include: selectedId ?? undefined },
    })
      .then((page) => {
        if (mine !== generation.current) return;
        page.items.forEach(remember);
        if (page.included) remember(page.included);
        setItems(page.items);
        setCurrent(page.included);
        setCursor(page.nextCursor);
      })
      .catch((error) => notify.error('Could not load the media library', error));
  }, [open, searched, selectedId]);

  function loadMore() {
    if (!cursor || loadingMore) return;
    const mine = generation.current;
    setLoadingMore(true);
    listMedia({ data: { imagesOnly: true, q: searched || undefined, cursor } })
      .then((page) => {
        if (mine !== generation.current) return;
        page.items.forEach(remember);
        // An upload since the first page shifts the list; skip any repeats.
        setItems((list) => {
          const seen = new Set((list ?? []).map((m) => m.id));
          return [...(list ?? []), ...page.items.filter((m) => !seen.has(m.id))];
        });
        setCursor(page.nextCursor);
      })
      .catch((error) => notify.error('Could not load more images', error))
      .finally(() => setLoadingMore(false));
  }
  const sentinel = useLoadMore<HTMLDivElement>(loadMore, open && cursor !== null && !loadingMore);

  // Documents are left out by the server; images already in use here by us.
  const visible = (items ?? []).filter((m) => !hiddenIds?.includes(m.id));
  const picked = chosen.flatMap(
    (id) => items?.find((m) => m.id === id) ?? (current?.id === id ? current : [])
  );
  const summary = many
    ? picked.length === 0
      ? 'No images selected'
      : `${picked.length} selected`
    : (picked[0]?.filename ?? 'No image selected');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex flex-col sm:max-w-3xl md:max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{many ? 'Choose images' : 'Choose an image'}</DialogTitle>
            <DialogDescription>
              {many
                ? 'Pick as many as you need from Media, or upload new ones. You can drop images here too.'
                : 'Pick one from Media, or upload a new one. You can drop images here too.'}
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
              {upload.uploading && <Spinner />}
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
                {searched ? 'No images match.' : 'No images yet. Upload one, or drop it here.'}
              </p>
            ) : (
              <div
                role="listbox"
                aria-label="Images"
                aria-multiselectable={many || undefined}
                className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5"
              >
                {visible.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={chosen.includes(m.id)}
                    onClick={() => choose(m.id)}
                    onDoubleClick={() => onSelect?.(m)}
                    className={cn(
                      'focus-visible:ring-ring relative aspect-square overflow-hidden rounded-md border outline-none focus-visible:ring-2',
                      chosen.includes(m.id) && 'ring-foreground ring-2 ring-offset-1'
                    )}
                  >
                    <img
                      src={mediaSrc(m, 320)}
                      alt={m.alt || m.filename}
                      loading="lazy"
                      style={focalStyle(m)}
                      className="size-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
            {cursor !== null && items !== null && (
              <div ref={sentinel} className="flex justify-center pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={loadingMore}
                  onClick={loadMore}
                >
                  {loadingMore && <Spinner data-icon="inline-start" />}
                  Show more
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="items-center gap-2 sm:justify-between">
            <p className="text-muted-foreground min-w-0 truncate text-xs">{summary}</p>
            <div className="flex gap-2">
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button
                type="button"
                disabled={picked.length === 0}
                onClick={() => (many ? onSelectMany(picked) : picked[0] && onSelect?.(picked[0]))}
              >
                {many ? 'Add images' : 'Use image'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {upload.dialog}
    </>
  );
}
