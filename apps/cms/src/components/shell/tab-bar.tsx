import { Link, useLocation } from '@tanstack/react-router';
import { useState } from 'react';
import {
  ChevronRightIcon,
  FilePlus2Icon,
  FolderIcon,
  MoreHorizontalIcon,
  TagIcon,
} from '@/components/icons';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
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

const tabClass =
  'flex min-w-0 flex-col items-center justify-center gap-0.5 text-[0.625rem] font-medium tracking-tight transition-opacity active:opacity-50 [&_svg]:size-6';

/** iOS-style tab bar for phones; the sidebar takes over from md up. */
export function TabBar({ user }: { user: SessionUser }) {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  // The editor gets the whole screen, like a page pushed onto an iOS stack.
  if (isEditorPath(pathname)) return null;

  const tabs = phoneTabs.filter((tab) => isNavItemAllowed(tab, user.role));
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
              className={cn(tabClass, active ? 'text-brand' : 'text-muted-foreground')}
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
          className={cn(tabClass, moreActive ? 'text-brand' : 'text-muted-foreground')}
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
};

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

  // Everything the sidebar offers that is not already a tab, in the sidebar's
  // order. A section with its own pages (Posts) gets a group of its own.
  const sections: { label: string; rows: Row[] }[] = [];
  for (const group of navGroups) {
    const rows: Row[] = [];
    for (const item of group.items.filter((i) => isNavItemAllowed(i, user.role))) {
      if (item.items) {
        const children = item.items.filter(
          (c) => c.to && !tabs.includes(c.to) && isNavItemAllowed(c, user.role)
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="bg-muted/95 max-h-[85dvh] gap-0 overflow-y-auto rounded-t-2xl border-t-0 p-0 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
      >
        <div className="bg-muted/95 sticky top-0 z-10 flex items-center justify-between px-4 pt-3 pb-2 backdrop-blur-xl">
          <SheetTitle className="text-[1.0625rem] font-semibold">More</SheetTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-brand -mr-2 min-h-11 px-2 text-[1.0625rem] font-semibold active:opacity-50"
          >
            Done
          </button>
        </div>
        <div className="flex flex-col gap-6 px-4 pt-2 pb-6">
          {sections.map((section) => (
            <section key={section.label || 'links'}>
              {section.label && (
                <h2 className="text-muted-foreground mb-1.5 px-4 text-[0.8125rem]">
                  {section.label}
                </h2>
              )}
              <ul className="bg-background divide-border/70 divide-y overflow-hidden rounded-xl">
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
        </div>
      </SheetContent>
    </Sheet>
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
  const className =
    'flex min-h-11 items-center gap-3 px-4 text-[1.0625rem] transition-colors active:bg-muted [&_svg]:size-5.5';
  const content = (
    <>
      {row.icon ? (
        <row.icon aria-hidden className="text-muted-foreground" />
      ) : (
        <span aria-hidden className="w-5.5" />
      )}
      <span className={cn('flex-1 truncate', active && 'text-brand font-medium')}>{row.title}</span>
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
