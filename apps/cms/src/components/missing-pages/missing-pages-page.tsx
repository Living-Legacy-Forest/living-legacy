import { Link } from '@tanstack/react-router';
import { Link2Off } from '@/components/icons';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Pager } from '@/components/pager';
import { formatDateTime, formatInteger, formatRelative } from '@/lib/format';
import { useAction } from '@/lib/use-action';
import { usePaged } from '@/lib/use-paged';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import { type MissingPage, dismissMissingPage } from '@/server/not-found';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { RevealWords } from '@/components/dashboard/reveal-words';
import { GlideHighlight } from '@/components/ui/glide-highlight';

/** Each row carries two buttons, so the pages are shorter than a plain list's. */
const PAGE_SIZES = [10, 25, 50, 100] as const;

export function MissingPagesPage({
  data,
  switcher,
}: {
  data: MissingPage[];
  /** Switches back to Redirects, which shares this page. */
  switcher?: React.ReactNode;
}) {
  const timeZone = useTimeZone();
  const { run, pending } = useAction();
  const paged = usePaged(data, '', PAGE_SIZES);

  const revealing = useRevealOnce();

  return (
    <div
      data-slot="stack-page"
      data-revealing={revealing || undefined}
      className="w-full max-w-3xl"
    >
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 data-slot="page-title" className="text-xl">
            <RevealWords text="Redirects" />
          </h1>
          {switcher}
        </div>
        <p className="text-muted-foreground text-sm">
          Addresses on the website that found nothing, busiest first. Redirect the ones people still
          follow, such as old links, and dismiss the rest. Paths unseen for 90 days drop off.
        </p>
      </div>

      {data.length === 0 ? (
        <Empty className="rounded-lg max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Link2Off aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No missing pages</EmptyTitle>
            <EmptyDescription>
              When a visitor reaches an address the website does not have, it shows up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="bg-muted/50 overflow-hidden rounded-lg max-md:overflow-hidden max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)">
          <GlideHighlight
            follow="hover"
            as="li"
            selector="[data-glide]"
            className="bg-muted border-0! max-md:hidden"
          />
          {paged.shown.map((page) => (
            <li
              key={page.path}
              data-glide
              className="relative flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-ui truncate font-mono" title={page.path}>
                  {page.path}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                  {formatInteger(page.hits)} {page.hits === 1 ? 'visit' : 'visits'} · last seen{' '}
                  <span title={formatDateTime(page.lastSeenAt, timeZone)}>
                    {formatRelative(page.lastSeenAt)}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  to="/redirects"
                  search={{ from: page.path }}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                >
                  Create redirect
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  disabled={pending}
                  onClick={() =>
                    run(() => dismissMissingPage({ data: { path: page.path } }), {
                      success: {
                        title: 'Dismissed',
                        description: `${page.path} is hidden from this list.`,
                      },
                      error: 'Could not dismiss it',
                    })
                  }
                >
                  Dismiss
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {paged.needed && <Pager {...paged.pager} noun="paths" label="Pages of missing paths" />}
    </div>
  );
}
