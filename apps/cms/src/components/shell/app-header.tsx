import { useLocation } from '@tanstack/react-router';
import { Separator } from '@/components/ui/separator';
import { findNavItem } from '@/lib/nav';
import type { SessionUser } from '@/lib/session';
import { AppBreadcrumbs } from './app-breadcrumbs';
import { CommandMenu } from './command-menu';
import { CustomSidebarTrigger } from './custom-sidebar-trigger';
import { NavUser } from './nav-user';
import { Notifications } from './notifications';

export function AppHeader({ user }: { user: SessionUser }) {
  const { pathname } = useLocation();
  const item = findNavItem(pathname);
  const current = item && item.to !== pathname ? 'Edit' : undefined;

  return (
    <header className="bg-background/80 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 rounded-t-[inherit] border-b px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <CustomSidebarTrigger />
        <Separator className="h-4 data-[orientation=vertical]:self-center" orientation="vertical" />
        <AppBreadcrumbs item={item} current={current} />
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <div className="hidden md:block">
          <CommandMenu user={user} />
        </div>
        <Notifications user={user} />
        <Separator
          className="mx-1.5 h-4 data-[orientation=vertical]:self-center"
          orientation="vertical"
        />
        <NavUser user={user} />
      </div>
    </header>
  );
}
