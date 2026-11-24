import { Link, useLocation, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ChevronLeftIcon } from '@/components/icons';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { editorBack, findNavItem, isEditorPath, isTabActive, phoneTabs } from '@/lib/nav';
import type { SessionUser } from '@/lib/session';
import { AppBreadcrumbs } from './app-breadcrumbs';
import { Logo } from './logo';
import { NavUser } from './nav-user';
import { Notifications } from './notifications';
import { SystemStatus } from './system-status';

export function AppHeader({ user }: { user: SessionUser }) {
  const { pathname } = useLocation();
  const item = findNavItem(pathname);
  const current = item && item.to !== pathname ? 'Edit' : undefined;
  const { collapsed, scrolled, title } = useLargeTitle(pathname);

  // Phones have no sidebar or breadcrumb: a page below a tab gets a back button. That includes a
  // page of its own inside a tab (Analytics > Pages, Posts > Tags), which goes back to the tab's
  // first screen, as a screen pushed inside an iOS tab does.
  const tab = phoneTabs.find((t) => t.to !== pathname && isTabActive(t.to, pathname));
  const back =
    editorBack(pathname) ??
    (item?.to && item.to !== pathname ? { to: item.to, label: item.title } : null) ??
    (tab ? { to: tab.to, label: tab.title } : null);
  // The Analytics screens share their period (?days), so going back keeps the one chosen.
  const { days } = useSearch({ strict: false }) as { days?: number };
  const backSearch = back?.to === '/analytics' && days ? { days } : undefined;

  // Desktop: the page scrolls behind the inset frame, so the header pins where
  // the frame starts and paints the gap and corners above it in the sidebar colour.
  // Its background reaches under the bottom border, which is see-through, and draws the line.
  return (
    <header
      data-slot="app-header"
      data-scrolled={scrolled || undefined}
      className="bg-background/80 max-md:data-scrolled:border-border/70 md:before:bg-sidebar md:after:bg-background md:after:border-border sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 rounded-t-[inherit] border-b px-4 backdrop-blur max-md:h-[calc(2.75rem+env(safe-area-inset-top))] max-md:border-transparent max-md:pt-[env(safe-area-inset-top)] max-md:pr-[max(0.5rem,env(safe-area-inset-right))] max-md:pl-[max(0.5rem,env(safe-area-inset-left))] max-md:backdrop-blur-xl max-md:backdrop-saturate-150 max-md:transition-colors md:top-2 md:bg-transparent md:px-6 md:backdrop-blur-none md:before:absolute md:before:inset-x-0 md:before:-top-2 md:before:-z-20 md:before:h-5 md:after:absolute md:after:inset-x-0 md:after:top-0 md:after:-bottom-px md:after:-z-10 md:after:rounded-t-[inherit] md:after:border-b"
    >
      <div className="flex min-w-0 items-center gap-3 max-md:hidden">
        <AppBreadcrumbs item={item} current={current} />
      </div>

      {back && (
        <Link
          to={back.to}
          search={backSearch}
          className="text-tint relative z-10 -ml-1 flex min-h-11 max-w-[30%] min-w-0 items-center pr-2 text-sm active:opacity-50 md:hidden"
        >
          {/* Sized in em so it stays in proportion with the label: a little taller
              than the capitals, with a stroke close to the letters' weight. The
              drawing has empty space either side, which the margin takes back, and
              it reads slightly low against the capitals, which the nudge corrects. */}
          <ChevronLeftIcon
            aria-hidden
            strokeWidth={1.7}
            className="-mr-[0.22em] size-[1.4em] -translate-y-[0.05em]"
          />
          <span className="truncate">{back.label}</span>
        </Link>
      )}
      {/* Phones: a screen with no back link has the logo at the left, which goes home, and the
          page's Edit after it (PageActions). A page below a tab has the back link instead. */}
      {!back && (
        <>
          <Link
            to="/"
            aria-label="Dashboard"
            className="relative z-10 -ml-0.5 flex size-11 shrink-0 items-center justify-center active:opacity-50 md:hidden"
          >
            <Logo className="size-6" />
          </Link>
          <div
            data-slot="page-actions-start"
            className="relative z-10 -ml-1 flex items-center md:hidden"
          />
        </>
      )}

      {/* The large title's compact twin, shown once the large one scrolls away.
          Centred on the screen, clear of the sides: at most a short back label on
          the left and two 44pt buttons on the right, so 6.5rem each side. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 flex h-11 items-center justify-center px-[6.5rem] transition-opacity duration-200 md:hidden"
        style={{ opacity: collapsed ? 1 : 0 }}
      >
        <span className="truncate text-[1.0625rem] font-semibold">{title}</span>
      </div>

      {/* Phones: a title the page sets itself (PageActions), for a screen with no large one.
          In the row, not centred on the screen, so it uses all the room between the sides. */}
      <div
        data-slot="page-actions-title"
        className="flex min-w-0 flex-1 justify-center px-1 empty:hidden md:hidden"
      />

      <div className="relative z-10 ml-auto flex items-center gap-1.5 max-md:gap-0">
        {/* The editor's bar needs the room for its title and Publish. */}
        {/* Desktop only: a phone's bar has no room, and admins see it on the dashboard. */}
        <div className="max-md:hidden">
          <SystemStatus user={user} />
        </div>
        <div className={cn('contents', isEditorPath(pathname) && 'max-md:hidden')}>
          <Notifications user={user} />
        </div>
        {/* Phones: the page's … and + (PageActions). The account lives in More. */}
        <div data-slot="page-actions-end" className="flex items-center md:hidden" />
        <Separator
          className="mx-1.5 h-4 data-[orientation=vertical]:self-center max-md:hidden"
          orientation="vertical"
        />
        <div className="max-md:hidden">
          <NavUser user={user} />
        </div>
      </div>
    </header>
  );
}

/**
 * Whether the page's large title ([data-slot="page-title"]) has scrolled
 * under the header, and whether the page has scrolled at all. Phones only.
 */
function useLargeTitle(pathname: string) {
  const isMobile = useIsMobile();
  const [state, setState] = useState({ collapsed: false, scrolled: false, title: '' });

  useEffect(() => {
    if (!isMobile) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const heading = document.querySelector<HTMLElement>('[data-slot="page-title"]');
      const header = document.querySelector<HTMLElement>('[data-slot="app-header"]');
      const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
      const next = {
        collapsed: !!heading && heading.getBoundingClientRect().bottom <= headerBottom,
        scrolled: window.scrollY > 0,
        title: heading?.textContent?.trim() ?? '',
      };
      setState((prev) =>
        prev.collapsed === next.collapsed &&
        prev.scrolled === next.scrolled &&
        prev.title === next.title
          ? prev
          : next
      );
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [isMobile, pathname]);

  return state;
}
