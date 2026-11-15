import { useSyncExternalStore } from 'react';
import {
  matchesShortcut,
  type Platform,
} from '@/components/arc/shortcut-recorder/shortcut-recorder';

// The shortcuts a person can change. They are kept in this browser only, so
// each editor sets their own. A key written "mod+k" means ⌘K on a Mac and
// Ctrl+K elsewhere, and null means switched off.

export const SHORTCUTS = {
  commandMenu: { label: 'Open search', fallback: 'mod+k' },
  toggleSidebar: { label: 'Show or hide the sidebar', fallback: 'mod+b' },
  savePost: { label: 'Save the post you are editing', fallback: 'mod+s' },
} as const;

export type ShortcutId = keyof typeof SHORTCUTS;
export const shortcutIds = Object.keys(SHORTCUTS) as ShortcutId[];

const STORAGE_KEY = 'll-cms-shortcuts';
const listeners = new Set<() => void>();
let stored: Partial<Record<ShortcutId, string | null>> | null = null;

function load() {
  if (stored) return stored;
  stored = {};
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as unknown;
    if (raw && typeof raw === 'object') {
      for (const id of shortcutIds) {
        const value = (raw as Record<string, unknown>)[id];
        if (typeof value === 'string' || value === null) stored[id] = value;
      }
    }
  } catch {
    // Private windows and blocked storage fall back to the defaults.
  }
  return stored;
}

function read(id: ShortcutId): string | null {
  const value = load()[id];
  return value === undefined ? SHORTCUTS[id].fallback : value;
}

export function setShortcut(id: ShortcutId, value: string | null) {
  const next = { ...load() };
  if (value === SHORTCUTS[id].fallback) delete next[id];
  else next[id] = value;
  stored = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Still applies until the page is closed.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The key combination for a shortcut, kept up to date as it is changed. */
export function useShortcut(id: ShortcutId): string | null {
  return useSyncExternalStore(
    subscribe,
    () => read(id),
    () => SHORTCUTS[id].fallback
  );
}

const platform = (): Platform =>
  /mac|iphone|ipad|ipod/i.test(globalThis.navigator?.platform ?? '') ? 'mac' : 'other';

/** True when a key press is the current shortcut. Read at press time, so a change applies at once. */
export function pressed(event: KeyboardEvent, id: ShortcutId) {
  const shortcut = read(id);
  return shortcut !== null && matchesShortcut(event, shortcut, platform());
}
