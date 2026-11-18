import type { KeyboardEvent } from 'react';

/**
 * True while an input method (Japanese, Chinese, Korean…) is still picking characters, when
 * Enter confirms the candidate rather than the field. Safari clears `isComposing` before the
 * confirming keydown, so the 229 key code catches it there.
 */
export function isComposing(e: KeyboardEvent): boolean {
  return e.nativeEvent.isComposing || e.keyCode === 229;
}

/** Enter pressed to act on the field, not to confirm an input-method candidate. */
export function isEnterKey(e: KeyboardEvent): boolean {
  return e.key === 'Enter' && !isComposing(e);
}
