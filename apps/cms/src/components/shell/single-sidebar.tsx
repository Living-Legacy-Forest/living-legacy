import { Link, useLocation } from '@tanstack/react-router';
import { ChevronDownIcon, PanelLeftIcon } from '@/components/icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { findNavItem, sectionFor, sidebarSections } from '@/lib/nav';
import { type NavCountPath, sectionHasCount } from '@/lib/nav-counts';
import { useNavCounts } from '@/lib/nav-counts-store';
import { type ShownSection, applyNavPrefs, toggleCollapsed } from '@/lib/nav-prefs';
import { COLLAPSIBLE_CONTENT } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { CommandMenu } from './command-menu';
import { HelpMenu } from './help-menu';
import { useLoadNavCounts } from './load-nav-counts';
import { Logo } from './logo';
import { NavBadge, SectionDot } from './nav-badge';
import { useNavEditing } from './nav-editing';
import { ActionMenu, ColumnMenu, type NavAction, NavLinkMenu } from './sidebar-menus';
import { SidebarRow } from './sidebar-row';
import { SidebarUpdateCard } from './updates';
import type { SidebarProps } from './app-sidebar';

/**
 * One column, as Linear lays out its sidebar: search at the top, every section under its own
 * heading that folds shut, and the tools in a menu at the foot. Right-click works as in the
 * two-column one: pin, move, hide.
 */
export function SingleColumnSidebar({ user, onLayoutChange, prefs, onPrefsChange }: SidebarProps) {
  const { pathname } = useLocation();
  const { toggleSidebar } = useSidebar();
  useLoadNavCounts(user.id);
  const counts = useNavCounts();
  const currentTo = findNavItem(pathname)?.to;
  const nav = applyNavPrefs(sidebarSections(user), prefs, currentTo);
  const current = sectionFor(pathname, nav.sections);
  const { columnActions, sectionActions, pageActions } = useNavEditing({
    nav,
    prefs,
    onPrefsChange,
    current,
    currentTo,
  });

  const pageRow = (
    page: (typeof nav.pinned)[number],
    home: ShownSection | null,
    // A section of one page has no heading, so its menu is the section's.
    actions = pageActions(page, home)
  ) => (
    <SidebarMenuItem key={`${home ? home.title : 'pin'}-${page.to}`}>
      <NavLinkMenu to={page.to} actions={actions}>
        <SidebarRow
          icon={page.icon}
          label={page.title}
          wide
          active={page.to === currentTo}
          render={<Link to={page.to} />}
          trailing={
            <NavBadge to={page.to as NavCountPath} count={counts[page.to as NavCountPath]} wide />
          }
        />
      </NavLinkMenu>
    </SidebarMenuItem>
  );

  const labelClass =
    'text-sidebar-foreground/60 hover:text-sidebar-foreground focus-visible:ring-ring/50 text-ui group/label flex h-7 w-full items-center gap-1 rounded-md px-2.5 text-left font-medium outline-none focus-visible:ring-[3px]';

  return (
    <Sidebar collapsible="offcanvas" variant="inset">
      <SidebarHeader className="pb-1">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem className="flex items-center gap-1">
            <Link
              to="/"
              className="text-ui hover:bg-sidebar-accent flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1.5 font-semibold"
            >
              <Logo />
              <span className="truncate">Living Legacy</span>
            </Link>
            <button
              type="button"
              aria-label="Hide sidebar"
              onClick={toggleSidebar}
              className="text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent focus-visible:ring-ring/50 grid size-8 shrink-0 place-items-center rounded-md transition-colors outline-none focus-visible:ring-[3px]"
            >
              <PanelLeftIcon open aria-hidden className="size-4" />
            </button>
          </SidebarMenuItem>
          <CommandMenu user={user} />
        </SidebarMenu>
      </SidebarHeader>

      <ColumnMenu
        label="Use two columns"
        onToggle={() => onLayoutChange({ columns: 2 })}
        actions={columnActions}
      >
        <SidebarContent className="gap-0 px-2">
          {nav.pinned.length > 0 && (
            <SidebarGroup className="p-0 pb-2">
              <p className="text-sidebar-foreground/60 text-ui px-2.5 pb-0.5 font-medium">Pinned</p>
              <SidebarMenu className="gap-0.5">
                {nav.pinned.map((page) => pageRow(page, null))}
              </SidebarMenu>
            </SidebarGroup>
          )}

          {nav.sections.map((section) => {
            const single = section.pages.length === 1 ? section.pages[0]! : null;
            if (single) {
              // One page needs no heading above it. Pin stays; the rest of its menu moves or
              // hides the section, since the page cannot go anywhere else.
              const [pin] = pageActions(single, section);
              const actions: NavAction[] = [pin!, ...sectionActions(section)];
              return (
                <SidebarGroup key={section.title} className="p-0 pb-1">
                  <SidebarMenu className="gap-0.5">{pageRow(single, section, actions)}</SidebarMenu>
                </SidebarGroup>
              );
            }
            const open = !prefs.collapsed.includes(section.title);
            return (
              <SidebarGroup key={section.title} className="p-0 pb-1">
                <Collapsible
                  open={open}
                  onOpenChange={() => onPrefsChange((p) => toggleCollapsed(p, section.title))}
                >
                  <ActionMenu actions={sectionActions(section)}>
                    <CollapsibleTrigger className={labelClass}>
                      {section.title}
                      <ChevronDownIcon
                        aria-hidden
                        className={cn(
                          'size-3.5 opacity-0 transition-[opacity,rotate] duration-200 group-hover/label:opacity-100 group-focus-visible/label:opacity-100',
                          !open && '-rotate-90 opacity-100'
                        )}
                      />
                      {/* Folded shut, a dot says something inside needs a look. */}
                      {!open && sectionHasCount(section.pages, counts) && (
                        <span className="ml-auto">
                          <SectionDot />
                        </span>
                      )}
                    </CollapsibleTrigger>
                  </ActionMenu>
                  <CollapsibleContent className={COLLAPSIBLE_CONTENT}>
                    <SidebarMenu className="gap-0.5 pt-0.5">
                      {section.pages.map((page) => pageRow(page, section))}
                    </SidebarMenu>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarGroup>
            );
          })}
        </SidebarContent>
      </ColumnMenu>

      <SidebarFooter>
        <SidebarUpdateCard />
        <SidebarMenu>
          <HelpMenu />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
