import { SettingsRow, SettingsSection } from '@/components/settings/settings-section';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useThemeChoice } from '@/lib/use-theme-choice';
import type { Theme } from '@/server/settings';

const THEME_LABELS: Record<Theme, string> = {
  system: 'Match my device',
  light: 'Light',
  dark: 'Dark',
};

/**
 * This person's own light or dark choice. "Site setting" follows Settings,
 * Language & appearance. Saved as soon as it is picked.
 */
export function AppearanceSection() {
  const { value, siteTheme, choose } = useThemeChoice();

  const items = [
    { value: 'site', label: `Site setting (${THEME_LABELS[siteTheme].toLowerCase()})` },
    ...(Object.keys(THEME_LABELS) as Theme[]).map((theme) => ({
      value: theme,
      label: THEME_LABELS[theme],
    })),
  ];

  return (
    <SettingsSection
      id="appearance"
      title="Appearance"
      description="How the CMS looks for you. Others keep their own choice."
    >
      <SettingsRow id="profile-theme" title="Theme">
        <Select
          items={items}
          value={value}
          onValueChange={(next) => next && choose(next as Theme | 'site')}
        >
          <SelectTrigger id="profile-theme" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>
    </SettingsSection>
  );
}
