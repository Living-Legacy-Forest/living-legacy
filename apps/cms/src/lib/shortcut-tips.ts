/**
 * A nudge towards a row's keyboard shortcut, for someone who keeps choosing the same action from
 * its menu with the mouse. The menu already lists each key; this says it once, in words, after
 * the third time, and then leaves it alone: once per action, three tips in all. Kept in this
 * browser only. Never for delete, which is not worth hurrying.
 */

const STORAGE_KEY = 'll-cms-shortcut-tips';

/** Menu uses of one action before its tip. */
export const TIP_AFTER = 3;
/** Tips in total, ever, so the app never becomes a teacher. */
export const MAX_TIPS = 3;

type Store = Pick<Storage, 'getItem' | 'setItem'>;
type State = { uses: Record<string, number>; shown: string[] };

export type TipShortcut = { key: string; alt?: boolean };

const KEY_NAMES: Record<string, string> = {
  Backspace: 'Delete',
  ArrowUp: '↑',
  ArrowDown: '↓',
};

/** "P", "Delete", "Option + ↑": the key as someone would say it. */
export function describeShortcut({ key, alt }: TipShortcut, mac: boolean) {
  const name = KEY_NAMES[key] ?? key.toUpperCase();
  return alt ? `${mac ? 'Option' : 'Alt'} + ${name}` : name;
}

function browserStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function load(store: Store | null): State {
  try {
    const raw = JSON.parse(store?.getItem(STORAGE_KEY) ?? '{}') as Partial<State> | null;
    return {
      uses: raw && typeof raw.uses === 'object' && raw.uses ? raw.uses : {},
      shown: Array.isArray(raw?.shown) ? raw.shown : [],
    };
  } catch {
    return { uses: {}, shown: [] };
  }
}

/**
 * Records one use of `label` from the menu with a mouse. Returns the tip to show when this is
 * the use that earns it, otherwise null.
 */
export function noteMenuUse(
  label: string,
  shortcut: TipShortcut,
  { mac = false, store = browserStore() }: { mac?: boolean; store?: Store | null } = {}
): string | null {
  // Open (Enter) is the row's own click, and delete is not something to speed up.
  if (shortcut.key === 'Enter' || shortcut.key === 'Backspace') return null;

  const state = load(store);
  if (state.shown.includes(label) || state.shown.length >= MAX_TIPS) return null;

  state.uses[label] = (state.uses[label] ?? 0) + 1;
  const earned = state.uses[label] >= TIP_AFTER;
  if (earned) state.shown.push(label);
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Blocked or full: the tip simply may repeat on another visit.
  }
  if (!earned) return null;

  const action = label.charAt(0).toLowerCase() + label.slice(1);
  return `Click a row, then press ${describeShortcut(shortcut, mac)} to ${action}.`;
}
