import type { CSSProperties, ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { SessionUser } from '@/lib/session';
import type { SidebarState } from '@/lib/sidebar-state';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { PageSkeleton, usePendingPathname } from './page-skeleton';
import { TabBar } from './tab-bar';

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

  return (
    <SidebarProvider
      defaultOpen={sidebar.open}
      style={{ '--sidebar-width': '15rem' } as CSSProperties}
    >
      <AppSidebar user={user} sections={sidebar.sections} />
      {/* Phones: iOS's grouped background, which lists and cards sit on. */}
      <SidebarInset className="max-md:bg-(--ios-grouped)">
        <AppHeader user={user} />
        {/* On phones: clear the tab bar, and the notch in landscape. */}
        <div className="flex flex-1 flex-col gap-4 p-4 max-md:pr-[max(1rem,env(safe-area-inset-right))] max-md:pb-[calc(var(--tab-bar-height)+1.5rem)] max-md:pl-[max(1rem,env(safe-area-inset-left))] md:p-6">
          {pendingPathname && <PageSkeleton pathname={pendingPathname} />}
          {/* Hidden, not unmounted, so a cancelled navigation keeps the page's state. */}
          <div className={pendingPathname ? 'hidden' : 'contents'}>{children}</div>
        </div>
      </SidebarInset>
      <TabBar user={user} />
    </SidebarProvider>
  );
}
