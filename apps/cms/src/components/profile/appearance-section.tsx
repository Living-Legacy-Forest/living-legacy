import { DEFAULT_ICON_STROKE } from '@ll/content';
import { BellIcon, ImageIcon, SearchIcon, UserIcon } from '@/components/icons';
import { SettingsRow, SettingsSection } from '@/components/settings/settings-section';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useSidebarLayout } from '@/components/shell/sidebar-layout';
import { useAppearanceDraft } from '@/lib/use-appearance-draft';
import { useThemeChoice } from '@/lib/use-theme-choice';
import type { Theme } from '@/server/settings';

const THEME_LABELS: Record<Theme, string> = {
  system: 'Match my device',
  light: 'Light',
  dark: 'Dark',
};

const first = (value: number | readonly number[]) => (Array.isArray(value) ? value[0] : value);

/**
 * A slider that changes the page as it moves and saves when let go, with its percentage beside
 * it and a Reset that goes back to following the default (`null`).
 */
function AppearanceSlider({
  id,
  value,
  isDefault,
  onChange,
  onReset,
}: {
  id: string;
  value: number;
  isDefault: boolean;
  onChange: (value: number, commit: boolean) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Slider
        id={id}
        className="w-40"
        min={0}
        max={100}
        step={5}
        value={value}
        onValueChange={(next) => onChange(first(next), false)}
        onValueCommitted={(next) => onChange(first(next), true)}
      />
      <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">{value}%</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={isDefault ? 'invisible' : undefined}
        tabIndex={isDefault ? -1 : undefined}
        onClick={onReset}
      >
        Reset
      </Button>
    </div>
  );
}

/**
 * This person's own light or dark choice, text contrast and icon stroke. "Site setting" follows Settings,
 * Language & appearance. Saved as soon as it is picked.
 */
export function AppearanceSection() {
  const { value, siteTheme, choose } = useThemeChoice();
  const { draft, change } = useAppearanceDraft();
  const { layout, siteColumns, setLayout } = useSidebarLayout();
  const columnLabels = { 1: 'One column', 2: 'Two columns' } as const;
  const layoutItems = [
    { value: 'site', label: `Site setting (${columnLabels[siteColumns].toLowerCase()})` },
    { value: '2', label: columnLabels[2] },
    { value: '1', label: columnLabels[1] },
  ];

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

      <SettingsRow
        id="profile-sidebar"
        title="Sidebar"
        description="Kept in this browser."
        info={
          <>
            <p>Two columns: sections down the left and their pages beside them.</p>
            <p>
              One column: every section under its own heading, with the tools in a menu at the
              bottom.
            </p>
            <p>Site setting follows what an admin chose in Settings, Language & appearance.</p>
          </>
        }
      >
        <Select
          items={layoutItems}
          value={layout.columns ? String(layout.columns) : 'site'}
          onValueChange={(next) =>
            next && setLayout({ columns: next === '1' ? 1 : next === '2' ? 2 : null })
          }
        >
          <SelectTrigger id="profile-sidebar" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {layoutItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>

      <SettingsRow
        id="profile-contrast"
        title="Contrast"
        description="Stronger text, hints and lines. A device set to more contrast starts it partway up."
        below
      >
        <AppearanceSlider
          id="profile-contrast"
          value={Math.round((draft.contrast ?? 0) * 100)}
          isDefault={draft.contrast === null}
          onChange={(next, commit) => change({ ...draft, contrast: next / 100 }, commit)}
          onReset={() => change({ ...draft, contrast: null }, true)}
        />
      </SettingsRow>

      <SettingsRow
        id="profile-icon-stroke"
        title="Icon stroke"
        description="How thin or bold icons are drawn."
        suffix={
          <span aria-hidden className="text-muted-foreground flex items-center gap-2">
            <SearchIcon className="size-4" />
            <BellIcon className="size-4" />
            <ImageIcon className="size-4" />
            <UserIcon className="size-4" />
          </span>
        }
        below
      >
        <AppearanceSlider
          id="profile-icon-stroke"
          value={Math.round((draft.iconStroke ?? DEFAULT_ICON_STROKE) * 100)}
          isDefault={draft.iconStroke === null}
          onChange={(next, commit) => change({ ...draft, iconStroke: next / 100 }, commit)}
          onReset={() => change({ ...draft, iconStroke: null }, true)}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
