import { useState } from 'react';
import { KeyboardIcon } from '@/components/icons';
import { SidebarMenuItem } from '@/components/ui/sidebar';
import { useThemeChoice } from '@/lib/use-theme-choice';
import { SidebarRow } from './sidebar-row';
import { ShortcutsDialog } from './shortcuts-dialog';
import { CurrentThemeIcon, useShowingTheme } from './theme-icon';

/** Keyboard shortcuts: a row in the rail that opens the list and the recorders. */
export function ShortcutsRow({ wide }: { wide: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SidebarMenuItem>
        <SidebarRow
          icon={KeyboardIcon}
          label="Keyboard shortcuts"
          wide={wide}
          onClick={() => setOpen(true)}
        />
      </SidebarMenuItem>
      <ShortcutsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * Flips between light and dark in one press. "Match my device" is still on the Profile page; a
 * person on it flips to the opposite of what their device shows now.
 */
export function ThemeRow({ wide }: { wide: boolean }) {
  const theme = useThemeChoice();
  const showing = useShowingTheme();
  const next = showing === 'dark' ? 'light' : 'dark';
  return (
    <SidebarMenuItem>
      <SidebarRow
        icon={CurrentThemeIcon}
        label={next === 'dark' ? 'Switch to dark' : 'Switch to light'}
        wide={wide}
        onClick={() => void theme.choose(next)}
      />
    </SidebarMenuItem>
  );
}
