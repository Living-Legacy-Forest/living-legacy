import { createLink, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  ActivityIcon,
  ArrowRightLeft,
  CalendarClockIcon,
  FileText,
  KeyIcon,
  Settings,
  Trash2,
  UserCog,
  type LucideIcon,
} from '@/components/icons';
import { SuperAdminAction } from '@/components/super-admin-action';
import { Button } from '@/components/ui/button';
import { useAction } from '@/lib/use-action';
import { clearActivityLog, removeActivityLogEntry } from '@/server/super-admin';
import { ActivityCalendar } from './activity-calendar';
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
import { PaginationLink } from '@/components/ui/pagination';
import { Pager } from '@/components/pager';
import { formatDateTime, formatLongDate, formatRelative } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import {
  ACTIVITY_PAGE_SIZE,
  ACTIVITY_PAGE_SIZES,
  type ActivityKind,
  type ActivityLogData,
  type ActivityLogEntry,
} from '@/server/activity-log';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { RevealWords } from '@/components/dashboard/reveal-words';
import { GlideHighlight } from '@/components/ui/glide-highlight';

export type ActivitySearch = {
  page?: number;
  rows?: number;
  kind?: ActivityKind;
  who?: string;
  day?: string;
};

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

export function ActivityPage({
  data,
  search,
  canClearLog = false,
}: {
  data: ActivityLogData;
  search: ActivitySearch;
  /** Only a super admin may clear the log or remove one entry. */
  canClearLog?: boolean;
}) {
  const { run, pending } = useAction();
  // Which entry is being removed, so only its button shows the spinner.
  const [removingId, setRemovingId] = useState<string | null>(null);
  const timeZone = useTimeZone();
  const navigate = useNavigate({ from: '/activity/' });
  const filtered = Boolean(search.kind || search.who || search.day);
  // A new filter starts again from the first page.
  const filter = (next: Partial<Pick<ActivitySearch, 'kind' | 'who' | 'day'>>) =>
    navigate({ search: (prev) => ({ ...prev, ...next, page: undefined }) });

  const kindItems = [
    { value: ALL, label: 'All changes' },
    ...Object.entries(kinds).map(([value, k]) => ({ value, label: k.label })),
  ];
  const whoItems = [
    { value: ALL, label: 'Everyone' },
    ...data.people.map((p) => ({ value: p.id, label: p.name })),
  ];

  const person = search.who ? data.people.find((p) => p.id === search.who)?.name : undefined;
  const revealing = useRevealOnce();

  return (
    <div
      data-slot="stack-page"
      data-revealing={revealing || undefined}
      className="mx-auto w-full max-w-3xl"
    >
      <div className="mb-6 space-y-1">
        <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
          <RevealWords text="Activity" />
        </h1>
        <p className="text-muted-foreground text-sm">
          Changes to posts, events, people, redirects, settings and API keys, most recent first.
          Pick a day on the calendar to see only its changes.
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
            size="sm"
            className="bg-muted/60 min-w-0 flex-1 border-0 shadow-none sm:w-40 sm:flex-none"
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
            size="sm"
            className="bg-muted/60 min-w-0 flex-1 border-0 shadow-none sm:w-44 sm:flex-none"
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
            className="text-muted-foreground"
            onClick={() => filter({ kind: undefined, who: undefined, day: undefined })}
          >
            Clear
          </Button>
        )}
        {canClearLog && (
          <SuperAdminAction
            className="ml-auto"
            label="Clear log"
            title="Clear the whole activity log?"
            description="Every entry is removed for everyone, and this cannot be undone. One entry is left saying that you cleared it."
            confirmLabel="Clear log"
            pending={pending}
            onConfirm={() =>
              run(() => clearActivityLog(), {
                success: (result) => ({
                  title: 'Activity log cleared',
                  description:
                    result.cleared === 1
                      ? '1 entry was removed.'
                      : `${result.cleared} entries were removed.`,
                }),
                error: 'Could not clear the log',
              })
            }
          />
        )}
      </div>

      <div className="bg-card bg-muted/50 mb-4 rounded-lg p-4 max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell) max-md:[--heatmap-surface:var(--ios-cell)]">
        <ActivityCalendar
          days={data.days}
          label={`Changes over the past year${person ? ` by ${person}` : ''}`}
          period={person ? `the past year by ${person}` : 'the past year'}
          selectedDate={search.day ?? null}
          // Picking the day already shown lets it go again.
          onSelectDate={(day) => filter({ day: day === search.day ? undefined : day })}
        />
      </div>

      {search.day && (
        <p className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
          Changes on {formatLongDate(Date.parse(`${search.day}T12:00:00Z`), 'UTC')}
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => filter({ day: undefined })}
          >
            Show every day
          </Button>
        </p>
      )}

      {data.total === 0 ? (
        <Empty className="rounded-lg max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)">
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
        <ul className="bg-muted/50 overflow-hidden rounded-lg max-md:divide-y max-md:divide-(--ios-separator) max-md:overflow-hidden max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)">
          <GlideHighlight
            follow="hover"
            as="li"
            selector="[data-glide]"
            className="bg-muted border-0! max-md:hidden"
          />
          {data.rows.map((entry) => {
            const Icon = iconFor(entry.action);
            return (
              <li key={entry.id} data-glide className="relative flex items-start gap-3 px-4 py-3">
                <span className="bg-muted text-muted-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                  <Icon aria-hidden className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-ui">
                    <span className="font-medium">{entry.actorName || 'Someone'}</span>{' '}
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
                {canClearLog && (
                  <SuperAdminAction
                    icon={<Trash2 aria-hidden />}
                    className="-my-1 -mr-2 shrink-0"
                    label="Remove this entry"
                    title="Remove this entry from the activity log?"
                    description="It is removed for everyone, and this cannot be undone. Nothing is left in the log to show it was there."
                    confirmLabel="Remove entry"
                    pending={pending && removingId === entry.id}
                    onConfirm={() => {
                      setRemovingId(entry.id);
                      void run(() => removeActivityLogEntry({ data: { id: entry.id } }), {
                        success: (result) =>
                          result.removed
                            ? {
                                title: 'Entry removed',
                                description: 'It is no longer in the activity log.',
                              }
                            : {
                                title: 'That entry was already gone',
                                description: 'Nothing was changed.',
                              },
                        error: 'Could not remove the entry',
                      });
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {data.total > 0 && <ActivityPager data={data} />}
    </div>
  );
}

// Pagination links that navigate inside the app, keeping the filters.
const PageItem = createLink(PaginationLink);
const EXACT = { exact: true } as const;

/** "16–30 of 45" and the pages, as links, so they open in a new tab too. */
function ActivityPager({ data }: { data: ActivityLogData }) {
  const { page, pageCount, pageSize, total } = data;
  const navigate = useNavigate({ from: '/activity/' });
  // Page 1 has no ?page, so its address stays the plain /activity.
  const toPage = (n: number) => (prev: ActivitySearch) => ({
    ...prev,
    page: n > 1 ? n : undefined,
  });

  return (
    <Pager
      page={page}
      pageCount={pageCount}
      total={total}
      pageSize={pageSize}
      noun="changes"
      label="Activity pages"
      rows={{
        options: ACTIVITY_PAGE_SIZES,
        // A new page size starts again from the first page.
        onChange: (rows) =>
          void navigate({
            search: (prev) => ({
              ...prev,
              rows: rows === ACTIVITY_PAGE_SIZE ? undefined : rows,
              page: undefined,
            }),
          }),
      }}
      renderItem={({ page: n, props, content }) => (
        <PageItem to="/activity" activeOptions={EXACT} search={toPage(n)} {...props}>
          {content}
        </PageItem>
      )}
    />
  );
}
