import { useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';

/**
 * Runs a mutation with a pending flag, a toast for the outcome and a router
 * refresh so loaders pick up the change.
 */
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run<T>(action: () => Promise<T>, success?: string | ((result: T) => string)) {
    setPending(true);
    try {
      const result = await action();
      if (success) toast.success(typeof success === 'function' ? success(result) : success);
      await router.invalidate();
      return result;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      );
      return undefined;
    } finally {
      setPending(false);
    }
  }

  return { run, pending };
}
