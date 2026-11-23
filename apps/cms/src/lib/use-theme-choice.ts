import { getRouteApi, useRouter } from '@tanstack/react-router';
import { useEffect, useSyncExternalStore } from 'react';
import { authClient } from '@/lib/auth-client';
import { notify } from '@/lib/notify';
import { forgetCachedUser } from '@/lib/session';
import { setTheme } from '@/lib/use-theme-sync';
import type { Theme } from '@/server/settings';

const rootRoute = getRouteApi('__root__');

type Choice = Theme | 'site';

// The choice being saved, shared by every caller. Each caller used to hold its own, so the rail's
// icon and label kept showing the old theme until the save came back, while the page had already
// changed, and a quick second press repeated the first choice instead of undoing it.
//
// It is only let go once the root loader has caught up (`confirmed`, then a matching
// personalTheme). Clearing it as soon as the save returned showed the old theme for a few frames,
// because the reloaded settings reach the components a beat later, so the label and icon flipped
// back and forth.
type Saving = { pending: Choice | null; confirmed: Choice | null };
const idle: Saving = { pending: null, confirmed: null };
let saving: Saving = idle;
const listeners = new Set<() => void>();
function setSaving(next: Saving) {
  saving = next;
  for (const listener of listeners) listener();
}
function setPending(next: Choice | null) {
  setSaving(next === null ? idle : { pending: next, confirmed: null });
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

// Saves go out one at a time and only the newest choice is sent, so quick presses can't land on
// the server out of order and leave it holding a theme the screen no longer shows.
let latest = 0;
let queue: Promise<void> = Promise.resolve();
// The last choice the server took, for going back to if a later one fails before the loader
// has caught up with it.
let accepted: Choice | null = null;

/**
 * This person's own light or dark choice, or "site" to follow Settings. The page changes as soon
 * as it is picked and goes back if saving fails. Shared by Profile, Appearance and the account menu.
 */
export function useThemeChoice() {
  const router = useRouter();
  const { siteTheme, personalTheme } = rootRoute.useLoaderData();
  const { pending, confirmed } = useSyncExternalStore(
    subscribe,
    () => saving,
    () => idle
  );
  // Let go of the choice once the loaded settings show it.
  useEffect(() => {
    if (pending !== null && confirmed === pending && (personalTheme ?? 'site') === pending) {
      setSaving(idle);
    }
  }, [pending, confirmed, personalTheme]);
  const value = pending ?? personalTheme ?? 'site';
  const resolve = (choice: Choice): Theme => (choice === 'site' ? siteTheme : choice);

  function choose(next: Choice): Promise<void> {
    const request = ++latest;
    const saved: Choice = personalTheme ?? 'site';
    setPending(next);
    setTheme(resolve(next));
    queue = queue.then(async () => {
      if (request !== latest) return;
      const { error } = await authClient.updateUser({ theme: next === 'site' ? null : next });
      if (!error) accepted = next;
      if (request !== latest) return;
      if (error) {
        setPending(null);
        setTheme(resolve(accepted ?? saved));
        notify.error('Could not change the theme', error.message ?? 'Please try again.');
        return;
      }
      forgetCachedUser();
      await router.invalidate();
      if (request !== latest) return;
      setSaving({ pending: next, confirmed: next });
      // A way out if the loaded theme never matches (say, it was changed from another tab).
      setTimeout(() => {
        if (saving.pending === next && saving.confirmed === next) setSaving(idle);
      }, 2000);
    });
    return queue;
  }

  /** The theme in effect, with "site" resolved to the site's own setting. */
  const effective: Theme = resolve(value);
  return { value, effective, siteTheme, choose };
}
