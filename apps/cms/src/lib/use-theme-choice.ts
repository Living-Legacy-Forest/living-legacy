import { getRouteApi, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { notify } from '@/lib/notify';
import { forgetCachedUser } from '@/lib/session';
import { setTheme } from '@/lib/use-theme-sync';
import type { Theme } from '@/server/settings';

const rootRoute = getRouteApi('__root__');

/**
 * This person's own light or dark choice, or "site" to follow Settings. The page changes as soon
 * as it is picked and goes back if saving fails. Shared by Profile, Appearance and the account menu.
 */
export function useThemeChoice() {
  const router = useRouter();
  const { siteTheme, personalTheme } = rootRoute.useLoaderData();
  // Holds a choice only while it saves; after that the loader has it, so every place that shows
  // the theme (Profile and the account menu) agrees.
  const [saving, setSaving] = useState<Theme | 'site' | null>(null);
  const value = saving ?? personalTheme ?? 'site';

  async function choose(next: Theme | 'site') {
    const previous = value;
    setSaving(next);
    setTheme(next === 'site' ? siteTheme : next);
    const { error } = await authClient.updateUser({ theme: next === 'site' ? null : next });
    if (error) {
      setSaving(null);
      setTheme(previous === 'site' ? siteTheme : previous);
      notify.error('Could not change the theme', error.message ?? 'Please try again.');
      return;
    }
    forgetCachedUser();
    await router.invalidate();
    setSaving(null);
  }

  /** The theme in effect, with "site" resolved to the site's own setting. */
  const effective: Theme = value === 'site' ? siteTheme : value;
  return { value, effective, siteTheme, choose };
}
