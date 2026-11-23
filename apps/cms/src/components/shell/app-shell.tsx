import { type CSSProperties, type ReactNode, useState } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { SessionUser } from '@/lib/session';
import { type SidebarState, rememberSidebarState } from '@/lib/sidebar-state';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { PageSkeleton, usePendingPathname } from './page-skeleton';
import { PasskeyNudge } from './passkey-nudge';
import { TabBar } from './tab-bar';
import { PhoneUpdateStrip, UpdatesProvider } from './updates';

export function AppShell({
  user,
  sidebar,
  children,
}: {
  user: SessionUser;
  sidebar: SidebarState;
  children: ReactNode;
}) {
  const pendingPathname = usePendingPathname();
  const [layout, setLayout] = useState(sidebar);
  const changeLayout = (next: SidebarState) => {
    setLayout(next);
    rememberSidebarState(next);
  };

  return (
    <UpdatesProvider joinedAt={user.createdAt}>
      {/* The sidebar is always open: its two columns widen and narrow instead. ⌘B, and the
          command menu's Toggle sidebar, show or hide the pages' names. */}
      <SidebarProvider
        open
        onOpenChange={() => changeLayout({ ...layout, pagesWide: !layout.pagesWide })}
        style={sidebarWidths(layout)}
      >
        <AppSidebar user={user} layout={layout} onLayoutChange={changeLayout} />
        {/* Phones: iOS's grouped background, which lists and cards sit on. */}
        <SidebarInset className="max-md:bg-(--ios-grouped)">
          <AppHeader user={user} />
          {/* On phones: clear the tab bar, and the notch in landscape. */}
          <div className="flex flex-1 flex-col gap-4 p-4 max-md:pr-[max(1rem,env(safe-area-inset-right))] max-md:pb-[calc(var(--tab-bar-height)+1.5rem)] max-md:pl-[max(1rem,env(safe-area-inset-left))] md:p-6">
            <PhoneUpdateStrip />
            {pendingPathname && <PageSkeleton pathname={pendingPathname} />}
            {/* Hidden, not unmounted, so a cancelled navigation keeps the page's state. */}
            <div className={pendingPathname ? 'hidden' : 'contents'}>{children}</div>
          </div>
        </SidebarInset>
        <TabBar user={user} />
        <PasskeyNudge />
      </SidebarProvider>
    </UpdatesProvider>
  );
}

const RAIL_WIDE = '12rem';
const PAGES_WIDE = '13rem';
/** An icon-only column: the icon centred, with the row's padding either side. */
const NARROW = '3.25rem';

/** Each column's width, and the sidebar's as their sum plus the inset frame's padding. */
function sidebarWidths({ railWide, pagesWide }: SidebarState) {
  const rail = railWide ? RAIL_WIDE : NARROW;
  const pages = pagesWide ? PAGES_WIDE : NARROW;
  return {
    '--rail-wide': RAIL_WIDE,
    '--pages-wide': PAGES_WIDE,
    '--rail-narrow': NARROW,
    '--pages-narrow': NARROW,
    '--sidebar-width': `calc(${rail} + ${pages} + 1rem + 1px)`,
  } as CSSProperties;
}
