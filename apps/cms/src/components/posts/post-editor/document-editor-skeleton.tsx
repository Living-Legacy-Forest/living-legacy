// Stands in for the document editor while it loads, laid out like it: the
// toolbar, the page with its title and text, and the word count.
// Kept apart from document-editor.tsx so it loads without ProseMirror.
import { Skeleton } from '@/components/ui/skeleton';
import { CANVAS } from '@/components/templates/simple-document-editor/constants';
import { cn } from '@/lib/utils';

const LINE_WIDTHS = ['94%', '88%', '97%', '72%', '91%', '84%', '58%'];

export function DocumentEditorSkeleton() {
  return (
    <div className="bg-muted/50 flex h-full min-h-[32rem] flex-col overflow-hidden rounded-lg">
      <div className={cn('flex min-h-0 flex-1 flex-col', CANVAS)}>
        <div className="sm:px-3 sm:pt-3 sm:pb-1">
          <div className="bg-background flex h-[42px] items-center gap-2 overflow-hidden px-3 sm:rounded-xl sm:shadow-sm">
            <Skeleton className="size-5" />
            <Skeleton className="size-5" />
            <Skeleton className="mx-2 h-5 w-20" />
            {Array.from({ length: 16 }, (_, i) => (
              <Skeleton key={i} className="size-5" />
            ))}
          </div>
        </div>
        <div className="bg-background flex flex-1 flex-col px-4 py-5 sm:mx-auto sm:mt-4 sm:mb-6 sm:w-full sm:max-w-3xl sm:rounded-md sm:px-14 sm:py-12 sm:shadow-xs">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="mt-3 h-5 w-1/2" />
          <div className="mt-8 space-y-3">
            {LINE_WIDTHS.map((width, i) => (
              <Skeleton key={i} className="h-4" style={{ width }} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex h-9 shrink-0 items-center gap-3 px-3">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
