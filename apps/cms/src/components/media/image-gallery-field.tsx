// Several images picked from the Media library, in order, for a form that shows
// a gallery. The first is the cover. Like ImageField, the alt text belongs to
// the image and is saved straight to the library.
import { useRef, useState } from 'react';
import { mediaSrc } from '@/lib/upload-media';
import { ChevronDownIcon, ChevronUpIcon } from '@/components/icons';
import { useImageUpload } from '@/components/media/image-crop-dialog';
import { ImageDropZone } from '@/components/media/image-drop-zone';
import { focalStyle } from '@/components/media/media-file';
import { AltText, MediaPicker, useMediaItems } from '@/components/media/image-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { notify } from '@/lib/notify';
import type { MediaItem } from '@/server/media';
import { FIELD_LABEL } from '@/components/form-cells';

export function ImageGalleryField({
  id,
  label,
  description,
  mediaIds,
  onChange,
  max,
}: {
  id: string;
  label: string;
  description?: string;
  mediaIds: string[];
  onChange: (mediaIds: string[]) => void;
  max: number;
}) {
  const media = useMediaItems(mediaIds);
  const [picking, setPicking] = useState(false);
  // Uploads finish one at a time, each after the render that started them.
  const latest = useRef(mediaIds);
  latest.current = mediaIds;

  const tooMany = () => notify.error('Too many photos', `You can add ${max} at most.`);
  const change = (next: string[]) => {
    latest.current = next;
    onChange(next);
  };
  const add = (items: MediaItem[]) => {
    items.forEach(media.update);
    const fresh = items.map((i) => i.id).filter((i) => !latest.current.includes(i));
    const room = max - latest.current.length;
    if (fresh.length > room) tooMany();
    change([...latest.current, ...fresh.slice(0, room)]);
  };
  const upload = useImageUpload({ onUploaded: (item) => add([item]) });
  const uploadFiles = (files: File[]) => {
    const room = max - latest.current.length;
    if (files.length > room) tooMany();
    if (room > 0) void upload.startAll(files.slice(0, room));
  };
  const move = (from: number, to: number) => {
    const next = [...mediaIds];
    next.splice(to, 0, ...next.splice(from, 1));
    change(next);
  };

  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <Label htmlFor={`${id}-choose`} className={FIELD_LABEL}>
          {label}
        </Label>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>

      {mediaIds.length > 0 && (
        <ul className="space-y-3">
          {mediaIds.map((mediaId, index) => {
            const item = media.item(mediaId);
            return (
              <li
                key={mediaId}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 sm:flex sm:gap-3"
              >
                <div className="bg-muted relative size-24 shrink-0 overflow-hidden rounded-md">
                  {item ? (
                    <img
                      src={mediaSrc(item, 640)}
                      alt={item.alt || item.filename}
                      style={focalStyle(item)}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground flex size-full items-center justify-center p-1 text-center text-xs">
                      {media.missing(mediaId) ? 'Image not found' : <Spinner />}
                    </div>
                  )}
                  {index === 0 && (
                    <Badge variant="secondary" className="absolute top-1 left-1">
                      Cover
                    </Badge>
                  )}
                </div>
                <div className="contents sm:block sm:min-w-0 sm:flex-1 sm:space-y-2">
                  {item && (
                    <AltText id={`${id}-alt-${mediaId}`} item={item} onSaved={media.update} />
                  )}
                  <div className="col-span-full flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"

                      aria-label={`Move photo ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      <ChevronUpIcon aria-hidden className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"

                      aria-label={`Move photo ${index + 1} down`}
                      disabled={index === mediaIds.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ChevronDownIcon aria-hidden className="size-4" />
                    </Button>
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => move(index, 0)}
                      >
                        Make cover
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground max-sm:ml-auto"
                      onClick={() => change(mediaIds.filter((other) => other !== mediaId))}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {mediaIds.length < max && (
        <ImageDropZone
          id={`${id}-choose`}
          multiple
          busy={upload.uploading}
          onFiles={uploadFiles}
          title="Add photos"
        >
          <Button type="button" size="sm" variant="outline" onClick={() => setPicking(true)}>
            From Media
          </Button>
        </ImageDropZone>
      )}

      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        selectedId={null}
        hiddenIds={mediaIds}
        onSelectMany={(items) => {
          add(items);
          setPicking(false);
        }}
      />
      {upload.dialog}
    </div>
  );
}
