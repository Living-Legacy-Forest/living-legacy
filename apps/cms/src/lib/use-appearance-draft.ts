import { APPEARANCE_VARS, type Appearance, appearanceVars } from '@ll/content';
import { getRouteApi, useRouter } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { notify } from '@/lib/notify';
import { setMyAppearance } from '@/server/profile';

const rootRoute = getRouteApi('__root__');

/** Writes an appearance onto <html> ahead of the save, so dragging changes the page as it goes. */
function paint(appearance: Appearance, siteColour: string) {
  const root = document.documentElement;
  for (const name of APPEARANCE_VARS) root.style.removeProperty(name);
  for (const [name, value] of Object.entries(appearanceVars(appearance))) {
    root.style.setProperty(name, value);
  }
  root.dataset.colour = appearance.colour ? 'custom' : siteColour;
}

/**
 * The picked appearance, shown at once and saved shortly after the last change, so a drag or a
 * run of arrow presses is one save. If saving fails the page goes back to what was saved.
 */
export function useAppearanceDraft() {
  const router = useRouter();
  const { appearance: saved, cmsColour } = rootRoute.useLoaderData();
  const [draft, setDraft] = useState<Appearance>(saved);
  const timer = useRef(0);
  const savedRef = useRef(saved);
  savedRef.current = saved;

  function change(next: Appearance, commit: boolean) {
    setDraft(next);
    paint(next, cmsColour);
    if (!commit) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(next), 350);
  }

  async function save(next: Appearance) {
    try {
      await setMyAppearance({ data: next });
      await router.invalidate();
    } catch (error) {
      paint(savedRef.current, cmsColour);
      setDraft(savedRef.current);
      notify.error('Could not save your appearance', error);
    }
  }

  return { draft, change };
}
