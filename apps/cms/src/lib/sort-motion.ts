import { useReducedMotion } from 'motion/react';
import { useSyncExternalStore } from 'react';
import { motionTokens } from '@/components/arc/lib/motion-tokens';

// Whether a list has just been re-sorted. Rows glide to their new places only then: a row that
// appears, disappears or moves for any other reason (a filter, a delete) behaves as it always did.

let sorting = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Set as a sort is chosen, before the new order renders, and cleared once the glide is over. */
export function markSorting() {
  sorting = true;
  notify();
  clearTimeout(timer);
  timer = setTimeout(() => {
    sorting = false;
    notify();
  }, 900);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/**
 * Props for a row, card or tile (`<motion.li {...useSortLayout()}>`): it glides to its new place
 * when the list is re-sorted and moves instantly the rest of the time, as with reduced motion.
 * `enabled` is off for rows beyond the first screens of a very long list, which just move.
 */
export function useSortLayout(enabled = true) {
  const isSorting = useSyncExternalStore(
    subscribe,
    () => sorting,
    () => false
  );
  const reduced = useReducedMotion();
  if (!enabled) return {};
  return {
    layout: 'position' as const,
    transition: { layout: isSorting && !reduced ? motionTokens.spring.snappy : { duration: 0 } },
  };
}
