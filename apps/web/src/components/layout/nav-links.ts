/**
 * Primary navigation, shared between the desktop NavigationMenu island, the
 * mobile Sheet island, and the static announcement bar link in Header.astro.
 */
export interface NavChild {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  /** Present when the item is a plain link rather than a dropdown. */
  href?: string;
  children?: NavChild[];
}

export const UPCOMING_LOCATIONS_HREF = '/locations/upcoming/';

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'About',
    children: [
      { label: 'About us', href: '/#about-section' },
      { label: 'In the media', href: '/about/in-the-media/' },
    ],
  },
  { label: 'How it works', href: '/#how-it-works-section' },
  {
    label: 'Locations',
    children: [
      // The trigger opens the menu rather than navigating, so the section
      // itself is the first entry.
      { label: 'All locations', href: '/#location-section' },
      { label: 'Victoria', href: 'https://morningtongreen.com.au' },
      { label: 'Perth', href: 'https://livinglegacywellingtondam.org.au' },
      { label: 'Upcoming location', href: UPCOMING_LOCATIONS_HREF },
    ],
  },
  { label: 'Contact', href: '/contact/' },
  { label: 'Blog', href: '/blog/' },
];
