/**
 * What someone picked last time, to start the next new thing from it instead of from nothing:
 * the FAQ group they were adding to, the author they gave their last post. Kept in this browser
 * only. A choice is only used while it is still valid (the group may have been deleted), and only
 * ever fills a blank: it never overrides something chosen on the spot.
 */

const PREFIX = 'll-cms-last:';

export type LastChoiceKey = 'faq-group' | 'post-author';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The remembered id, if there is one and `isValid` still accepts it; otherwise null. */
export function readLastChoice(
  key: LastChoiceKey,
  isValid: (id: string) => boolean,
  store: Store | null = browserStore()
): string | null {
  try {
    const id = store?.getItem(PREFIX + key);
    return id && isValid(id) ? id : null;
  } catch {
    return null;
  }
}

/** Remembers `id`; null forgets it, as when someone picks "no author" on purpose. */
export function rememberChoice(
  key: LastChoiceKey,
  id: string | null,
  store: Store | null = browserStore()
) {
  try {
    if (id) store?.setItem(PREFIX + key, id);
    else store?.removeItem(PREFIX + key);
  } catch {
    // Blocked or full: the next new one just starts blank.
  }
}
