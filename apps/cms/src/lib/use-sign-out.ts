import { useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { clearAllDrafts } from '@/lib/draft-recovery';
import { notify } from '@/lib/notify';
import { forgetCachedUser } from '@/lib/session';

/**
 * Signs out and goes to the login page. The menu or sheet that asked stays open meanwhile, so it
 * can show `signingOut` on its item, and leaves with the page.
 */
export function useSignOut() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    const { error } = await authClient.signOut();
    if (error) {
      setSigningOut(false);
      notify.error('Could not sign out', error.message ?? 'Please try again.');
      return;
    }
    // Unsaved post text kept for recovery stays on this computer otherwise.
    clearAllDrafts();
    forgetCachedUser();
    await router.navigate({ to: '/login' });
  }

  return { signingOut, signOut };
}
