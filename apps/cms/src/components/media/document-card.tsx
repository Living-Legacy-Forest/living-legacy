import { documentType } from '@ll/content';
import { FileTextIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/server/media';

/** What a PDF or Office file shows in the library in place of a picture: its kind and name. */
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
  return (
    <div
      className={cn(
        'bg-muted text-muted-foreground flex flex-col items-center justify-center gap-2 p-3 text-center',
        className
      )}
    >
      <FileTextIcon aria-hidden className="size-8" />
      <span className="text-foreground text-xs font-medium">
        {type ? `${type.extension.toUpperCase()} · ${type.label}` : 'Document'}
      </span>
      {showName && <span className="line-clamp-2 text-xs break-all">{item.filename}</span>}
    </div>
  );
}
