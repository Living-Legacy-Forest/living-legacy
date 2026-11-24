/**
 * A local copy of a post being edited, so a crash, a closed tab or a dead battery does not lose
 * it. The editor writes one while there are unsaved changes and clears it on a save; opening the
 * post again offers it back. It lives in this browser only: it is never sent anywhere, and it is
 * cleared on sign-out so a shared computer keeps nothing.
 */

const PREFIX = 'll-cms-draft:';

/** A draft older than this is forgotten rather than offered. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type Draft<V> = {
  values: V;
  /** The post's `updatedAt` this was based on; absent for a post that was never saved. */
  baseUpdatedAt: number | null;
  savedAt: number;
};

/** The storage this runs on; a parameter so tests can pass their own. */
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

function browserStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // Blocked storage (some private windows).
  }
}

/** Where a post's draft lives: by id, or one shared slot for a post not saved yet. */
export const draftKey = (postId: string | null) => `${PREFIX}${postId ?? 'new'}`;

/** Writes the draft. Quietly does nothing if storage is full or blocked. */
export function writeDraft<V>(
  key: string,
  draft: Omit<Draft<V>, 'savedAt'>,
  now = Date.now(),
  store: Store | null = browserStore()
) {
  try {
    store?.setItem(key, JSON.stringify({ ...draft, savedAt: now } satisfies Draft<V>));
  } catch {
    // Over quota: the post is still open and can still be saved; this is only a safety net.
  }
}

export function readDraft<V>(
  key: string,
  now = Date.now(),
  store: Store | null = browserStore()
): Draft<V> | null {
  try {
    const raw = store?.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<Draft<V>>;
    if (
      !draft ||
      typeof draft !== 'object' ||
      draft.values === undefined ||
      typeof draft.savedAt !== 'number' ||
      now - draft.savedAt > MAX_AGE_MS
    ) {
      store?.removeItem(key);
      return null;
    }
    return {
      values: draft.values,
      baseUpdatedAt: draft.baseUpdatedAt ?? null,
      savedAt: draft.savedAt,
    };
  } catch {
    return null;
  }
}

export function clearDraft(key: string, store: Store | null = browserStore()) {
  try {
    store?.removeItem(key);
  } catch {
    // Nothing to do.
  }
}

/** Every post's draft, on sign-out. */
export function clearAllDrafts(store: Store | null = browserStore()) {
  try {
    if (!store) return;
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => store.removeItem(key));
  } catch {
    // Nothing to do.
  }
}

/**
 * Whether to offer a draft: it differs from the post as the server has it, so there is
 * something to get back.
 */
export function worthOffering<V>(draft: Draft<V> | null, serverValues: V): draft is Draft<V> {
  return draft !== null && JSON.stringify(draft.values) !== JSON.stringify(serverValues);
}

/** The post was saved by someone since the draft was made, so restoring would replace their work. */
export const isStale = (draft: Draft<unknown>, serverUpdatedAt: number | undefined | null) =>
  (draft.baseUpdatedAt ?? null) !== (serverUpdatedAt ?? null);
