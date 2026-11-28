import { Link, useLocation, useRouter } from '@tanstack/react-router';
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
} from '@/components/ui/sidebar';
import { lastAppPath } from '@/lib/last-app-path';
import type { SessionUser } from '@/lib/session';
import { isSettingsItemActive, settingsNavFor } from '@/lib/settings-nav';
import { SidebarRow } from './sidebar-row';

/**
 * The sidebar while you are in Settings, in place of the app's: a way back, a search over the
 * settings, and every page of Settings under its group. Phones have no sidebar; /settings is the
 * same list there.
 */
export function SettingsSidebar({ user }: { user: SessionUser }) {
  const { pathname } = useLocation();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const groups = settingsNavFor(user)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !q || item.title.toLowerCase().includes(q)),
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
              {group.items.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarRow
                    icon={item.icon}
                    label={item.title}
                    wide
                    active={isSettingsItemActive(item.to, pathname)}
                    render={<Link to={item.to} />}
                  />
                </SidebarMenuItem>
              ))}
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
