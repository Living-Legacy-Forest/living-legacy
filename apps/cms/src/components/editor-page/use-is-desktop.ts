import { useSyncExternalStore } from 'react';

/** From `lg` an editor's side panel sits beside the form and can be hidden; below it, it stacks under. */
export function useIsDesktop() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia('(min-width: 1024px)');
      query.addEventListener('change', notify);
      return () => query.removeEventListener('change', notify);
    },
    () => window.matchMedia('(min-width: 1024px)').matches,
    () => true
  );
}
