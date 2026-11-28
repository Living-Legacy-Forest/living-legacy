import { type Access, type LegalSlug, type Permission, can, legalSlugs } from '@ll/content';
import type { LucideIcon } from '@/components/icons';
import {
  AdminIcon,
  ChartPieIcon,
  FileText,
  FingerprintIcon,
  GlobeIcon,
  IntegrationsIcon,
  KeyIcon,
  LinkIcon,
  MailIcon,
  PaletteIcon,
  Quote,
  SearchIcon,
  Settings,
  SparklesIcon,
  SystemIcon,
  UptimeIcon,
  UserCog,
  UserIcon,
} from '@/components/icons';

// Settings has a sidebar of its own, in place of the app's, as an account area does elsewhere.
// This is the one list of what is in it: its groups, who sees each page, and which addresses
// count as "in Settings" so the sidebar swaps over.

/** The pages of the site settings form, one address each: /settings/<id>. */
export const SETTINGS_SECTIONS = [
  { id: 'general', title: 'General', icon: GlobeIcon },
  { id: 'business', title: 'Contact & business', icon: MailIcon },
  { id: 'social', title: 'Social links', icon: LinkIcon },
  { id: 'search', title: 'Search & sharing', icon: SearchIcon },
  { id: 'content-targets', title: 'Content targets', icon: ChartPieIcon },
  { id: 'brand-language', title: 'Brand language', icon: Quote },
  { id: 'writing-assistant', title: 'Writing assistant', icon: SparklesIcon },
  { id: 'legal', title: 'Legal', icon: FileText },
  { id: 'cookies', title: 'Cookies & privacy', icon: AdminIcon },
  { id: 'sign-in', title: 'Sign-in & security', icon: KeyIcon },
  { id: 'appearance', title: 'Language & appearance', icon: Settings },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];

export const isSettingsSectionId = (value: string): value is SettingsSectionId =>
  SETTINGS_SECTIONS.some((s) => s.id === value);

/** What the site settings pages need: SEO people see three of them, the legal pages need more. */
const sectionPermission: Record<SettingsSectionId, Permission | Permission[]> = {
  general: 'settings:write',
  business: 'settings:write',
  social: 'settings:write',
  search: ['settings:write', 'seo:write'],
  'content-targets': ['settings:write', 'seo:write'],
  'brand-language': ['settings:write', 'seo:write'],
  'writing-assistant': 'settings:write',
  legal: 'content:write',
  cookies: 'settings:write',
  'sign-in': 'settings:write',
  appearance: 'settings:write',
};

export type SettingsNavChild = {
  title: string;
  to: string;
  permission?: Permission | Permission[];
};

export type SettingsNavItem = {
  title: string;
  icon: LucideIcon;
  to: string;
  permission?: Permission | Permission[];
  /** Pages listed under this one in the sidebar while it is open. */
  children?: SettingsNavChild[];
};

const legalTitles: Record<LegalSlug, string> = {
  privacy: 'Privacy policy',
  'terms-and-conditions': 'Terms and conditions',
};

/** The legal pages open straight into their editors; the sidebar lists them under Legal. */
const legalChildren: SettingsNavChild[] = legalSlugs.map((slug) => ({
  title: legalTitles[slug],
  to: `/legal/${slug}`,
}));

export type SettingsNavGroup = { label: string; items: SettingsNavItem[] };

export const settingsNav: SettingsNavGroup[] = [
  {
    label: 'Personal',
    items: [
      { title: 'Profile', icon: UserIcon, to: '/profile' },
      {
        title: 'Appearance',
        icon: PaletteIcon,
        to: '/profile/appearance',
        // One entry for both: your own look, and the site's defaults for admins.
        children: [
          { title: 'For you', to: '/profile/appearance' },
          { title: 'For everyone', to: '/settings/appearance', permission: 'settings:write' },
        ],
      },
      { title: 'Sign-in & devices', icon: FingerprintIcon, to: '/profile/security' },
    ],
  },
  {
    label: 'Website',
    items: SETTINGS_SECTIONS.filter((s) =>
      ['general', 'business', 'social', 'search'].includes(s.id)
    ).map((s) => ({
      title: s.title,
      icon: s.icon,
      to: `/settings/${s.id}`,
      permission: sectionPermission[s.id],
    })),
  },
  {
    label: 'Content',
    items: SETTINGS_SECTIONS.filter((s) =>
      ['content-targets', 'brand-language', 'writing-assistant', 'legal'].includes(s.id)
    ).map((s) => ({
      title: s.title,
      icon: s.icon,
      to: `/settings/${s.id}`,
      permission: sectionPermission[s.id],
      children: s.id === 'legal' ? legalChildren : undefined,
    })),
  },
  {
    label: 'Privacy and access',
    items: [
      ...SETTINGS_SECTIONS.filter((s) => ['cookies', 'sign-in'].includes(s.id)).map((s) => ({
        title: s.title,
        icon: s.icon,
        to: `/settings/${s.id}`,
        permission: sectionPermission[s.id],
      })),
      { title: 'Users', icon: UserCog, to: '/users', permission: 'users:manage' as const },
    ],
  },
  {
    label: 'Admin',
    items: [
      { title: 'API keys', icon: KeyIcon, to: '/integrations', permission: 'settings:write' },
      {
        title: 'Apps',
        icon: IntegrationsIcon,
        to: '/integrations/apps',
        permission: 'settings:write',
      },
      { title: 'System', icon: SystemIcon, to: '/system', permission: 'settings:write' },
      { title: 'Uptime', icon: UptimeIcon, to: '/uptime', permission: 'settings:write' },
    ],
  },
];

/** The groups this person can open, with empty ones left out. */
export function settingsNavFor(access: Access): SettingsNavGroup[] {
  return settingsNav
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => !item.permission || [item.permission].flat().some((p) => can(access, p)))
        .map((item) => {
          const children = item.children?.filter(
            (c) => !c.permission || [c.permission].flat().some((p) => can(access, p))
          );
          // One page left is no list, so the item stands on its own.
          return { ...item, children: children && children.length > 1 ? children : undefined };
        }),
    }))
    .filter((group) => group.items.length > 0);
}

/** Whether the person can open this site settings page. */
export function canOpenSection(access: Access, id: SettingsSectionId) {
  return [sectionPermission[id]].flat().some((p) => can(access, p));
}

const SETTINGS_PATHS = ['/profile', '/users', '/integrations', '/system', '/uptime', '/legal'];

/** Addresses that belong to Settings, where its sidebar takes the app sidebar's place. */
export function isSettingsPath(pathname: string) {
  return (
    pathname === '/settings' ||
    pathname.startsWith('/settings/') ||
    SETTINGS_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
}

/** Whether this item, or one of the pages listed under it, is the page open now. */
export function isSettingsNavItemActive(item: SettingsNavItem, pathname: string) {
  return isSettingsItemActive(item.to, pathname) || !!item.children?.some((c) => c.to === pathname);
}

/** The name of the settings page at this address, for the header's breadcrumb. */
export function settingsPageTitle(pathname: string) {
  return settingsNav
    .flatMap((group) => group.items)
    .find((item) => isSettingsNavItemActive(item, pathname))?.title;
}

/** Whether a settings sidebar item is the page open now. */
export function isSettingsItemActive(to: string, pathname: string) {
  if (to === '/settings/legal') return pathname === to || pathname.startsWith('/legal/');
  return pathname === to;
}
