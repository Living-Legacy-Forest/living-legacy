import { Link, useLocation } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ChevronLeftIcon } from '@/components/icons';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';
import { findNavItem, isEditorPath } from '@/lib/nav';
import type { SessionUser } from '@/lib/session';
import { AppBreadcrumbs } from './app-breadcrumbs';
import { CustomSidebarTrigger } from './custom-sidebar-trigger';
import { NavUser } from './nav-user';
import { Notifications } from './notifications';

export function AppHeader({ user }: { user: SessionUser }) {
  const { pathname } = useLocation();
  const item = findNavItem(pathname);
  const current = item && item.to !== pathname ? 'Edit' : undefined;
  const { collapsed, scrolled, title } = useLargeTitle(pathname);

  // Phones have no sidebar or breadcrumb: a page below a tab gets a back button.
  const back = isEditorPath(pathname)
    ? { to: '/posts' as const, label: 'Posts' }
    : item?.to && item.to !== pathname
      ? { to: item.to, label: item.title }
      : null;

  return (
    <header
      data-slot="app-header"
      data-scrolled={scrolled || undefined}
      className="bg-background/80 max-md:data-scrolled:border-border/70 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 rounded-t-[inherit] border-b px-4 backdrop-blur max-md:h-[calc(3.5rem+env(safe-area-inset-top))] max-md:border-transparent max-md:pt-[env(safe-area-inset-top)] max-md:pr-[max(0.5rem,env(safe-area-inset-right))] max-md:pl-[max(0.5rem,env(safe-area-inset-left))] max-md:backdrop-blur-xl max-md:backdrop-saturate-150 max-md:transition-colors md:px-6"
    >
      <div className="flex min-w-0 items-center gap-3 max-md:hidden">
        <CustomSidebarTrigger />
        <Separator className="h-4 data-[orientation=vertical]:self-center" orientation="vertical" />
        <AppBreadcrumbs item={item} current={current} />
      </div>

      {back && (
        <Link
          to={back.to}
          className="text-brand relative z-10 -ml-1 flex min-h-11 max-w-[30%] min-w-0 items-center pr-2 text-sm active:opacity-50 md:hidden"
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
      {/* Phones: the page's Edit goes here when there is no back link (PageActions). */}
      {!back && (
        <div
          data-slot="page-actions-start"
          className="relative z-10 -ml-1 flex items-center md:hidden"
        />
      )}

      {/* The large title's compact twin, shown once the large one scrolls away. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 flex h-14 items-center justify-center px-36 transition-opacity duration-200 md:hidden"
        style={{ opacity: collapsed ? 1 : 0 }}
      >
        <span className="truncate text-[1.0625rem] font-semibold">{title}</span>
      </div>

      <div className="relative z-10 ml-auto flex items-center gap-1.5 max-md:gap-0">
        <Notifications user={user} />
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
