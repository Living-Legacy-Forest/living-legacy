import { useLocation } from '@tanstack/react-router';
import { Separator } from '@/components/ui/separator';
import { findNavItem } from '@/lib/nav';
import type { SessionUser } from '@/lib/session';
import { AppBreadcrumbs } from './app-breadcrumbs';
import { CustomSidebarTrigger } from './custom-sidebar-trigger';
import { NavUser } from './nav-user';

export function AppHeader({ user }: { user: SessionUser }) {
  const { pathname } = useLocation();
  const item = findNavItem(pathname);
  const current = item && item.to !== pathname ? 'Edit' : undefined;

  return (
    <header className="mb-6 flex items-center justify-between gap-2 md:px-2">
      <div className="flex items-center gap-3">
        <CustomSidebarTrigger />
        <Separator
          className="mr-2 h-4 data-[orientation=vertical]:self-center"
          orientation="vertical"
        />
        <AppBreadcrumbs item={item} current={current} />
      </div>
      <NavUser user={user} />
    </header>
  );
}
