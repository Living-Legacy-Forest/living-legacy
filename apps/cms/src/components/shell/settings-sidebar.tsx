import { Link, useLocation, useRouter } from '@tanstack/react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { ChevronLeftIcon } from '@/components/icons';
import { SearchInput } from '@/components/list/list-tools';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { motionTokens } from '@/components/arc/lib/motion-tokens';
import { lastAppPath } from '@/lib/last-app-path';
import type { SessionUser } from '@/lib/session';
import { isSettingsNavItemActive, settingsNavFor } from '@/lib/settings-nav';
import { SidebarRow } from './sidebar-row';

/**
 * The sidebar while you are in Settings, in place of the app's: a way back, a search over the
 * settings, and every page of Settings under its group. Phones have no sidebar; /settings is the
 * same list there.
 */
export function SettingsSidebar({ user }: { user: SessionUser }) {
  const { pathname } = useLocation();
  const router = useRouter();
  const reduced = useReducedMotion() ?? false;
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const groups = settingsNavFor(user)
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !q ||
          item.title.toLowerCase().includes(q) ||
          item.children?.some((c) => c.title.toLowerCase().includes(q))
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Sidebar collapsible="offcanvas" variant="inset">
      <SidebarHeader className="gap-2 pb-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarRow
              icon={ChevronLeftIcon}
              label="Back to app"
              wide
              onClick={() => router.history.push(lastAppPath())}
            />
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-0.5">
          <SearchInput
            label="Search settings"
            placeholder="Search settings"
            value={query}
            onChange={setQuery}
          />
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-0 px-2">
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="p-0 pb-2">
            <p className="text-sidebar-foreground/60 text-ui px-2.5 pt-1 pb-0.5 font-medium">
              {group.label}
            </p>
            <SidebarMenu className="gap-0.5">
              {group.items.map((item) => {
                const active = isSettingsNavItemActive(item, pathname);
                // Pages under an item show while it is open, or when a search matches one.
                const children = item.children?.filter(
                  (c) => (active && !q) || (q && c.title.toLowerCase().includes(q))
                );
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarRow
                      icon={item.icon}
                      label={item.title}
                      wide
                      // Its pages carry the highlight, so the parent doesn't also light up.
                      active={active && !item.children}
                      render={<Link to={item.to} />}
                    />
                    {/* Opens and closes by height, quicker out than in; reduced motion only fades. */}
                    <AnimatePresence initial={false}>
                      {children && children.length > 0 && (
                        <motion.div
                          key="pages"
                          className="overflow-hidden"
                          initial={{ height: reduced ? 'auto' : 0, opacity: 0 }}
                          animate={{
                            height: 'auto',
                            opacity: 1,
                            transition: {
                              height: motionTokens.spring.smooth,
                              opacity: {
                                duration: motionTokens.duration.standard,
                                ease: [...motionTokens.ease.standard],
                              },
                            },
                          }}
                          exit={{
                            height: reduced ? 'auto' : 0,
                            opacity: 0,
                            transition: {
                              duration: motionTokens.duration.exit,
                              ease: [...motionTokens.ease.exit],
                            },
                          }}
                        >
                          <SidebarMenuSub>
                            {children.map((child) => (
                              <SidebarMenuSubItem key={child.to}>
                                <SidebarMenuSubButton
                                  isActive={pathname === child.to}
                                  // Smaller than the rows above, with their active colour.
                                  size="sm"
                                  className="text-sidebar-foreground/80 data-active:bg-sidebar-active data-active:text-sidebar-active-foreground"
                                  render={<Link to={child.to} />}
                                >
                                  <span>{child.title}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
        {groups.length === 0 && (
          <p className="text-muted-foreground px-2.5 py-4 text-sm">Nothing matches that.</p>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
