import { Link, useLocation } from '@tanstack/react-router';
import { ChevronRightIcon } from '@/components/icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { type NavGroup as NavGroupType, type NavItem, isNavItemActive } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { navItemClass, navItemSoonClass } from './nav-styles';

const isSoon = (item: NavItem) => !item.to && !item.items?.some((sub) => sub.to);

export function NavGroup({ label, items }: NavGroupType) {
  const { pathname } = useLocation();

  return (
    <SidebarGroup className="py-1">
      {label && (
        <SidebarGroupLabel className="text-sidebar-foreground/50 h-7 px-2 text-xs font-medium">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarMenu className="gap-px">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            isNavItemActive(item, pathname) ||
            !!item.items?.some((sub) => isNavItemActive(sub, pathname));

          if (isSoon(item)) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  aria-disabled
                  title={`${item.title}: coming soon`}
                  tooltip={`${item.title} (coming soon)`}
                  className={cn(navItemClass, navItemSoonClass)}
                >
                  {Icon && <Icon aria-hidden />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
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
                  render={
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={active}
                      // Open, the current page below carries the highlight, so the
                      // parent keeps its text but not a second filled row. Collapsed
                      // to icons, it is the only sign of where you are, so it keeps it.
                      className={cn(
                        navItemClass,
                        'data-active:data-panel-open:hover:bg-sidebar-accent group-data-[collapsible=icon]:data-active:bg-sidebar-accent! data-active:data-panel-open:bg-transparent'
                      )}
                    />
                  }
                >
                  {Icon && <Icon aria-hidden />}
                  <span>{item.title}</span>
                  <ChevronRightIcon
                    aria-hidden
                    className="ml-auto size-3.5! transition-transform duration-150 in-data-[panel-open]:rotate-90 motion-reduce:transition-none"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="border-sidebar-border mr-0 gap-px py-0.5">
                    {item.items.map((sub) => (
                      <SidebarMenuSubItem key={sub.title}>
                        {sub.to ? (
                          <SidebarMenuSubButton
                            isActive={isNavItemActive(sub, pathname)}
                            className="h-7 text-[13px]"
                            render={<Link to={sub.to} />}
                          >
                            <span>{sub.title}</span>
                          </SidebarMenuSubButton>
                        ) : (
                          <SidebarMenuSubButton
                            aria-disabled
                            className={cn('h-7 text-[13px]', navItemSoonClass)}
                          >
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
                className={navItemClass}
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
