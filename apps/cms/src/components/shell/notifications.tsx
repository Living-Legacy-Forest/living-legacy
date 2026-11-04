import { Link } from '@tanstack/react-router';
import { BellIcon } from '@/components/icons';
import { useCallback, useEffect, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatRelative } from '@/lib/format';
import type { SessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';
import { type ActivityItem, getRecentActivity } from '@/server/activity';

const SEEN_KEY = 'cms:notifications-seen';

// "Seen" is a per-browser convenience, so storage failures are harmless.
function readSeen() {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}
function writeSeen(value: number) {
  try {
    localStorage.setItem(SEEN_KEY, String(value));
  } catch {
    // Private mode or blocked storage: the dot just reappears next visit.
  }
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Bell with an unread dot; lists recent team activity on posts. */
export function Notifications({ user }: { user: SessionUser }) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [seen, setSeen] = useState(0);

  const load = useCallback(() => {
    getRecentActivity().then(setItems, () => setItems([]));
  }, []);

  useEffect(() => {
    setSeen(readSeen());
    load();
    // Refresh when the tab regains focus, so the dot stays current.
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  // Only other people's activity counts as new.
  const unread = (items ?? []).filter((item) => item.actorId !== user.id && item.at > seen);

  const markSeen = () => {
    const now = Date.now();
    writeSeen(now);
    setSeen(now);
  };

  return (
    <Popover onOpenChange={(open) => open && markSeen()}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={unread.length ? `Notifications, ${unread.length} new` : 'Notifications'}
            className="text-muted-foreground relative max-md:size-11 max-md:[&_svg]:size-5.5"
          />
        }
      >
        <BellIcon aria-hidden />
        {unread.length > 0 && (
          <span
            aria-hidden
            className="ring-background absolute top-1.5 right-1.5 size-1.5 rounded-full bg-sky-500 ring-2 max-md:top-2.5 max-md:right-2.5 max-md:size-2"
          />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex h-10 items-center border-b px-3 text-[13px] font-medium">Activity</div>
        {items === null ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-muted h-9 animate-pulse rounded" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No activity yet</EmptyTitle>
              <EmptyDescription>
                When someone publishes or updates a post, it shows up here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="max-h-96 overflow-y-auto p-1">
            {items.map((item) => {
              const isNew = item.actorId !== user.id && item.at > seen;
              const who = item.actorId === user.id ? 'You' : item.actor;
              const body = (
                <>
                  <Avatar className="size-6 shrink-0">
                    <AvatarFallback className="text-[10px]">{initials(item.actor)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 text-[13px] leading-snug">
                    <span className="font-medium">{who}</span>{' '}
                    <span className="text-muted-foreground">{item.action}</span>{' '}
                    <span className="font-medium">{item.title}</span>
                    <span className="text-muted-foreground block text-xs">
                      {formatRelative(item.at)}
                      {item.trashed && ' · now in the trash'}
                    </span>
                  </span>
                  {isNew && (
                    <span
                      aria-label="New"
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sky-500"
                    />
                  )}
                </>
              );
              const rowClass = cn('flex items-start gap-2.5 rounded-md px-2 py-2');
              return (
                <li key={item.id}>
                  {item.trashed ? (
                    <div className={rowClass}>{body}</div>
                  ) : (
                    <Link
                      to="/posts/$postId"
                      params={{ postId: item.postId }}
                      className={cn(rowClass, 'hover:bg-muted')}
                    >
                      {body}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
