// Upload images to Media: a row per file with its own progress, a tick when it lands, or why it
// failed with a Retry. Each image shows in the library as soon as it is in.
import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileDropzone,
  type FileDropzoneHandle,
  type FileDropzoneUpload,
} from '@/components/ui/file-dropzone';
import { readableError } from '@/lib/errors';
import { IMAGE_ACCEPT, uploadMedia } from '@/lib/upload-media';

export function MediaUploadDialog({
  open,
  onOpenChange,
  dropped,
  onTaken,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Files dropped on the page, added as soon as the dialog opens. */
  dropped: File[];
  onTaken: () => void;
}) {
  const router = useRouter();
  const zone = useRef<FileDropzoneHandle>(null);
  // Closing would cancel what is still going up, so the dialog stays until they finish.
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open || dropped.length === 0) return;
    // The dropzone mounts with the dialog; wait a frame for it.
    const frame = requestAnimationFrame(() => {
      zone.current?.add(dropped);
      onTaken();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, dropped, onTaken]);

  const upload: FileDropzoneUpload = async (item, { onProgress, signal }) => {
    if (!item.file) return;
    setActive((n) => n + 1);
    try {
      await uploadMedia(item.file, undefined, { onProgress, signal });
      void router.invalidate();
    } catch (error) {
      if (signal.aborted) return;
      throw new Error(readableError(error));
    } finally {
      setActive((n) => n - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next || active === 0) && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload images</DialogTitle>
          <DialogDescription>
            Each is resized for the web and ready to use in posts and pages.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <FileDropzone
            ref={zone}
            accept={IMAGE_ACCEPT}
            label="Add images"
            description="Drop them here, paste, or choose from your device."
            note="JPG, PNG, WebP, AVIF or GIF"
            refusal="Only JPG, PNG, WebP, AVIF or GIF images can be uploaded."
            maxFiles={50}
            compactAt={3}
            onUpload={upload}
          />
        </div>
        <DialogFooter>
          <Button type="button" disabled={active > 0} onClick={() => onOpenChange(false)}>
            {active > 0 && <Spinner data-icon="inline-start" />}
            {active > 0 ? 'Uploading' : 'Done'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
