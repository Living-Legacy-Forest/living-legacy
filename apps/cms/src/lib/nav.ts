import type { Permission } from '@llf/content';
import {
  ArrowRightLeft,
  CircleHelp,
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
  icon: LucideIcon;
  /** Set once the section exists. Items without one show as "Soon". */
  to?: '/';
  permission?: Permission;
};

export const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Content',
    items: [
      { title: 'Dashboard', icon: LayoutDashboard, to: '/' },
      { title: 'Posts', icon: FileText },
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
