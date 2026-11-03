// Zoom and crop an image before it is uploaded. A field that shows images in a
// fixed shape (a 3:2 card, a square portrait) passes its aspect ratio and the
// crop is locked to it; otherwise the editor picks a shape, or keeps the
// original. Cropping happens in the browser (see prepare-image.ts).
import { useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { toast } from 'sonner';
import { MinusIcon, PlusIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { readableError } from '@/lib/errors';
import { canCrop, prepareImage } from '@/lib/prepare-image';
import { uploadMedia } from '@/lib/upload-media';
import type { MediaItem } from '@/server/media';

const MAX_ZOOM = 4;

/** Shapes offered when the field does not fix one. */
const SHAPES = [
  { value: 'original', label: 'Original', aspect: null },
  { value: '16:9', label: '16:9', aspect: 16 / 9 },
  { value: '3:2', label: '3:2', aspect: 3 / 2 },
  { value: '4:3', label: '4:3', aspect: 4 / 3 },
  { value: '1:1', label: 'Square', aspect: 1 },
  { value: '4:5', label: '4:5', aspect: 4 / 5 },
] as const;

/** Says what a fixed aspect is for, e.g. "a square" or "3:2". */
function aspectName(aspect: number) {
  const known: [number, string][] = [
    [1, 'a square'],
    [16 / 9, '16:9'],
    [3 / 2, '3:2, the shape of blog cards'],
    [4 / 3, '4:3'],
    [1.91, '1.91:1, the shape social networks show'],
    [4 / 5, '4:5'],
  ];
  return known.find(([a]) => Math.abs(a - aspect) < 0.01)?.[1] ?? `${aspect.toFixed(2)}:1`;
}

export function ImageCropDialog({
  file,
  aspect,
  onCancel,
  onDone,
}: {
  /** The image to crop; the dialog is open while one is set. */
  file: File | null;
  /** Locks the crop to this width / height. */
  aspect?: number;
  onCancel: () => void;
  /** Receives the processed file. Throwing keeps the dialog open. */
  onDone: (file: File) => Promise<void>;
}) {
  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-2xl">
        {file && (
          <CropBody
            key={`${file.name}-${file.size}-${file.lastModified}`}
            file={file}
            aspect={aspect}
            onCancel={onCancel}
            onDone={onDone}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CropBody({
  file,
  aspect,
  onCancel,
  onDone,
}: {
  file: File;
  aspect?: number;
  onCancel: () => void;
  onDone: (file: File) => Promise<void>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<number | null>(null);
  const [shape, setShape] = useState<(typeof SHAPES)[number]['value']>('original');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState<null | 'crop' | 'skip'>(null);

  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  const chosen = SHAPES.find((s) => s.value === shape)!;
  const ratio = aspect ?? chosen.aspect ?? natural ?? 1;

  async function finish(kind: 'crop' | 'skip') {
    setBusy(kind);
    try {
      await onDone(await prepareImage(file, kind === 'crop' && area ? area : undefined));
    } catch (error) {
      toast.error(readableError(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Crop image</DialogTitle>
        <DialogDescription>
          {aspect
            ? `Cropped to ${aspectName(aspect)}. Drag to position, and zoom to frame it.`
            : 'Drag to position, and zoom to frame it. Pick a shape, or keep the original.'}
        </DialogDescription>
      </DialogHeader>

      <div className="bg-muted relative h-[min(60vh,26rem)] overflow-hidden rounded-lg">
        {url && (
          <Cropper
            image={url}
            crop={crop}
            zoom={zoom}
            maxZoom={MAX_ZOOM}
            aspect={ratio}
            objectFit="contain"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
            onMediaLoaded={(size) => setNatural(size.naturalWidth / size.naturalHeight)}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex min-w-48 flex-1 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom out"
            disabled={zoom <= 1}
            onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
          >
            <MinusIcon aria-hidden />
          </Button>
          <Slider
            aria-label="Zoom"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={[zoom]}
            onValueChange={(value) => setZoom(Array.isArray(value) ? value[0]! : value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.25))}
          >
            <PlusIcon aria-hidden />
          </Button>
        </div>
        {!aspect && (
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[shape]}
            onValueChange={(value) => value[0] && setShape(value[0] as typeof shape)}
            aria-label="Shape"
          >
            {SHAPES.map((s) => (
              <ToggleGroupItem key={s.value} value={s.value} className="text-xs">
                {s.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          disabled={busy !== null}
          onClick={() => finish('skip')}
        >
          {busy === 'skip' && <Spinner />}
          Use without cropping
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" disabled={busy !== null} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={busy !== null || !area} onClick={() => finish('crop')}>
            {busy === 'crop' && <Spinner />}
            Crop and upload
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

/**
 * Choose or drop a file, crop it, upload it. `start` takes the picked file;
 * render `dialog` somewhere in the component. GIFs skip the crop, since
 * redrawing one would keep only its first frame.
 */
export function useImageUpload<T = MediaItem>({
  aspect,
  upload = uploadMedia as unknown as (file: File) => Promise<T>,
  onUploaded,
}: {
  aspect?: number;
  /** Where the file goes; the Media library by default. */
  upload?: (file: File) => Promise<T>;
  onUploaded: (result: T) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function send(prepared: File) {
    setUploading(true);
    try {
      onUploaded(await upload(prepared));
    } finally {
      setUploading(false);
    }
  }

  const start = (picked: File) => {
    if (canCrop(picked)) setFile(picked);
    else send(picked).catch((error) => toast.error(readableError(error)));
  };

  const dialog = (
    <ImageCropDialog
      file={file}
      aspect={aspect}
      onCancel={() => setFile(null)}
      onDone={async (prepared) => {
        await send(prepared);
        setFile(null);
      }}
    />
  );

  return { start, uploading, dialog };
}
