import { documentType } from '@ll/content';
import { mediaSrc } from '@/lib/upload-media';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/server/media';

/**
 * What a PDF or Office file shows in the library in place of a picture: a sheet of paper with
 * lines of text on it, its type badge (PDF, DOCX…), the program when that says more (Word,
 * Excel), and the file's name.
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
      <div
        aria-hidden
        // A4 proportions, white in both themes like paper, with the shadow a page has on a desk.
        className="relative flex aspect-[1/1.414] h-[48%] max-h-36 min-h-16 flex-col gap-[3px] rounded-[3px] bg-white p-[11%] shadow-md ring-1 ring-black/10"
      >
        <span className="mb-[3px] h-1 w-2/3 rounded-full bg-neutral-400" />
        {['w-full', 'w-11/12', 'w-full', 'w-3/4', 'w-full', 'w-1/2'].map((width, i) => (
          <span key={i} className={`h-[2px] rounded-full bg-neutral-200 ${width}`} />
        ))}
        <span className="bg-foreground text-background absolute -bottom-2 left-1/2 -translate-x-1/2 rounded px-1.5 py-0.5 text-[0.625rem] leading-none font-semibold tracking-wide max-md:text-[0.6875rem]">
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
  // The whole page, as a reader shows it, not a crop: paper on a neutral desk.
  return (
    <div className={cn('bg-muted flex items-center justify-center p-3', className)}>
      <img
        src={mediaSrc(item, width)}
        alt=""
        loading="lazy"
        className="max-h-full max-w-full rounded-[3px] bg-white object-contain shadow-md ring-1 ring-black/10"
      />
    </div>
  );
}
