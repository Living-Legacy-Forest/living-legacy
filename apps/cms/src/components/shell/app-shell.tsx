import { getRouteApi } from '@tanstack/react-router';
import { type CSSProperties, type ReactNode, useRef, useState } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { NavPrefs } from '@/lib/nav-prefs';
import { rememberNavPrefs } from '@/lib/nav-prefs-cookie';
import type { SessionUser } from '@/lib/session';
import {
  type ShownSidebarState,
  type SidebarState,
  rememberSidebarState,
} from '@/lib/sidebar-state';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { SidebarLayoutContext } from './sidebar-layout';
import { PageSkeleton, usePendingPathname } from './page-skeleton';
import { PasskeyNudge } from './passkey-nudge';
import { PullToRefresh } from './pull-to-refresh';
import { TabBar } from './tab-bar';
import { PhoneUpdateStrip, UpdatesProvider } from './updates';

const rootRoute = getRouteApi('__root__');

export function AppShell({
  user,
  sidebar,
  navPrefs,
  children,
}: {
  user: SessionUser;
  sidebar: SidebarState;
  navPrefs: NavPrefs;
  children: ReactNode;
}) {
  const pendingPathname = usePendingPathname();
  const [layout, setLayout] = useState(sidebar);
  // Whoever has not picked a column count follows the site's setting.
  const { sidebarColumns: siteColumns } = rootRoute.useLoaderData();
  const shown: ShownSidebarState = { ...layout, columns: layout.columns ?? siteColumns };
  // The one-column sidebar can be hidden outright (⌘B); the two-column one only narrows.
  const [hidden, setHidden] = useState(false);
  const oneColumn = shown.columns === 1;
  const changeLayout = (patch: Partial<SidebarState>) => {
    const next = { ...layout, ...patch };
    setLayout(next);
    rememberSidebarState(next);
  };
  // An update function, applied to the latest, so Undo on a toast never works from stale prefs.
  const [prefs, setPrefs] = useState(navPrefs);
  const latestPrefs = useRef(prefs);
  const changePrefs = (update: (prefs: NavPrefs) => NavPrefs) => {
    const next = update(latestPrefs.current);
    if (next === latestPrefs.current) return;
    latestPrefs.current = next;
    setPrefs(next);
    rememberNavPrefs(next);
  };

  return (
    <SidebarLayoutContext.Provider value={{ layout, siteColumns, setLayout: changeLayout }}>
      <UpdatesProvider joinedAt={user.createdAt}>
        {/* Two columns: the sidebar is always open and its columns widen and narrow instead, so ⌘B
          and the command menu's Toggle sidebar show or hide the pages' names. One column: they
          hide the whole sidebar. */}
        <SidebarProvider
          open={oneColumn ? !hidden : true}
          onOpenChange={(next) =>
            oneColumn ? setHidden(!next) : changeLayout({ pagesWide: !layout.pagesWide })
          }
          style={sidebarWidths(shown)}
        >
          <AppSidebar
            user={user}
            layout={shown}
            onLayoutChange={changeLayout}
            prefs={prefs}
            onPrefsChange={changePrefs}
          />
          {/* Phones: iOS's grouped background, which lists and cards sit on. */}
          {/* Flat: the stock inset card has a soft shadow that reads as a line down its edge. */}
          <SidebarInset className="max-md:bg-(--ios-grouped) md:peer-data-[variant=inset]:shadow-none">
            <AppHeader user={user} />
            {/* On phones: clear the tab bar, and the notch in landscape. Pulling down at the top
              of the page reloads it, as an iOS list does. */}
            <PullToRefresh className="flex flex-1 flex-col gap-4 p-4 max-md:pr-[max(1rem,env(safe-area-inset-right))] max-md:pb-[calc(var(--tab-bar-height)+1.5rem)] max-md:pl-[max(1rem,env(safe-area-inset-left))] md:p-6">
              <PhoneUpdateStrip />
              {pendingPathname && <PageSkeleton pathname={pendingPathname} />}
              {/* Hidden, not unmounted, so a cancelled navigation keeps the page's state. */}
              <div className={pendingPathname ? 'hidden' : 'contents'}>{children}</div>
            </PullToRefresh>
          </SidebarInset>
          <TabBar user={user} />
          <PasskeyNudge />
        </SidebarProvider>
      </UpdatesProvider>
    </SidebarLayoutContext.Provider>
  );
}

const RAIL_WIDE = '12rem';
const PAGES_WIDE = '13rem';
/** An icon-only column: the icon centred, with the row's padding either side. */
const NARROW = '3.25rem';

/** Each column's width, and the sidebar's as their sum plus the inset frame's padding. */
function sidebarWidths({ railWide, pagesWide, columns }: ShownSidebarState) {
  if (columns === 1) return { '--sidebar-width': '16rem' } as CSSProperties;
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
