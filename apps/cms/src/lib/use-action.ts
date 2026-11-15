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
  /**
   * Runs after the toast and before the loaders refresh, for a caller that is about
   * to leave the page: refreshing first would reload a page whose subject is gone.
   */
  afterAction?: (result: T) => void | Promise<void>;
};

/**
 * Runs a mutation with a pending flag, a toast for the outcome and a router
 * refresh so loaders pick up the change.
 */
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return { run: createRunner({ invalidate: () => router.invalidate(), setPending }), pending };
}

/** `run` apart from React, so the order of its steps can be tested. */
export function createRunner({
  invalidate,
  setPending,
}: {
  invalidate: () => Promise<unknown>;
  setPending: (pending: boolean) => void;
}) {
  return async function run<T>(
    action: () => Promise<T>,
    { success, error, toastId, afterAction }: RunOptions<T>
  ) {
    setPending(true);
    try {
      const result = await action();
      if (success) {
        const notice = typeof success === 'function' ? success(result) : success;
        if (notice) notify.success({ id: toastId, ...notice });
      }
      await afterAction?.(result);
      await invalidate();
      return result;
    } catch (caught) {
      notify.error(error, caught, { id: toastId });
      return undefined;
    } finally {
      setPending(false);
    }
  };
}
