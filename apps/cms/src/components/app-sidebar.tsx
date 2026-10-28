import { can } from '@llf/content';
import { Link, useLocation, useRouter } from '@tanstack/react-router';
import { ChevronsUpDown, LogOut, TreeDeciduous } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { authClient } from '@/lib/auth-client';
import { navGroups } from '@/lib/nav';
import type { SessionUser } from '@/lib/session';

export function AppSidebar({ user }: { user: SessionUser }) {
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/" />}>
              <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-md">
                <TreeDeciduous className="size-4" aria-hidden />
              </span>
              <span className="grid text-left leading-tight">
                <span className="truncate font-medium">Living Legacy Forest</span>
                <span className="text-muted-foreground truncate text-xs">Content manager</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => {
          const items = group.items.filter(
            (item) => !item.permission || can(user.role, item.permission)
          );
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    {item.to ? (
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={pathname === item.to}
                        render={<Link to={item.to} />}
                      >
                        <item.icon aria-hidden />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    ) : (
                      <>
                        <SidebarMenuButton
                          tooltip={`${item.title} (coming soon)`}
                          disabled
                          className="opacity-60"
                        >
                          <item.icon aria-hidden />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                        <SidebarMenuBadge>
                          <Badge variant="outline">Soon</Badge>
                        </SidebarMenuBadge>
                      </>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <UserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  async function signOut() {
    await authClient.signOut();
    await router.navigate({ to: '/login' });
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
            <Avatar className="size-8 rounded-md">
              {user.image && <AvatarImage src={user.image} alt="" />}
              <AvatarFallback className="rounded-md">{initials}</AvatarFallback>
            </Avatar>
            <span className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="text-muted-foreground truncate text-xs capitalize">{user.role}</span>
            </span>
            <ChevronsUpDown className="ml-auto size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <span className="block truncate font-medium">{user.name}</span>
                <span className="text-muted-foreground block truncate text-xs font-normal">
                  {user.email}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
