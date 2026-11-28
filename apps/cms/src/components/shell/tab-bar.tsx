import { Link, useLocation } from '@tanstack/react-router';
import { useState } from 'react';
import {
  ChevronRightIcon,
  FilePlus2Icon,
  ChartAreaIcon,
  FolderIcon,
  MoreHorizontalIcon,
  TagIcon,
} from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Drawer, DrawerBody, DrawerContent } from '@/components/ui/drawer';
import {
  type NavItem,
  footerLinks,
  isEditorPath,
  isNavItemAllowed,
  isTabActive,
  navGroups,
  phoneTabs,
} from '@/lib/nav';
import type { SessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';
import { useSignOut } from '@/lib/use-sign-out';
import { useThemeChoice } from '@/lib/use-theme-choice';
import { SegmentedControl } from '@/components/segmented-control';
import { Spinner } from '@/components/ui/spinner';
import { SignOutLabel } from './nav-user';
import { SheetHeader, sheetGroupClass, sheetRowClass } from './sheet-parts';
import { avatarSrc } from '@/lib/avatar';

const tabClass =
  'flex min-w-0 flex-col items-center justify-center gap-0.5 text-[0.625rem] font-medium tracking-tight transition-opacity active:opacity-50 [&_svg]:size-6';

/** iOS-style tab bar for phones; the sidebar takes over from md up. */
export function TabBar({ user }: { user: SessionUser }) {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  // The editor gets the whole screen, like a page pushed onto an iOS stack.
  if (isEditorPath(pathname)) return null;

  const tabs = phoneTabs.filter((tab) => isNavItemAllowed(tab, user));
  const moreActive = !tabs.some((tab) => isTabActive(tab.to, pathname));

  return (
    <nav
      aria-label="Sections"
      data-slot="tab-bar"
      data-tab-bar="shown"
      className="border-border/70 bg-background/80 fixed inset-x-0 bottom-0 z-30 border-t pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
    >
      <div
        className="grid h-12.25"
        style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const active = isTabActive(tab.to, pathname);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={active ? 'page' : undefined}
              onClick={(event) => {
                // As on iOS: tapping the open tab scrolls its page to the top. From a page
                // under it (Categories under Posts) the link goes back up to the section.
                if (active && pathname === tab.to) {
                  event.preventDefault();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className={cn(tabClass, active ? 'text-tint' : 'text-muted-foreground')}
            >
              <tab.icon aria-hidden />
              <span className="truncate">{tab.title}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          className={cn(tabClass, moreActive ? 'text-tint' : 'text-muted-foreground')}
        >
          <MoreHorizontalIcon aria-hidden />
          <span>More</span>
        </button>
      </div>
      <MoreSheet
        user={user}
        open={moreOpen}
        onOpenChange={setMoreOpen}
        tabs={tabs.map((t) => t.to)}
      />
    </nav>
  );
}

type Row = { title: string; to?: NavItem['to']; href?: string; icon?: NavItem['icon'] };

// The sidebar shows a section's pages without icons; a list row reads better with one.
const childIcons: Partial<Record<NonNullable<NavItem['to']>, NavItem['icon']>> = {
  '/posts/new': FilePlus2Icon,
  '/posts/categories': FolderIcon,
  '/posts/tags': TagIcon,
  '/events/overview': ChartAreaIcon,
};

/** Two initials for the avatar's fallback. */
function initialsOf(user: SessionUser) {
  return (user.name || user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function MoreSheet({
  user,
  open,
  onOpenChange,
  tabs,
}: {
  user: SessionUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabs: string[];
}) {
  const { pathname } = useLocation();

  const { signingOut, signOut } = useSignOut();
  const theme = useThemeChoice();

  // Everything the sidebar offers that is not already a tab, in the sidebar's
  // order. A section with its own pages (Posts) gets a group of its own.
  const sections: { label: string; rows: Row[] }[] = [];
  for (const group of navGroups) {
    const rows: Row[] = [];
    for (const item of group.items.filter((i) => isNavItemAllowed(i, user) && !i.settings)) {
      if (item.items) {
        const children = item.items.filter(
          (c) => c.to && !tabs.includes(c.to) && isNavItemAllowed(c, user)
        );
        const rows = children.map((c) => ({ ...c, icon: c.icon ?? (c.to && childIcons[c.to]) }));
        if (rows.length) sections.push({ label: item.title, rows });
      } else if (item.to && !tabs.includes(item.to)) {
        rows.push(item);
      }
    }
    if (rows.length) sections.push({ label: group.label, rows });
  }
  sections.push({ label: '', rows: footerLinks });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-(--ios-grouped)">
        <SheetHeader title="More" onDone={() => onOpenChange(false)} />
        <DrawerBody className="flex flex-col gap-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          {/* The account first, as iOS Settings opens with the Apple Account. */}
          <Link
            to="/profile"
            onClick={() => onOpenChange(false)}
            className={cn(
              sheetGroupClass,
              'flex min-h-19 items-center gap-3 divide-y-0 px-4 py-2.5 active:bg-(--ios-fill)'
            )}
          >
            <Avatar className="size-15">
              {avatarSrc(user) && <AvatarImage src={avatarSrc(user)} alt="" />}
              <AvatarFallback className="text-lg">{initialsOf(user)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[1.25rem] leading-tight">
                {user.name || user.email}
              </span>
              <span className="block truncate text-[0.9375rem] text-(--ios-secondary)">
                {user.email}
              </span>
            </span>
            <ChevronRightIcon aria-hidden className="size-4 text-(--ios-secondary) opacity-60" />
          </Link>
          {sections.map((section) => (
            <section key={section.label || 'links'}>
              {section.label && (
                <h2 className="mb-1.5 px-4 text-[0.8125rem] text-(--ios-secondary) uppercase">
                  {section.label}
                </h2>
              )}
              <ul className={sheetGroupClass}>
                {section.rows.map((row) => (
                  <li key={row.to ?? row.href}>
                    <MoreRow
                      row={row}
                      active={!!row.to && isTabActive(row.to, pathname)}
                      onNavigate={() => onOpenChange(false)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div
            className={cn(
              sheetGroupClass,
              'flex min-h-11 items-center gap-3 divide-y-0 px-4 py-1.5'
            )}
          >
            <span aria-hidden className="shrink-0 text-[1.0625rem]">
              Theme
            </span>
            <SegmentedControl
              label="Theme"
              value={theme.effective}
              onValueChange={(next) => void theme.choose(next)}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'Device' },
              ]}
            />
          </div>
          <ul className={sheetGroupClass}>
            <li>
              <button
                type="button"
                onClick={signOut}
                aria-busy={signingOut || undefined}
                className={cn(sheetRowClass, 'text-destructive justify-center')}
              >
                {signingOut && <Spinner aria-hidden />}
                <SignOutLabel signingOut={signingOut} />
              </button>
            </li>
          </ul>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

function MoreRow({
  row,
  active,
  onNavigate,
}: {
  row: Row;
  active: boolean;
  onNavigate: () => void;
}) {
  const className = sheetRowClass;
  const content = (
    <>
      {row.icon ? (
        <row.icon aria-hidden className="text-muted-foreground" />
      ) : (
        <span aria-hidden className="w-5.5" />
      )}
      <span className={cn('flex-1 truncate', active && 'text-tint font-medium')}>{row.title}</span>
      {row.to && <ChevronRightIcon aria-hidden className="text-muted-foreground/60 size-4!" />}
    </>
  );

  if (row.href) {
    return (
      <a href={row.href} target="_blank" rel="noreferrer" className={className}>
        {content}
      </a>
    );
  }
  if (!row.to) return null;
  return (
    <Link
      to={row.to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={className}
    >
      {content}
    </Link>
  );
}
