import type { CSSProperties, ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { SessionUser } from '@/lib/session';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  return (
    <SidebarProvider style={{ '--sidebar-width': '15rem' } as CSSProperties}>
      <AppSidebar user={user} />
      {/* A white panel on the sidebar surface: hairline edge, no shadow. */}
      <SidebarInset className="md:peer-data-[variant=inset]:ring-sidebar-border p-4 md:p-6 md:peer-data-[variant=inset]:rounded-lg md:peer-data-[variant=inset]:shadow-none md:peer-data-[variant=inset]:ring-1">
        <AppHeader user={user} />
        <div className="flex flex-1 flex-col gap-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
