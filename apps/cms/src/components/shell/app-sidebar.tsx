import { Link, useLocation } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ExternalLink, GiftIcon, PanelLeftIcon } from '@/components/icons';
import { Sidebar, SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { findNavItem, footerLinks, sectionFor, sidebarSections } from '@/lib/nav';
import { rememberAppPath } from '@/lib/last-app-path';
import { type NavPrefs, applyNavPrefs } from '@/lib/nav-prefs';
import { isSettingsPath } from '@/lib/settings-nav';
import { type NavCountPath, sectionHasCount } from '@/lib/nav-counts';
import type { SessionUser } from '@/lib/session';
import type { ShownSidebarState, SidebarState } from '@/lib/sidebar-state';
import { SECTION_MOTION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { AppearanceRow } from './appearance-row';
import { CommandMenu } from './command-menu';
import { Logo } from './logo';
import { NavBadge, SectionDot } from './nav-badge';
import { useNavEditing } from './nav-editing';
import { ShortcutsRow, ThemeRow } from './rail-tools';
import { ColumnMenu, type NavAction, NavLinkMenu } from './sidebar-menus';
import { SettingsSidebar } from './settings-sidebar';
import { SingleColumnSidebar } from './single-sidebar';
import { SidebarRow } from './sidebar-row';
import { useNavCounts } from '@/lib/nav-counts-store';
import { useLoadNavCounts } from './load-nav-counts';
import { SidebarUpdateCard, useUpdates } from './updates';

// Two columns, as Better Stack lays out its sidebar: a rail of sections, and the pages of the
// section you are in. Either shows names or only icons; the widths come from the shell, which
// sizes the whole sidebar from them.

/** Columns open and close on the same curve the sidebar's sections used to. */
const column = `flex min-h-0 shrink-0 flex-col overflow-hidden transition-[width] ${SECTION_MOTION}`;

/** The small square button that widens or narrows a column, named by what it will do. */
function ColumnToggle({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={500}
        render={
          <button
            type="button"
            aria-label={label}
            onClick={onClick}
            className={cn(
              'text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent focus-visible:ring-ring/50 group/toggle relative grid size-8 shrink-0 place-items-center rounded-md transition-colors outline-none focus-visible:ring-[3px]',
              className
            )}
          />
        }
      >
        {children ?? <PanelLeftIcon aria-hidden className="size-4" />}
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function AppSidebar(props: SidebarProps) {
  const { pathname, searchStr, hash } = useLocation();
  const inSettings = isSettingsPath(pathname);
  // Back to app returns to the last page that was not in Settings.
  useEffect(() => {
    if (!inSettings) rememberAppPath(`${pathname}${searchStr}${hash ? `#${hash}` : ''}`);
  }, [inSettings, pathname, searchStr, hash]);
  if (inSettings) return <SettingsSidebar user={props.user} />;
  return props.layout.columns === 1 ? (
    <SingleColumnSidebar {...props} />
  ) : (
    <TwoColumnSidebar {...props} />
  );
}

export type SidebarProps = {
  user: SessionUser;
  layout: ShownSidebarState;
  /** Changes only what is given. */
  onLayoutChange: (patch: Partial<SidebarState>) => void;
  /** This person's pins, hidden items and order. */
  prefs: NavPrefs;
  onPrefsChange: (update: (prefs: NavPrefs) => NavPrefs) => void;
};

function TwoColumnSidebar({ user, layout, onLayoutChange, prefs, onPrefsChange }: SidebarProps) {
  const { pathname } = useLocation();
  const { unseen } = useUpdates();
  useLoadNavCounts(user.id);
  const counts = useNavCounts();
  // The pages are flattened copies, so the current one is matched by its address.
  const currentTo = findNavItem(pathname)?.to;
  const nav = applyNavPrefs(sidebarSections(user), prefs, currentTo);
  const sections = nav.sections;
  const current = sectionFor(pathname, sections);
  const { railWide, pagesWide } = layout;
  const site = footerLinks[0];

  const { columnActions, sectionActions, pageActions } = useNavEditing({
    nav,
    prefs,
    onPrefsChange,
    current,
    currentTo,
  });
  // Either column's empty space also switches to the one-column sidebar.
  const menuActions: NavAction[] = [
    ...columnActions,
    {
      label: 'Use one column',
      icon: <PanelLeftIcon aria-hidden />,
      onSelect: () => onLayoutChange({ columns: 1 }),
    },
  ];

  const pageRow = (page: (typeof nav.pinned)[number], inPinned: boolean) => (
    <SidebarMenuItem key={`${inPinned ? 'pin' : 'page'}-${page.to}`}>
      <NavLinkMenu to={page.to} actions={pageActions(page, inPinned ? null : current)}>
        <SidebarRow
          icon={page.icon}
          label={page.title}
          wide={pagesWide}
          active={page.to === currentTo}
          render={<Link to={page.to} />}
          trailing={
            <NavBadge
              to={page.to as NavCountPath}
              count={counts[page.to as NavCountPath]}
              wide={pagesWide}
            />
          }
        />
      </NavLinkMenu>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" variant="inset">
      <div className="flex min-h-0 flex-1">
        {/* The rail: every section, then search, What's new and the website. */}
        <ColumnMenu
          label={railWide ? 'Hide section names' : 'Show section names'}
          onToggle={() => onLayoutChange({ railWide: !railWide })}
          actions={menuActions}
        >
          <nav
            aria-label="Sections"
            className={cn(
              column,
              'border-sidebar-border border-r',
              railWide ? 'w-(--rail-wide)' : 'w-(--rail-narrow)'
            )}
          >
            <div className="flex h-12 shrink-0 items-center gap-1 px-2">
              {railWide ? (
                <>
                  <Link
                    to="/"
                    className="text-ui flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1.5 font-semibold"
                  >
                    <Logo />
                    <span className="truncate">Living Legacy</span>
                  </Link>
                  <ColumnToggle
                    label="Hide section names"
                    onClick={() => onLayoutChange({ railWide: false })}
                  />
                </>
              ) : (
                // Narrow, the logo is the way to widen the rail: it turns into the toggle on hover.
                <ColumnToggle
                  label="Show section names"
                  onClick={() => onLayoutChange({ railWide: true })}
                >
                  <span className="transition-opacity group-hover/toggle:opacity-0 group-focus-visible/toggle:opacity-0">
                    <Logo />
                  </span>
                  <PanelLeftIcon
                    open
                    aria-hidden
                    className="absolute size-4 opacity-0 transition-opacity group-hover/toggle:opacity-100 group-focus-visible/toggle:opacity-100"
                  />
                </ColumnToggle>
              )}
            </div>

            <SidebarMenu className="gap-0.5 px-2">
              {sections.map((section) => (
                <SidebarMenuItem key={section.title}>
                  <NavLinkMenu to={section.pages[0]!.to} actions={sectionActions(section)}>
                    <SidebarRow
                      icon={section.icon}
                      label={section.title}
                      wide={railWide}
                      active={section === current}
                      render={<Link to={section.pages[0]!.to} />}
                      // Its pages are out of sight unless it is the open section.
                      trailing={
                        section !== current &&
                        sectionHasCount(section.pages, counts) && <SectionDot />
                      }
                    />
                  </NavLinkMenu>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>

            <SidebarMenu className="mt-auto gap-0.5 px-2 pt-4 pb-2">
              <CommandMenu user={user} wide={railWide} />
              <SidebarMenuItem>
                <SidebarRow
                  icon={GiftIcon}
                  label="What's new"
                  wide={railWide}
                  active={pathname === '/whats-new'}
                  render={<Link to="/whats-new" />}
                  trailing={
                    unseen.length > 0 && (
                      <span aria-label="New" className="bg-brand size-1.5 shrink-0 rounded-full" />
                    )
                  }
                />
              </SidebarMenuItem>
              <ShortcutsRow wide={railWide} />
              <ThemeRow wide={railWide} />
              <AppearanceRow wide={railWide} />
              {site && (
                <SidebarMenuItem>
                  <SidebarRow
                    icon={ExternalLink}
                    label={site.title}
                    wide={railWide}
                    render={<a href={site.href} target="_blank" rel="noreferrer" />}
                  />
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </nav>
        </ColumnMenu>

        {/* The pages of the section you are in. */}
        {current && (
          <ColumnMenu
            label={pagesWide ? 'Hide page names' : 'Show page names'}
            onToggle={() => onLayoutChange({ pagesWide: !pagesWide })}
            actions={menuActions}
          >
            <nav
              aria-label={current.title}
              className={cn(column, pagesWide ? 'w-(--pages-wide)' : 'w-(--pages-narrow)')}
            >
              <div className="flex h-12 shrink-0 items-center gap-1 px-2">
                {pagesWide ? (
                  <>
                    <span className="text-ui min-w-0 flex-1 truncate px-1.5 font-semibold">
                      {current.title}
                    </span>
                    <ColumnToggle
                      label="Hide page names"
                      onClick={() => onLayoutChange({ pagesWide: false })}
                    />
                  </>
                ) : (
                  <ColumnToggle
                    label="Show page names"
                    onClick={() => onLayoutChange({ pagesWide: true })}
                  />
                )}
              </div>

              {/* Pinned pages stay in view whichever section you are in. */}
              {nav.pinned.length > 0 && (
                <SidebarMenu className="gap-0.5 px-2 pb-2">
                  {pagesWide ? (
                    <span className="text-sidebar-foreground/55 text-ui px-2.5 pb-0.5">Pinned</span>
                  ) : null}
                  {nav.pinned.map((page) => pageRow(page, true))}
                  <div aria-hidden className="bg-sidebar-border mx-1 mt-1 h-px" />
                </SidebarMenu>
              )}

              {/* Keyed by section, so a new section's pages slide in (styles.css, shell). */}
              <SidebarMenu key={current.title} className="gap-0.5 px-2">
                {current.pages.map((page) => pageRow(page, false))}
              </SidebarMenu>

              {/* The What's new card needs the room; narrow, the rail's What's new has a dot. */}
              {pagesWide && (
                <div className="mt-auto px-2 pb-2">
                  <SidebarUpdateCard />
                </div>
              )}
            </nav>
          </ColumnMenu>
        )}
      </div>
    </Sidebar>
  );
}
