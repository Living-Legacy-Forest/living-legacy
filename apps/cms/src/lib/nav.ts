import type { Permission } from '@llf/content';
import {
  ArrowRightLeft,
  CircleHelp,
  ExternalLink,
  FileText,
  ImageIcon,
  LayoutDashboard,
  MegaphoneIcon,
  type LucideIcon,
  Quote,
  Settings,
  UserCog,
  Users,
} from '@/components/icons';

export type NavItem = {
  title: string;
  icon?: LucideIcon;
  /** Set once the section exists. Items without one show as "Soon". */
  to?:
    | '/'
    | '/posts'
    | '/posts/new'
    | '/announcements'
    | '/faqs'
    | '/redirects'
    | '/settings'
    | '/team'
    | '/testimonials'
    | '/users';
  /** Shown when the person has any of these. */
  permission?: Permission | Permission[];
  items?: NavItem[];
};

export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    // No label: top-level items sit above the sections.
    label: '',
    items: [{ title: 'Dashboard', icon: LayoutDashboard, to: '/' }],
  },
  {
    label: 'Content',
    items: [
      {
        title: 'Posts',
        icon: FileText,
        items: [
          { title: 'All posts', to: '/posts' },
          { title: 'Add new', to: '/posts/new' },
          { title: 'Categories' },
          { title: 'Tags' },
        ],
      },
      { title: 'Media', icon: ImageIcon },
      { title: 'FAQs', icon: CircleHelp, to: '/faqs' },
      { title: 'Testimonials', icon: Quote, to: '/testimonials' },
      { title: 'Team', icon: Users, to: '/team' },
      { title: 'Announcements', icon: MegaphoneIcon, to: '/announcements' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { title: 'Redirects', icon: ArrowRightLeft, to: '/redirects', permission: 'redirects:write' },
      { title: 'Users', icon: UserCog, to: '/users', permission: 'users:manage' },
      {
        title: 'Settings',
        icon: Settings,
        to: '/settings',
        permission: ['settings:write', 'seo:write'],
      },
    ],
  },
];

export const footerLinks: { title: string; href: string; icon: LucideIcon }[] = [
  { title: 'View website', href: 'https://livinglegacyforest.com.au', icon: ExternalLink },
];

const allNavItems = navGroups.flatMap((g) => g.items.flatMap((i) => [i, ...(i.items ?? [])]));

/**
 * Nav item for the current path, used for the header breadcrumb. Falls back
 * to the closest parent, so /posts/abc shows "All posts".
 */
export function findNavItem(pathname: string): NavItem | undefined {
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
