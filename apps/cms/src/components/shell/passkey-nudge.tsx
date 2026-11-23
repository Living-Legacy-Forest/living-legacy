import { useEffect, useState } from 'react';
import { KeyIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';
import { PASSKEYS_CHANGED, passkeyResult, supportsPasskeys } from '@/lib/passkey-browser';
import { NUDGE_KEY, defaultPasskeyName, shouldOfferPasskey } from '@/lib/passkeys';
import { getPasskeysEnabled } from '@/lib/session';
import { useAction } from '@/lib/use-action';

function dismissedAt(): number | null {
  try {
    const value = Number(localStorage.getItem(NUDGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function snooze() {
  try {
    localStorage.setItem(NUDGE_KEY, String(Date.now()));
  } catch {
    // Private browsing can refuse storage; the prompt then simply comes back next time.
  }
}

/**
 * Offers a passkey to someone who signed in another way and has none, on a device that can use
 * one. "Not now" keeps it away from that device for 30 days (lib/passkeys.ts).
 */
export function PasskeyNudge() {
  const [open, setOpen] = useState(false);
  const { run, pending: adding } = useAction();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const offer = (passkeyCount: number | null) =>
        shouldOfferPasskey({
          supported: supportsPasskeys(),
          passkeyCount,
          dismissedAt: dismissedAt(),
          now: Date.now(),
        });
      // Asks the server nothing while "Not now" still holds or the browser cannot use passkeys.
      if (!offer(0)) return;
      try {
        if (!(await getPasskeysEnabled())) return;
        const { data, error } = await authClient.passkey.listUserPasskeys();
        if (offer(error || !data ? null : data.length) && !cancelled) setOpen(true);
      } catch {
        // A prompt that cannot check is a prompt not shown.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function close(next: boolean) {
    if (next) return;
    snooze();
    setOpen(false);
  }

  async function add() {
    const added = await run(
      async () =>
        passkeyResult(
          await authClient.passkey.addPasskey({ name: defaultPasskeyName(navigator.userAgent) })
        ),
      {
        error: 'Could not add a passkey',
        success: (result) =>
          result
            ? {
                title: 'Passkey added',
                description: 'Next time, sign in with it. Manage passkeys on your profile.',
              }
            : undefined,
      }
    );
    if (!added) return;
    setOpen(false);
    // The profile's list, if it is open behind this, shows the new passkey.
    window.dispatchEvent(new Event(PASSKEYS_CHANGED));
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <span className="bg-brand/10 text-brand mb-1 flex size-10 items-center justify-center rounded-full">
            <KeyIcon aria-hidden className="size-5" />
          </span>
          <DialogTitle>Sign in faster next time</DialogTitle>
          <DialogDescription>
            Add a passkey and sign in with Face ID, Touch ID or your device&apos;s lock.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={adding}>
            Not now
          </Button>
          <Button type="button" onClick={() => void add()} disabled={adding}>
            {adding ? <Spinner /> : null}
            Add a passkey
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
