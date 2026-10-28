import type { Permission } from '@llf/content';
import {
  ArrowRightLeft,
  CircleHelp,
  ExternalLink,
  FileText,
  ImageIcon,
  LayoutDashboard,
  type LucideIcon,
  Quote,
  Settings,
  UserCog,
  Users,
} from 'lucide-react';

export type NavItem = {
  title: string;
  icon?: LucideIcon;
  /** Set once the section exists. Items without one show as "Soon". */
  to?: '/';
  permission?: Permission;
  items?: NavItem[];
};

export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ title: 'Dashboard', icon: LayoutDashboard, to: '/' }],
  },
  {
    label: 'Content',
    items: [
      {
        title: 'Posts',
        icon: FileText,
        items: [
          { title: 'All posts' },
          { title: 'Add new' },
          { title: 'Categories' },
          { title: 'Tags' },
        ],
      },
      { title: 'Media', icon: ImageIcon },
      { title: 'FAQs', icon: CircleHelp },
      { title: 'Testimonials', icon: Quote },
      { title: 'Team', icon: Users },
    ],
  },
  {
    label: 'Admin',
    items: [
      { title: 'Redirects', icon: ArrowRightLeft, permission: 'redirects:write' },
      { title: 'Users', icon: UserCog, permission: 'users:manage' },
      { title: 'Settings', icon: Settings, permission: 'settings:write' },
    ],
  },
];

export const footerLinks: { title: string; href: string; icon: LucideIcon }[] = [
  { title: 'View website', href: 'https://livinglegacyforest.com.au', icon: ExternalLink },
];

/** Nav item for the current path, used for the header breadcrumb. */
export function findNavItem(pathname: string): NavItem | undefined {
  const all = navGroups.flatMap((g) => g.items.flatMap((i) => [i, ...(i.items ?? [])]));
  return all.find((item) => item.to === pathname);
}
