import { documentType } from '@ll/content';
import { FileTextIcon } from '@/components/icons';
import { mediaSrc } from '@/lib/upload-media';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/server/media';

/**
 * What a PDF or Office file shows in the library in place of a picture: a page with its type
 * badge (PDF, DOCX…), the program when that says more (Word, Excel), and the file's name.
 */
export function DocumentCard({
  item,
  showName = true,
  className,
}: {
  item: Pick<MediaItem, 'filename' | 'mime'>;
  /** Off where the name is already shown beside it. */
  showName?: boolean;
  className?: string;
}) {
  const type = documentType(item.mime);
  const badge = type ? type.extension.toUpperCase() : 'FILE';
  // "PDF" under a "PDF" badge says nothing; "Word" under "DOCX" does.
  const kind = type && type.label.toUpperCase() !== badge ? type.label : null;
  return (
    <div
      className={cn(
        'bg-muted text-muted-foreground flex flex-col items-center justify-center gap-3 p-4 text-center',
        className
      )}
    >
      <div className="bg-background border-border relative flex aspect-[3/4] h-[42%] max-h-32 min-h-14 items-center justify-center rounded-md border shadow-xs">
        <FileTextIcon aria-hidden className="text-muted-foreground size-1/3 min-w-5" />
        <span className="bg-foreground text-background absolute -bottom-2 left-1/2 -translate-x-1/2 rounded px-1.5 py-0.5 text-[0.625rem] leading-none font-semibold tracking-wide">
          {badge}
        </span>
      </div>
      <div className="mt-1 grid max-w-full gap-0.5">
        {kind && <span className="text-foreground text-xs font-medium">{kind}</span>}
        {showName && <span className="line-clamp-2 text-xs break-all">{item.filename}</span>}
      </div>
    </div>
  );
}

/**
 * A document's picture in the library: the first page of a PDF when it has one, otherwise the
 * generic cover. `width` is the size asked of the server (it picks the nearest copy).
 */
export function DocumentThumb({
  item,
  width,
  className,
  showName = true,
}: {
  item: Pick<MediaItem, 'filename' | 'mime' | 'hasCover' | 'url' | 'version'>;
  width: number;
  className?: string;
  showName?: boolean;
}) {
  if (!item.hasCover) return <DocumentCard item={item} showName={showName} className={className} />;
  return (
    <img
      src={mediaSrc(item, width)}
      alt=""
      loading="lazy"
      // A page is taller than the tile: show its top, where the title is.
      className={cn('bg-muted object-cover object-top', className)}
    />
  );
}
