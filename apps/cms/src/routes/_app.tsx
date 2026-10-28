import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { getCurrentUser } from '@/lib/session';

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) throw redirect({ to: '/login' });
    return { user };
  },
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 self-center data-[orientation=vertical]:h-4"
          />
          <span className="text-muted-foreground text-sm">Living Legacy Forest</span>
        </header>
        <div className="flex-1 p-4 md:p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
