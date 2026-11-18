import { type Permission, type Role, can } from '@ll/content';
import {
  ActivityIcon,
  AdminIcon,
  ChartPieIcon,
  ContentIcon,
  FolderIcon,
  InfoIcon,
  TagIcon,
  AudienceIcon,
  BrowserIcon,
  ChartAreaIcon,
  InboxIcon,
  RouteIcon,
  ArrowRightLeft,
  CalendarClockIcon,
  IntegrationsIcon,
  CircleHelp,
  ExternalLink,
  FileText,
  GlobeIcon,
  MediaIcon,
  LayoutDashboard,
  ListTodo,
  MegaphoneIcon,
  MapPinIcon,
  NewspaperIcon,
  type LucideIcon,
  Quote,
  Settings,
  UserCog,
  UserIcon,
  Users,
  SearchReplaceIcon,
  SystemIcon,
  UptimeIcon,
} from '@/components/icons';

export type NavItem = {
  title: string;
  icon?: LucideIcon;
  /** Set once the section exists. Items without one show as "Soon". */
  to?:
    | '/'
    | '/posts'
    | '/posts/new'
    | '/posts/categories'
    | '/posts/tags'
    | '/profile'
    | '/whats-new'
    | '/activity'
    | '/analytics'
    | '/analytics/audience'
    | '/analytics/enquiries'
    | '/analytics/pages'
    | '/analytics/traffic'
    | '/analytics/visitors'
    | '/integrations'
    | '/checks'
    | '/announcements'
    | '/events'
    | '/events/overview'
    | '/faqs'
    | '/media'
    | '/locations'
    | '/media-coverage'
    | '/redirects'
    | '/search-replace'
    | '/settings'
    | '/system'
    | '/uptime'
    | '/team'
    | '/testimonials'
    | '/users';
  /** Shown when the person has any of these. */
  permission?: Permission | Permission[];
  items?: NavItem[];
};

export type NavGroup = {
  /** The heading in the phone's More list; empty for the items above the sections. */
  label: string;
  /** The section's name and icon in the sidebar's rail. */
  title: string;
  icon: LucideIcon;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    // No label: top-level items sit above the sections.
    label: '',
    title: 'Dashboard',
    icon: LayoutDashboard,
    items: [{ title: 'Dashboard', icon: LayoutDashboard, to: '/' }],
  },
  {
    label: 'Content',
    title: 'Content',
    icon: ContentIcon,
    items: [
      {
        title: 'Posts',
        icon: FileText,
        items: [
          { title: 'All posts', icon: FileText, to: '/posts' },
          { title: 'Categories', icon: FolderIcon, to: '/posts/categories' },
          { title: 'Tags', icon: TagIcon, to: '/posts/tags' },
        ],
      },
      { title: 'Media', icon: MediaIcon, to: '/media', permission: 'media:write' },
      { title: 'Announcements', icon: MegaphoneIcon, to: '/announcements' },
      { title: 'Media coverage', icon: NewspaperIcon, to: '/media-coverage' },
      {
        title: 'Content checks',
        icon: ListTodo,
        to: '/checks',
        permission: ['posts:publish', 'seo:write'],
      },
    ],
  },
  {
    label: 'Places',
    title: 'Places',
    icon: MapPinIcon,
    items: [
      { title: 'Locations', icon: MapPinIcon, to: '/locations' },
      {
        title: 'Events',
        icon: CalendarClockIcon,
        permission: 'events:manage',
        items: [
          {
            title: 'Overview',
            icon: ChartPieIcon,
            to: '/events/overview',
            permission: 'events:manage',
          },
          {
            title: 'All events',
            icon: CalendarClockIcon,
            to: '/events',
            permission: 'events:manage',
          },
        ],
      },
    ],
  },
  {
    label: 'About',
    title: 'About',
    icon: InfoIcon,
    items: [
      { title: 'Team', icon: Users, to: '/team' },
      { title: 'Testimonials', icon: Quote, to: '/testimonials' },
      { title: 'FAQs', icon: CircleHelp, to: '/faqs' },
    ],
  },
  {
    label: 'Analytics',
    title: 'Analytics',
    icon: ChartPieIcon,
    items: [
      { title: 'Overview', icon: ChartAreaIcon, to: '/analytics', permission: 'posts:publish' },
      { title: 'Pages', icon: BrowserIcon, to: '/analytics/pages', permission: 'posts:publish' },
      { title: 'Traffic', icon: RouteIcon, to: '/analytics/traffic', permission: 'posts:publish' },
      {
        title: 'Audience',
        icon: AudienceIcon,
        to: '/analytics/audience',
        permission: 'posts:publish',
      },
      {
        title: 'Visitors',
        icon: GlobeIcon,
        to: '/analytics/visitors',
        permission: 'posts:publish',
      },
      {
        title: 'Enquiries',
        icon: InboxIcon,
        to: '/analytics/enquiries',
        permission: 'posts:publish',
      },
    ],
  },
  {
    label: 'Admin',
    title: 'Admin',
    icon: AdminIcon,
    items: [
      { title: 'Activity', icon: ActivityIcon, to: '/activity', permission: 'posts:publish' },
      { title: 'Redirects', icon: ArrowRightLeft, to: '/redirects', permission: 'redirects:write' },
      {
        title: 'Search & replace',
        icon: SearchReplaceIcon,
        to: '/search-replace',
        permission: 'content:replace',
      },
      { title: 'Users', icon: UserCog, to: '/users', permission: 'users:manage' },
      {
        title: 'Integrations',
        icon: IntegrationsIcon,
        to: '/integrations',
        permission: 'settings:write',
      },
      { title: 'System', icon: SystemIcon, to: '/system', permission: 'settings:write' },
      { title: 'Uptime', icon: UptimeIcon, to: '/uptime', permission: 'settings:write' },
      {
        title: 'Settings',
        icon: Settings,
        to: '/settings',
        permission: ['settings:write', 'seo:write'],
      },
    ],
  },
];

