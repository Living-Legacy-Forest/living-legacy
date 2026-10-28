import { Link, useLocation } from '@tanstack/react-router';
import { ChevronRightIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import type { NavGroup as NavGroupType, NavItem } from '@/lib/nav';

const isSoon = (item: NavItem) => !item.to && !item.items?.some((sub) => sub.to);

export function NavGroup({ label, items }: NavGroupType) {
  const { pathname } = useLocation();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.to === pathname || !!item.items?.some((sub) => sub.to === pathname);

          if (isSoon(item)) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={`${item.title} (coming soon)`}
                  disabled
                  className="opacity-60"
                >
                  {Icon && <Icon aria-hidden />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>
                  <Badge variant="outline">Soon</Badge>
                </SidebarMenuBadge>
              </SidebarMenuItem>
            );
          }

          if (item.items?.length) {
            return (
              <Collapsible
                key={item.title}
                className="group/collapsible"
                defaultOpen={active}
                render={<SidebarMenuItem />}
              >
                <CollapsibleTrigger
                  render={<SidebarMenuButton tooltip={item.title} isActive={active} />}
                >
                  {Icon && <Icon aria-hidden />}
                  <span>{item.title}</span>
                  <ChevronRightIcon
                    aria-hidden
                    className="ml-auto transition-transform duration-200 in-data-[panel-open]:rotate-90"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items.map((sub) => (
                      <SidebarMenuSubItem key={sub.title}>
                        {sub.to ? (
                          <SidebarMenuSubButton
                            isActive={sub.to === pathname}
                            render={<Link to={sub.to} />}
                          >
                            <span>{sub.title}</span>
                          </SidebarMenuSubButton>
                        ) : (
                          <SidebarMenuSubButton aria-disabled className="opacity-60">
                            <span>{sub.title}</span>
                          </SidebarMenuSubButton>
                        )}
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            );
          }

          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={active}
                render={<Link to={item.to ?? '/'} />}
              >
                {Icon && <Icon aria-hidden />}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
