// Drag-and-drop for image uploads. `useImageDrop` makes any element a drop
// target; `ImageDropZone` is the visible one, the shared DropTarget, which
// also opens the file chooser when clicked and takes a pasted image.
import { useRef, useState } from 'react';
import { DropTarget } from '@/components/ui/file-dropzone';
import { IMAGE_ACCEPT } from '@/lib/upload-media';

const ACCEPTED = new Set(IMAGE_ACCEPT.split(','));
const imagesIn = (list: FileList | null) =>
  [...(list ?? [])].filter((file) => ACCEPTED.has(file.type));
const carriesFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');

/**
 * Drop handlers for an element, and whether files are being dragged over it.
 * Only image files are passed on (or whatever `pick` keeps); dragging text or
 * links is ignored.
 */
export function useImageDrop(
  onFiles: (files: File[]) => void,
  disabled = false,
  pick: (list: FileList | null) => File[] = imagesIn
) {
  // dragenter and dragleave also fire for every child crossed, so count them.
  const depth = useRef(0);
  const [over, setOver] = useState(false);

  const dropProps = {
    onDragEnter: (e: React.DragEvent) => {
      if (disabled || !carriesFiles(e)) return;
      e.preventDefault();
      depth.current++;
      setOver(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (disabled || !carriesFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: () => {
      if (--depth.current <= 0) {
        depth.current = 0;
        setOver(false);
      }
    },
    onDrop: (e: React.DragEvent) => {
      if (disabled || !carriesFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      const files = pick(e.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
  };
  return { over, dropProps };
}

/** A hidden file input and a function that opens it. */
export function useFileChooser(onFiles: (files: File[]) => void, multiple = false) {
  const input = useRef<HTMLInputElement>(null);
  const element = (
    <input
      ref={input}
      type="file"
      accept={IMAGE_ACCEPT}
      multiple={multiple}
      className="hidden"
      onChange={(e) => {
        const files = imagesIn(e.target.files);
        if (files.length > 0) onFiles(files);
        e.target.value = '';
      }}
    />
  );
  return { open: () => input.current?.click(), element };
}

export function ImageDropZone({
  id,
  onFiles,
  busy = false,
  multiple = false,
  title = multiple ? 'Add images' : 'Add an image',
  description = 'Drop here or choose. JPG, PNG, WebP, AVIF or GIF.',
  className,
  children,
}: {
  id?: string;
  onFiles: (files: File[]) => void;
  busy?: boolean;
  multiple?: boolean;
  title?: string;
  /** A line under the title; null leaves it out. */
  description?: string | null;
  className?: string;
  /** More actions under the prompt, e.g. picking from Media. */
  children?: React.ReactNode;
}) {
  return (
    <DropTarget
      id={id}
      accept={IMAGE_ACCEPT}
      multiple={multiple}
      busy={busy}
      busyLabel="Uploading"
      label={title}
      description={description}
      dropLabel={multiple ? 'Drop to upload them' : 'Drop to upload it'}
      refusal="Only JPG, PNG, WebP, AVIF or GIF images can be used."
      onFiles={onFiles}
      className={className}
    >
      {children}
    </DropTarget>
  );
}
