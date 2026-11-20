// The share of a list page's width that the list takes, beside its edit pane: pure rules for the
// draggable divider, so they can be tested without a browser.

/** The list never takes less than this, so rows keep room for their text. */
export const MIN_SHARE = 0.3;
/** Nor more than this, so the edit pane stays usable. */
export const MAX_SHARE = 0.7;

export const clampShare = (share: number) => Math.min(MAX_SHARE, Math.max(MIN_SHARE, share));

/** How far across the frame the pointer is, as the list's share. */
export function shareFromPointer(clientX: number, frame: { left: number; width: number }) {
  if (frame.width <= 0) return MIN_SHARE;
  return clampShare((clientX - frame.left) / frame.width);
}

/** An arrow key moves the divider two points; with Shift, ten. */
export function stepShare(share: number, direction: 'left' | 'right', big: boolean) {
  const step = big ? 0.1 : 0.02;
  return clampShare(share + (direction === 'right' ? step : -step));
}

/** A saved share, or `fallback` when there is none or it is not a usable number. */
export function parseStoredShare(stored: string | null, fallback: number) {
  const value = Number(stored);
  if (stored === null || !Number.isFinite(value) || value < MIN_SHARE || value > MAX_SHARE) {
    return fallback;
  }
  return value;
}
