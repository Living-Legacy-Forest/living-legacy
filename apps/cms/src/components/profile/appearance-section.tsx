import { getRouteApi, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { SettingsRow, SettingsSection } from '@/components/settings/settings-section';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { authClient } from '@/lib/auth-client';
import { forgetCachedUser } from '@/lib/session';
import { notify } from '@/lib/notify';
import { setTheme } from '@/lib/use-theme-sync';
import type { Theme } from '@/server/settings';

const rootRoute = getRouteApi('__root__');

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
  const router = useRouter();
  const { siteTheme, personalTheme } = rootRoute.useLoaderData();
  const [value, setValue] = useState<Theme | 'site'>(personalTheme ?? 'site');

  const items = [
    { value: 'site', label: `Site setting (${THEME_LABELS[siteTheme].toLowerCase()})` },
    ...(Object.keys(THEME_LABELS) as Theme[]).map((theme) => ({
      value: theme,
      label: THEME_LABELS[theme],
    })),
  ];

  async function choose(next: Theme | 'site') {
    const previous = value;
    setValue(next);
    setTheme(next === 'site' ? siteTheme : next);
    const { error } = await authClient.updateUser({ theme: next === 'site' ? null : next });
    if (error) {
      setValue(previous);
      setTheme(previous === 'site' ? siteTheme : previous);
      notify.error('Could not change the theme', error.message ?? 'Please try again.');
      return;
    }
    forgetCachedUser();
    await router.invalidate();
  }

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
