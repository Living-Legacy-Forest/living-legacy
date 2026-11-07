import { Link } from '@tanstack/react-router';
import {
  ActivityIcon,
  ArrowRightLeft,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileText,
  KeyIcon,
  Settings,
  UserCog,
  type LucideIcon,
} from '@/components/icons';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { buttonVariants } from '@/components/ui/button';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import {
  ACTIVITY_PAGE_SIZE,
  type ActivityLogData,
  type ActivityLogEntry,
} from '@/server/activity-log';

const icons: Record<string, LucideIcon> = {
  post: FileText,
  user: UserCog,
  redirect: ArrowRightLeft,
  settings: Settings,
  api_key: KeyIcon,
};

function iconFor(action: ActivityLogEntry['action']): LucideIcon {
  return icons[action.split('.')[0]!] ?? ActivityIcon;
}

export function ActivityPage({ data }: { data: ActivityLogData }) {
  const timeZone = useTimeZone();
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8 space-y-1">
        <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
          Activity
        </h1>
        <p className="text-muted-foreground text-sm">
          Who published, invited, redirected or changed settings, most recent first.
        </p>
      </div>

      {data.total === 0 ? (
        <Empty className="rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ActivityIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Nothing logged yet</EmptyTitle>
            <EmptyDescription>
              Publishing a post, inviting someone or changing a setting will show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data.rows.map((entry) => {
            const Icon = iconFor(entry.action);
            return (
              <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
                <span className="bg-muted text-muted-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                  <Icon aria-hidden className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-ui">
                    <span className="font-medium">{entry.actorName}</span>{' '}
                    <span className="text-muted-foreground">
                      {entry.summary.charAt(0).toLowerCase() + entry.summary.slice(1)}
                    </span>
                  </p>
                  <p
                    className="text-muted-foreground mt-0.5 text-xs tabular-nums"
                    title={formatDateTime(entry.createdAt, timeZone)}
                  >
                    {formatRelative(entry.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data.total > 0 && <Pager data={data} />}
    </div>
  );
}

/** "51–100 of 312" and the way to the pages either side; links, so they open in a new tab too. */
function Pager({ data }: { data: ActivityLogData }) {
  const { page, pageCount, total } = data;
  const from = (page - 1) * ACTIVITY_PAGE_SIZE + 1;
  const to = Math.min(page * ACTIVITY_PAGE_SIZE, total);
  const step = cn(
    buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
    'touch:size-11',
    'aria-disabled:pointer-events-none aria-disabled:opacity-50'
  );
  return (
    <nav
      aria-label="Activity pages"
      className="text-muted-foreground mt-3 flex items-center justify-between text-xs"
    >
      <span className="tabular-nums">
        {from}–{to} of {total}
      </span>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <Link
            to="/activity"
            search={{ page: page - 1 > 1 ? page - 1 : undefined }}
            aria-label="Previous page"
            aria-disabled={page <= 1}
            tabIndex={page <= 1 ? -1 : undefined}
            className={step}
          >
            <ChevronLeftIcon aria-hidden />
          </Link>
          <span className="tabular-nums">
            Page {page} of {pageCount}
          </span>
          <Link
            to="/activity"
            search={{ page: page + 1 }}
            aria-label="Next page"
            aria-disabled={page >= pageCount}
            tabIndex={page >= pageCount ? -1 : undefined}
            className={step}
          >
            <ChevronRightIcon aria-hidden />
          </Link>
        </div>
      )}
    </nav>
  );
}
