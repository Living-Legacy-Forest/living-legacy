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
import { Drawer, DrawerBody, DrawerContent } from '@/components/ui/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatRelative } from '@/lib/format';
import type { SessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';
import { type ActivityItem, getRecentActivity } from '@/server/activity';
import { SheetHeader, sheetGroupClass } from './sheet-parts';

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

/** Bell with an unread dot; lists recent team activity on posts. A sheet on phones. */
export function Notifications({ user }: { user: SessionUser }) {
  const isPhone = useIsMobile();
  const [open, setOpen] = useState(false);
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

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    const now = Date.now();
    writeSeen(now);
    setSeen(now);
  };
  const close = () => onOpenChange(false);

  const triggerProps = {
    variant: 'ghost',
    size: 'icon-sm',
    'aria-label': unread.length ? `Notifications, ${unread.length} new` : 'Notifications',
    className: 'text-muted-foreground relative max-md:size-11 max-md:[&_svg]:size-5.5',
  } as const;
  const bell = (
    <>
      <BellIcon aria-hidden />
      {unread.length > 0 && (
        <span
          aria-hidden
          className="ring-background absolute top-1.5 right-1.5 size-1.5 rounded-full bg-sky-500 ring-2 max-md:top-2.5 max-md:right-2.5 max-md:size-2"
        />
      )}
    </>
  );
  const list = (
    <ActivityList items={items} user={user} seen={seen} phone={isPhone} onNavigate={close} />
  );

  if (isPhone) {
    return (
      <>
        <Button {...triggerProps} onClick={() => onOpenChange(true)}>
          {bell}
        </Button>
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="bg-muted">
            <SheetHeader title="Activity" onDone={close} />
            <DrawerBody className="pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
              {list}
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={<Button {...triggerProps} />}>{bell}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="text-ui flex h-10 items-center border-b px-3 font-medium">Activity</div>
        {list}
      </PopoverContent>
    </Popover>
  );
}

function ActivityList({
  items,
  user,
  seen,
  phone,
  onNavigate,
}: {
  items: ActivityItem[] | null;
  user: SessionUser;
  seen: number;
  /** Grouped rows at body size, for the phone sheet. */
  phone: boolean;
  onNavigate: () => void;
}) {
  if (items === null) {
    return (
      <div className={cn('space-y-2', phone ? 'pt-1' : 'p-3')}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'animate-pulse rounded',
              phone ? 'bg-background h-14 rounded-xl' : 'bg-muted h-9'
            )}
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Empty className={cn('py-10', phone && 'bg-background rounded-xl')}>
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
    );
  }

  const rowClass = phone
    ? 'flex min-h-11 items-start gap-3 px-4 py-3 transition-colors'
    : 'flex items-start gap-2.5 rounded-md px-2 py-2';

  return (
    <ul className={phone ? sheetGroupClass : 'max-h-96 overflow-y-auto p-1'}>
      {items.map((item) => {
        const isNew = item.actorId !== user.id && item.at > seen;
        const who = item.actorId === user.id ? 'You' : item.actor;
        const body = (
          <>
            <Avatar className={cn('shrink-0', phone ? 'size-8' : 'size-6')}>
              <AvatarFallback className={phone ? 'text-xs' : 'text-[10px]'}>
                {initials(item.actor)}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn('min-w-0 flex-1 leading-snug', phone ? 'text-[0.9375rem]' : 'text-ui')}
            >
              <span className="font-medium">{who}</span>{' '}
              <span className="text-muted-foreground">{item.action}</span>{' '}
              <span className="font-medium">{item.title}</span>
              <span
                className={cn(
                  'text-muted-foreground mt-0.5 block',
                  phone ? 'text-[0.8125rem]' : 'text-xs'
                )}
              >
                {formatRelative(item.at)}
                {item.trashed && ' · now in the trash'}
              </span>
            </span>
            {isNew && (
              <span aria-label="New" className="mt-1.5 size-2 shrink-0 rounded-full bg-sky-500" />
            )}
          </>
        );
        return (
          <li key={item.id}>
            {item.trashed ? (
              <div className={rowClass}>{body}</div>
            ) : (
              <Link
                to="/posts/$postId"
                params={{ postId: item.postId }}
                onClick={onNavigate}
                className={cn(rowClass, phone ? 'active:bg-muted' : 'hover:bg-muted')}
              >
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
