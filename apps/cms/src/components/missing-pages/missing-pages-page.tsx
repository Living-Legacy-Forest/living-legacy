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
import { formatDateTime, formatInteger, formatRelative } from '@/lib/format';
import { useAction } from '@/lib/use-action';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import { type MissingPage, dismissMissingPage } from '@/server/not-found';

export function MissingPagesPage({ data }: { data: MissingPage[] }) {
  const timeZone = useTimeZone();
  const { run, pending } = useAction();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6 space-y-1">
        <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
          Missing pages
        </h1>
        <p className="text-muted-foreground text-sm">
          Addresses on the website that found nothing, busiest first. Redirect the ones people still
          follow, such as old links, and dismiss the rest. Paths unseen for 90 days drop off.
        </p>
      </div>

      {data.length === 0 ? (
        <Empty className="rounded-lg border max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)">
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
        <ul className="divide-y rounded-lg border max-md:divide-(--ios-separator) max-md:overflow-hidden max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)">
          {data.map((page) => (
            <li
              key={page.path}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
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
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'touch:min-h-11'
                  )}
                >
                  Create redirect
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="touch:min-h-11 text-muted-foreground"
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
    </div>
  );
}
