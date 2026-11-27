import { createContext, useContext } from 'react';
import type { SidebarState } from '@/lib/sidebar-state';

/** The sidebar's layout and how to change it, for the Profile page's choice and the menus. */
export type SidebarLayoutValue = {
  /** This person's own choices; `columns` is null while they follow the site. */
  layout: SidebarState;
  /** What the site sets, for those who have not chosen. */
  siteColumns: 1 | 2;
  /** Changes only what is given, so a width change never turns "follow the site" into a choice. */
  setLayout: (patch: Partial<SidebarState>) => void;
};

export const SidebarLayoutContext = createContext<SidebarLayoutValue | null>(null);

export function useSidebarLayout(): SidebarLayoutValue {
  const value = useContext(SidebarLayoutContext);
  if (!value) throw new Error('useSidebarLayout needs the app shell');
  return value;
}
