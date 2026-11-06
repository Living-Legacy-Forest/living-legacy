// Drag-and-drop for image uploads. `useImageDrop` makes any element a drop
// target; `ImageDropZone` is the visible one, shadcn's Empty with a dashed
// border, which also opens the file chooser when clicked.
import { useRef, useState } from 'react';
import { UploadIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { IMAGE_ACCEPT } from '@/lib/upload-media';
import { cn } from '@/lib/utils';

const ACCEPTED = new Set(IMAGE_ACCEPT.split(','));
const imagesIn = (list: FileList | null) =>
  [...(list ?? [])].filter((file) => ACCEPTED.has(file.type));
const carriesFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');

/**
 * Drop handlers for an element, and whether files are being dragged over it.
 * Only image files are passed on; dragging text or links is ignored.
 */
export function useImageDrop(onFiles: (files: File[]) => void, disabled = false) {
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
      const files = imagesIn(e.dataTransfer.files);
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
  title = 'Drop an image here',
  description = 'JPG, PNG, WebP or GIF.',
  className,
  children,
}: {
  id?: string;
  onFiles: (files: File[]) => void;
  busy?: boolean;
  multiple?: boolean;
  title?: string;
  description?: string;
  className?: string;
  /** More actions beside the file chooser, e.g. picking from Media. */
  children?: React.ReactNode;
}) {
  const { over, dropProps } = useImageDrop(onFiles, busy);
  const chooser = useFileChooser(onFiles, multiple);

  return (
    <Empty
      {...dropProps}
      className={cn(
        'gap-3 rounded-md border border-dashed p-4 transition-colors md:p-6',
        over ? 'border-ring bg-accent/50' : 'hover:bg-muted/40',
        className
      )}
    >
      {chooser.element}
      <EmptyHeader className="gap-1">
        <EmptyMedia variant="icon" className="mb-1">
          {busy ? <Spinner /> : <UploadIcon aria-hidden />}
        </EmptyMedia>
        <EmptyTitle className="text-sm">{busy ? 'Uploading…' : title}</EmptyTitle>
        <EmptyDescription className="text-xs">{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center gap-2">
        <Button
          id={id}
          type="button"
          size="sm"
          variant="outline"
          className="touch:min-h-11"
          disabled={busy}
          onClick={chooser.open}
        >
          {multiple ? 'Choose images' : 'Choose an image'}
        </Button>
        {children}
      </EmptyContent>
    </Empty>
  );
}
