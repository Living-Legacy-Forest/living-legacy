import { useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { type Notice, notify } from './notify';

export type RunOptions<T> = {
  /** The toast when it works; none if left out (a reorder, say) or if the function returns none. */
  success?: Notice | ((result: T) => Notice | undefined);
  /** Heading for the toast when it fails; the reason goes under it. */
  error: string;
  /** A loading toast for the outcome to replace, e.g. one showing progress. */
  toastId?: string | number;
};

/**
 * Runs a mutation with a pending flag, a toast for the outcome and a router
 * refresh so loaders pick up the change.
 */
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run<T>(action: () => Promise<T>, { success, error, toastId }: RunOptions<T>) {
    setPending(true);
    try {
      const result = await action();
      if (success) {
        const notice = typeof success === 'function' ? success(result) : success;
        if (notice) notify.success({ id: toastId, ...notice });
      }
      await router.invalidate();
      return result;
    } catch (caught) {
      notify.error(error, caught, { id: toastId });
      return undefined;
    } finally {
      setPending(false);
    }
  }

  return { run, pending };
}
