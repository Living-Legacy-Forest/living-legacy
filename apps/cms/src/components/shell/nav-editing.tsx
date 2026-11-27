import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  EyeOffIcon,
  PinIcon,
  PinOffIcon,
  RotateCcwIcon,
} from '@/components/icons';
import type { SidebarPage } from '@/lib/nav';
import {
  type NavPrefs,
  SECTIONS_SCOPE,
  type ShownNav,
  type ShownSection,
  hideKey,
  moveKey,
  movePinned,
  pagesScope,
  resetNavOrder,
  sectionKey,
  showAllHidden,
  showKey,
  togglePin,
} from '@/lib/nav-prefs';
import { notify } from '@/lib/notify';
import type { NavAction } from './sidebar-menus';

/**
 * What a person can do to their sidebar from a right-click, shared by both layouts: pin, move,
 * hide, bring back. `current` is the section they are in, which stays put.
 */
export function useNavEditing({
  nav,
  prefs,
  onPrefsChange,
  current,
  currentTo,
}: {
  nav: ShownNav;
  prefs: NavPrefs;
  onPrefsChange: (update: (prefs: NavPrefs) => NavPrefs) => void;
  current: ShownSection | null;
  currentTo: string | undefined;
}) {
  const sections = nav.sections;

  /** Hiding is easy to do by accident, so the message that follows has Undo. */
  const hide = (key: string, name: string) => {
    onPrefsChange((p) => hideKey(p, key));
    notify.info({
      title: `${name} hidden`,
      description: 'Right-click the sidebar to bring hidden items back.',
      action: { label: 'Undo', onClick: () => onPrefsChange((p) => showKey(p, key)) },
    });
  };

  // Offered from the empty space, and only when there is something to undo.
  const columnActions: NavAction[] = [
    ...(nav.hiddenCount > 0
      ? [
          {
            label: `Show hidden (${nav.hiddenCount})`,
            icon: <EyeIcon aria-hidden />,
            onSelect: () => onPrefsChange(showAllHidden),
          },
        ]
      : []),
    ...(prefs.pinned.length > 0 || Object.keys(prefs.order).length > 0
      ? [
          {
            label: 'Reset order and pins',
            icon: <RotateCcwIcon aria-hidden />,
            onSelect: () => onPrefsChange(resetNavOrder),
          },
        ]
      : []),
  ];

  const sectionActions = (section: ShownSection): NavAction[] => {
    const titles = sections.map((s) => s.title);
    const at = titles.indexOf(section.title);
    const move = (step: -1 | 1) =>
      onPrefsChange((p) =>
        moveKey(p, SECTIONS_SCOPE, nav.sectionKeys, titles, section.title, step)
      );
    return [
      {
        label: 'Move up',
        icon: <ArrowUpIcon aria-hidden />,
        onSelect: () => move(-1),
        disabled: at <= 0,
      },
      {
        label: 'Move down',
        icon: <ArrowDownIcon aria-hidden />,
        onSelect: () => move(1),
        disabled: at === titles.length - 1,
      },
      {
        label: 'Hide section',
        icon: <EyeOffIcon aria-hidden />,
        onSelect: () => hide(sectionKey(section.title), section.title),
        // The one you are in stays, and so does the last one.
        disabled: section === current || sections.length === 1,
      },
    ];
  };

  /** `home` is the section the page is listed under; null for a row in the Pinned group. */
  const pageActions = (page: SidebarPage, home: ShownSection | null): NavAction[] => {
    const pinnedAt = prefs.pinned.indexOf(page.to);
    const shown = home?.pages.map((p) => p.to) ?? [];
    const at = shown.indexOf(page.to);
    const move = (step: -1 | 1) =>
      onPrefsChange((p) =>
        home
          ? moveKey(p, pagesScope(home.title), home.orderedKeys, shown, page.to, step)
          : movePinned(p, page.to, step)
      );
    const isPinned = pinnedAt >= 0;
    return [
      {
        label: isPinned ? 'Unpin' : 'Pin to top',
        icon: isPinned ? <PinOffIcon aria-hidden /> : <PinIcon aria-hidden />,
        onSelect: () => onPrefsChange((p) => togglePin(p, page.to)),
      },
      {
        label: 'Move up',
        icon: <ArrowUpIcon aria-hidden />,
        onSelect: () => move(-1),
        disabled: home ? at <= 0 : pinnedAt <= 0,
      },
      {
        label: 'Move down',
        icon: <ArrowDownIcon aria-hidden />,
        onSelect: () => move(1),
        disabled: home ? at === shown.length - 1 : pinnedAt === prefs.pinned.length - 1,
      },
      // A pinned row is taken off by unpinning; hiding is for the page's own place.
      ...(home
        ? [
            {
              label: 'Hide from sidebar',
              icon: <EyeOffIcon aria-hidden />,
              onSelect: () => hide(page.to, page.title),
              disabled: page.to === currentTo,
            },
          ]
        : []),
    ];
  };

  return { columnActions, sectionActions, pageActions };
}
