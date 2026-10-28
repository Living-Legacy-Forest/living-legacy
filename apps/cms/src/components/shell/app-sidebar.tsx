import { can } from '@llf/content';
import { Link } from '@tanstack/react-router';
import { PlusIcon, TreeDeciduous } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { type NavItem, footerLinks, navGroups } from '@/lib/nav';
import type { SessionUser } from '@/lib/session';
import { NavGroup } from './nav-group';

export function AppSidebar({ user }: { user: SessionUser }) {
  const allowed = (item: NavItem) => !item.permission || can(user.role, item.permission);

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader className="h-14 justify-center">
        <SidebarMenuButton render={<Link to="/" />}>
          <TreeDeciduous aria-hidden />
          <span className="font-medium">Living Legacy Forest</span>
        </SidebarMenuButton>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenuItem>
            {/* Wired up when the post editor lands (milestone 3). */}
            <SidebarMenuButton
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground min-w-8 duration-200 ease-linear disabled:opacity-60"
              tooltip="New post (coming soon)"
              disabled
            >
              <PlusIcon aria-hidden />
              <span>New post</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarGroup>
        {navGroups.map((group) => {
          const items = group.items.filter(allowed);
          return items.length ? (
            <NavGroup key={group.label} label={group.label} items={items} />
          ) : null;
        })}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {footerLinks.map((link) => (
            <SidebarMenuItem key={link.title}>
              <SidebarMenuButton
                className="text-muted-foreground"
                size="sm"
                tooltip={link.title}
                render={<a href={link.href} target="_blank" rel="noreferrer" />}
              >
                <link.icon aria-hidden />
                <span>{link.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
