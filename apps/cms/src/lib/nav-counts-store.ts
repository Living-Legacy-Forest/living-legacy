import { useEffect, useSyncExternalStore } from 'react';
import type { NavCountPath, NavCounts } from './nav-counts';

/**
 * The sidebar's numbers, held in the browser for the whole visit. They are asked of the server
 * once, when the app opens. After that nothing asks again: the pages that show the same figures
 * (the dashboard, Content checks, Redirects) already have them from their own load, and hand
 * them on here, so the badge follows what you do without a request of its own.
 */

const EMPTY: NavCounts = {};
let counts: NavCounts = EMPTY;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

/** Sets one page's number, if it has changed. */
export function setNavCount(path: NavCountPath, count: number) {
  if (counts[path] === count) return;
  counts = { ...counts, [path]: count };
  emit();
}

/**
 * Adds what the server said, without overwriting a number a page has set since: that one is
 * newer than an answer that was on its way.
 */
export function mergeNavCounts(fromServer: NavCounts) {
  counts = { ...fromServer, ...counts };
  emit();
}

/** Forgets everything, when a different person is signed in. */
export function resetNavCounts() {
  if (counts === EMPTY) return;
  counts = EMPTY;
  emit();
}

export const getNavCountsSnapshot = () => counts;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useNavCounts(): NavCounts {
  return useSyncExternalStore(subscribe, getNavCountsSnapshot, () => EMPTY);
}

/**
 * For a page that already has a number the sidebar shows (from its own load): gives it to the
 * sidebar, so the badge stays right without asking the server. Nothing when the page has none
 * (a person who cannot see that figure).
 */
export function useShareNavCount(path: NavCountPath, count: number | null | undefined) {
  useEffect(() => {
    if (count !== null && count !== undefined) setNavCount(path, count);
  }, [path, count]);
}
