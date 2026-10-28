import { can } from '@llf/content';
import { Link } from '@tanstack/react-router';
import { TreeDeciduous } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { type NavItem, footerLinks, navGroups } from '@/lib/nav';
import type { SessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';
import { NavGroup } from './nav-group';
import { navItemClass } from './nav-styles';

export function AppSidebar({ user }: { user: SessionUser }) {
  const allowed = (item: NavItem) => !item.permission || can(user.role, item.permission);

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="pb-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Living Legacy Forest"
              className="h-8 gap-2.5 px-1.5 text-[13px] font-semibold"
              render={<Link to="/" />}
            >
              <span className="bg-foreground text-background flex size-5 shrink-0 items-center justify-center rounded-[5px]">
                <TreeDeciduous aria-hidden className="size-3!" />
              </span>
              <span>Living Legacy Forest</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {navGroups.map((group) => {
          const items = group.items.filter(allowed);
          return items.length ? (
            <NavGroup key={group.label || 'top'} label={group.label} items={items} />
          ) : null;
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {footerLinks.map((link) => (
            <SidebarMenuItem key={link.title}>
              <SidebarMenuButton
                tooltip={link.title}
                className={cn(navItemClass, 'text-sidebar-foreground/60')}
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
