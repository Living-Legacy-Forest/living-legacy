import { Link, useNavigate } from '@tanstack/react-router';
import {
  ActivityIcon,
  ArrowRightLeft,
  CalendarClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileText,
  KeyIcon,
  Settings,
  UserCog,
  type LucideIcon,
} from '@/components/icons';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import {
  ACTIVITY_PAGE_SIZE,
  type ActivityKind,
  type ActivityLogData,
  type ActivityLogEntry,
} from '@/server/activity-log';

export type ActivitySearch = { page?: number; kind?: ActivityKind; who?: string };

const kinds: Record<ActivityKind, { label: string; icon: LucideIcon }> = {
  post: { label: 'Posts', icon: FileText },
  event: { label: 'Events', icon: CalendarClockIcon },
  user: { label: 'People', icon: UserCog },
  redirect: { label: 'Redirects', icon: ArrowRightLeft },
  settings: { label: 'Settings', icon: Settings },
  api_key: { label: 'API keys', icon: KeyIcon },
};

const ALL = 'all';

function iconFor(action: ActivityLogEntry['action']): LucideIcon {
  return kinds[action.split('.')[0] as ActivityKind]?.icon ?? ActivityIcon;
}

export function ActivityPage({ data, search }: { data: ActivityLogData; search: ActivitySearch }) {
  const timeZone = useTimeZone();
  const navigate = useNavigate({ from: '/activity/' });
  const filtered = Boolean(search.kind || search.who);
  // A new filter starts again from the first page.
  const filter = (next: Partial<Pick<ActivitySearch, 'kind' | 'who'>>) =>
    navigate({ search: (prev) => ({ ...prev, ...next, page: undefined }) });

  const kindItems = [
    { value: ALL, label: 'All changes' },
    ...Object.entries(kinds).map(([value, k]) => ({ value, label: k.label })),
  ];
  const whoItems = [
    { value: ALL, label: 'Everyone' },
    ...data.people.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 space-y-1">
        <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
          Activity
        </h1>
        <p className="text-muted-foreground text-sm">
          Changes to posts, events, people, redirects, settings and API keys, most recent first.
        </p>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Select
          items={kindItems}
          value={search.kind ?? ALL}
          onValueChange={(value) =>
            filter({ kind: value && value !== ALL ? (value as ActivityKind) : undefined })
          }
        >
          <SelectTrigger
            aria-label="Kind of change"
            className="touch:min-h-11 min-w-0 flex-1 sm:w-40 sm:flex-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {kindItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={whoItems}
          value={search.who ?? ALL}
          onValueChange={(value) => filter({ who: value && value !== ALL ? value : undefined })}
        >
          <SelectTrigger
            aria-label="Person"
            className="touch:min-h-11 min-w-0 flex-1 sm:w-44 sm:flex-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {whoItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            className="touch:min-h-11 text-muted-foreground"
            onClick={() => filter({ kind: undefined, who: undefined })}
          >
            Clear
          </Button>
        )}
      </div>

      {data.total === 0 ? (
        <Empty className="rounded-lg border max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ActivityIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{filtered ? 'Nothing matches' : 'Nothing logged yet'}</EmptyTitle>
            <EmptyDescription>
              {filtered
                ? 'No activity for these filters.'
                : 'Publishing a post, inviting someone or changing a setting will show up here.'}
            </EmptyDescription>
          </EmptyHeader>
          {filtered && (
            <EmptyContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => filter({ kind: undefined, who: undefined })}
              >
                Show all activity
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <ul className="divide-y rounded-lg border max-md:divide-(--ios-separator) max-md:overflow-hidden max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)">
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
          {/* The filters stay as they are; only the page changes. */}
          <Link
            to="/activity"
            search={(prev) => ({ ...prev, page: page - 1 > 1 ? page - 1 : undefined })}
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
            search={(prev) => ({ ...prev, page: page + 1 })}
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
