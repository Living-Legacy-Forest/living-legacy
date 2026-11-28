import { Link } from '@tanstack/react-router';
import { PaletteIcon } from '@/components/icons';
import { SidebarMenuItem } from '@/components/ui/sidebar';
import { SidebarRow } from './sidebar-row';

/** A row in the rail that opens Settings, Appearance: this person's colour, grain, theme and sidebar. */
export function AppearanceRow({ wide }: { wide: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarRow
        icon={PaletteIcon}
        label="Appearance"
        wide={wide}
        render={<Link to="/profile/appearance" />}
      />
    </SidebarMenuItem>
  );
}
