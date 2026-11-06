import { useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { type Notice, notify } from './notify';

export type RunOptions<T> = {
  /** The toast when it works; none if left out (a reorder, say). */
  success?: Notice | ((result: T) => Notice);
  /** Heading for the toast when it fails; the reason goes under it. */
  error: string;
};

/**
 * Runs a mutation with a pending flag, a toast for the outcome and a router
 * refresh so loaders pick up the change.
 */
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run<T>(action: () => Promise<T>, { success, error }: RunOptions<T>) {
    setPending(true);
    try {
      const result = await action();
      if (success) notify.success(typeof success === 'function' ? success(result) : success);
      await router.invalidate();
      return result;
    } catch (caught) {
      notify.error(error, caught);
      return undefined;
    } finally {
      setPending(false);
    }
  }

  return { run, pending };
}