/** Whether someone with `role` sees this item. */
export function isNavItemAllowed(item: NavItem, role: Role) {
  return !item.permission || [item.permission].flat().some((p) => can(role, p));
}

/** The phone tab bar, in place of the sidebar. Every other page is under More. */
export const phoneTabs: (NavItem & { to: NonNullable<NavItem['to']>; icon: LucideIcon })[] = [
  { title: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { title: 'Posts', icon: FileText, to: '/posts' },
  // Analytics has the place Media had; Media is one tap away under More.
  { title: 'Analytics', icon: ChartPieIcon, to: '/analytics', permission: 'posts:publish' },
  // Events over Locations: guest check-in on open days is what a phone is used for.
  { title: 'Events', icon: CalendarClockIcon, to: '/events', permission: 'events:manage' },
];

/** The post, event, location and media file pages, which have the whole screen on phones (no tab bar). */
export const isEditorPath = (pathname: string) =>
  /^\/(posts|events|locations|media)\/(?!categories$|tags$|overview$)[^/]+$/.test(pathname);

/** Where an editor's back button goes: the list it was opened from. */
export function editorBack(pathname: string) {
  if (!isEditorPath(pathname)) return null;
  if (pathname.startsWith('/events/')) return { to: '/events', label: 'Events' } as const;
  if (pathname.startsWith('/locations/')) return { to: '/locations', label: 'Locations' } as const;
  if (pathname.startsWith('/media/')) return { to: '/media', label: 'Media' } as const;
  return { to: '/posts', label: 'Posts' } as const;
}

/** Whether a tab is the current section: its page or anything under it. */
export function isTabActive(to: string, pathname: string) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
}

export const footerLinks: { title: string; href: string; icon: LucideIcon }[] = [
  { title: 'View website', href: 'https://livinglegacy.com.au', icon: ExternalLink },
];

/** Pages reached from elsewhere (the account menu), with a breadcrumb but no sidebar entry. */
const pageOnlyItems: NavItem[] = [
  { title: 'Profile', icon: UserIcon, to: '/profile' },
  { title: "What's new", icon: MegaphoneIcon, to: '/whats-new' },
];

const allNavItems = [
  ...navGroups.flatMap((g) => g.items.flatMap((i) => [i, ...(i.items ?? [])])),
  ...pageOnlyItems,
];

/** An item's icon, or for a child such as Categories, its parent's (Posts). */
export function navItemIcon(item: NavItem): LucideIcon | undefined {
  if (item.icon) return item.icon;
  return navGroups.flatMap((g) => g.items).find((parent) => parent.items?.includes(item))?.icon;
}

/**
 * Nav item for the current path, used for the header breadcrumb. Falls back
 * to the closest parent, so /posts/abc shows "All posts".
 */
export function findNavItem(pathname: string): NavItem | undefined {
  // The legal page editors are opened from Settings, so they sit under it.
  if (pathname.startsWith('/legal/')) return allNavItems.find((item) => item.to === '/settings');
  const exact = allNavItems.find((item) => item.to === pathname);
  if (exact) return exact;
  return allNavItems
    .filter((item) => item.to && item.to !== '/' && pathname.startsWith(`${item.to}/`))
    .sort((a, b) => (b.to?.length ?? 0) - (a.to?.length ?? 0))[0];
}

/** Whether a nav item should show as active for the current path. */
export function isNavItemActive(item: NavItem, pathname: string) {
  return findNavItem(pathname) === item;
}

/** A page in the sidebar's second column: a nav item with a page to open and an icon. */
export type SidebarPage = NavItem & { to: NonNullable<NavItem['to']>; icon: LucideIcon };
export type SidebarSection = { title: string; icon: LucideIcon; pages: SidebarPage[] };

/**
 * The sidebar's sections, as `role` sees them: each group, with its pages in one flat list (a
 * page with sub-pages, such as Posts, gives way to them, named so they read on their own).
 * Sections with nothing to open are left out.
 */
export function sidebarSections(role: Role): SidebarSection[] {
  const allowed = (item: NavItem) => isNavItemAllowed(item, role);
  return navGroups
    .map((group) => ({
      title: group.title,
      icon: group.icon,
      pages: group.items.filter(allowed).flatMap((item): SidebarPage[] => {
        const subs = item.items?.filter(allowed) ?? [];
        const list = subs.length
          ? subs.map((sub) => ({
              ...sub,
              // "Overview" alone could be any section's; "Events overview" says whose.
              title: sub.title === 'Overview' ? `${item.title} overview` : sub.title,
              icon: sub.icon ?? item.icon!,
            }))
          : [{ ...item, icon: item.icon! }];
        return list.filter((page): page is SidebarPage => !!page.to && !!page.icon);
      }),
    }))
    .filter((section) => section.pages.length > 0);
}

/** The section the page at `pathname` belongs to; the first section for pages outside them. */
export function sectionFor(pathname: string, sections: SidebarSection[]) {
  const item = findNavItem(pathname);
  return sections.find((s) => s.pages.some((p) => item && p.to === item.to)) ?? sections[0] ?? null;
}
