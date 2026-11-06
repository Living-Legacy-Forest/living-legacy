import {
  ActivityIcon,
  ArrowRightLeft,
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
import { formatDateTime, formatRelative } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import type { ActivityLogData, ActivityLogEntry } from '@/server/activity-log';

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

      {data.length === 0 ? (
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
          {data.map((entry) => {
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
    </div>
  );
}
