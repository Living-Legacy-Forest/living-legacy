import type { CSSProperties, ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { SessionUser } from '@/lib/session';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { PageSkeleton, usePendingPathname } from './page-skeleton';

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const pendingPathname = usePendingPathname();

  return (
    <SidebarProvider style={{ '--sidebar-width': '15rem' } as CSSProperties}>
      <AppSidebar user={user} />
      <SidebarInset>
        <AppHeader user={user} />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          {pendingPathname && <PageSkeleton pathname={pendingPathname} />}
          {/* Hidden, not unmounted, so a cancelled navigation keeps the page's state. */}
          <div className={pendingPathname ? 'hidden' : 'contents'}>{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
