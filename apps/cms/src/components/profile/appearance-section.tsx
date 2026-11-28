import { DEFAULT_ICON_STROKE } from '@ll/content';
import { useId, useState } from 'react';
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
import { DetentDial } from '@/components/ui/detent-dial';
import {
  type DisplayPrefs,
  type TextSize,
  TEXT_SIZES,
  applyDisplayPrefs,
  readDisplayPrefs,
} from '@/lib/display-prefs';
import { useSidebarLayout } from '@/components/shell/sidebar-layout';
import { ColourRows } from './colour-controls';
import { useAppearanceDraft } from '@/lib/use-appearance-draft';
import { useThemeChoice } from '@/lib/use-theme-choice';
import type { Theme } from '@/server/settings';

const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  small: 'Small',
  default: 'Default',
  large: 'Large',
};

const THEME_LABELS: Record<Theme, string> = {
  system: 'Match my device',
  light: 'Light',
  dark: 'Dark',
};

/**
 * A detent dial that changes the page as it turns and saves when let go, with its percentage
 * beside it and a Reset that goes back to following the default (`null`).
 */
function AppearanceDial({
  label,
  value,
  isDefault,
  onChange,
  onReset,
}: {
  label: string;
  value: number;
  isDefault: boolean;
  onChange: (value: number, commit: boolean) => void;
  onReset: () => void;
}) {
  const labelId = useId();
  return (
    <div className="flex items-center gap-3">
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
      <DetentDial
        aria-labelledby={labelId}
        aria-valuetext={`${value}%`}
        value={value}
        onChange={onChange}
      />
      <span id={labelId} className="sr-only">
        {label}
      </span>
    </div>
  );
}

/** A dropdown for one of this browser's display choices. */
function ChoiceSelect<T extends string>({
  id,
  items,
  value,
  onChange,
}: {
  id: string;
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <Select items={items} value={value} onValueChange={(next) => next && onChange(next as T)}>
      <SelectTrigger id={id} className="w-56">
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

  // Kept in this browser, in a cookie, so they apply at once and need no save.
  const [display, setDisplay] = useState<DisplayPrefs>(() => readDisplayPrefs());
  const changeDisplay = (patch: Partial<DisplayPrefs>) => {
    const next = { ...display, ...patch };
    setDisplay(next);
    applyDisplayPrefs(next);
  };
  const textSizeItems = TEXT_SIZES.map((size) => ({ value: size, label: TEXT_SIZE_LABELS[size] }));

  const items = [
    { value: 'site', label: `Site setting (${THEME_LABELS[siteTheme].toLowerCase()})` },
    ...(Object.keys(THEME_LABELS) as Theme[]).map((theme) => ({
      value: theme,
      label: THEME_LABELS[theme],
    })),
  ];

  return (
    <SettingsSection id="appearance" title="Appearance" description="Just for you.">
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
        info={
          <>
            <p>Two columns: sections down the left and their pages beside them.</p>
            <p>One column: every section under its own heading.</p>
            <p>Site setting follows what an admin chose. Kept in this browser.</p>
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
        info="Stronger text, hints and lines. A device set to more contrast starts it partway up."
      >
        <AppearanceDial
          label="Contrast"
          value={Math.round((draft.contrast ?? 0) * 100)}
          isDefault={draft.contrast === null}
          onChange={(next, commit) => change({ ...draft, contrast: next / 100 }, commit)}
          onReset={() => change({ ...draft, contrast: null }, true)}
        />
      </SettingsRow>

      <SettingsRow
        id="profile-icon-stroke"
        title="Icon stroke"
        suffix={
          <span aria-hidden className="text-muted-foreground flex items-center gap-2">
            <SearchIcon className="size-4" />
            <BellIcon className="size-4" />
            <ImageIcon className="size-4" />
            <UserIcon className="size-4" />
          </span>
        }
      >
        <AppearanceDial
          label="Icon stroke"
          value={Math.round((draft.iconStroke ?? DEFAULT_ICON_STROKE) * 100)}
          isDefault={draft.iconStroke === null}
          onChange={(next, commit) => change({ ...draft, iconStroke: next / 100 }, commit)}
          onReset={() => change({ ...draft, iconStroke: null }, true)}
        />
      </SettingsRow>
      <ColourRows />

      <SettingsRow id="profile-text-size" title="Text size" info="Kept in this browser.">
        <ChoiceSelect
          id="profile-text-size"
          items={textSizeItems}
          value={display.textSize}
          onChange={(textSize) => changeDisplay({ textSize })}
        />
      </SettingsRow>

      <SettingsRow id="profile-pointer-cursors" title="Cursor">
        <ChoiceSelect
          id="profile-pointer-cursors"
          items={[
            { value: 'arrow', label: 'Arrow' },
            { value: 'pointer', label: 'Pointing hand' },
          ]}
          value={display.pointerCursors ? 'pointer' : 'arrow'}
          onChange={(next) => changeDisplay({ pointerCursors: next === 'pointer' })}
        />
      </SettingsRow>

      <SettingsRow id="profile-underline-links" title="Links in text">
        <ChoiceSelect
          id="profile-underline-links"
          items={[
            { value: 'hover', label: 'When pointed at' },
            { value: 'always', label: 'Always' },
          ]}
          value={display.underlineLinks ? 'always' : 'hover'}
          onChange={(next) => changeDisplay({ underlineLinks: next === 'always' })}
        />
      </SettingsRow>

      <SettingsRow
        id="profile-reduce-motion"
        title="Motion"
        info="Reduced turns animations off, whatever your device is set to."
      >
        <ChoiceSelect
          id="profile-reduce-motion"
          items={[
            { value: 'full', label: 'Full' },
            { value: 'reduced', label: 'Reduced' },
          ]}
          value={display.reduceMotion ? 'reduced' : 'full'}
          onChange={(next) => changeDisplay({ reduceMotion: next === 'reduced' })}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
