import { useEffect, useRef, useState } from 'react';
import { KeyIcon } from '@/components/icons';
import { SettingsSection } from '@/components/settings/settings-section';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';
import { formatRelative } from '@/lib/format';
import { notify } from '@/lib/notify';
import { PASSKEYS_CHANGED, passkeyResult, supportsPasskeys } from '@/lib/passkey-browser';
import { defaultPasskeyName } from '@/lib/passkeys';
import { useAction } from '@/lib/use-action';

type Passkey = { id: string; name?: string | null; backedUp: boolean; createdAt?: Date | string };

/**
 * This person's passkeys: add one for this device, rename or remove the others. Shown on the live
 * CMS only (the profile loader decides); email links keep working whatever is removed here.
 */
export function PasskeysSection() {
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const { run, pending } = useAction();
  // Which control the running action belongs to ('add' or a passkey's id), for its spinner.
  const [target, setTarget] = useState<string | null>(null);
  const busy = pending ? target : null;
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [toRemove, setToRemove] = useState<Passkey | null>(null);
  const [supported, setSupported] = useState(false);
  const renameInput = useRef<HTMLInputElement>(null);
  const renamingId = renaming?.id;
  const latestLoad = useRef(0);

  useEffect(() => {
    if (renamingId) renameInput.current?.focus();
  }, [renamingId]);

  /** Reloads the list. Only the newest reload is shown, so a slow older one cannot undo a change. */
  async function load() {
    const request = ++latestLoad.current;
    try {
      const data = passkeyResult(await authClient.passkey.listUserPasskeys());
      if (request === latestLoad.current) setPasskeys((data as Passkey[] | null) ?? []);
    } catch (error) {
      if (request !== latestLoad.current) return;
      notify.error('Could not load your passkeys', error);
      setPasskeys((current) => current ?? []);
    }
  }

  useEffect(() => {
    setSupported(supportsPasskeys());
    void load();
    // A passkey added from the "Sign in faster" prompt shows here without a reload.
    const reload = () => void load();
    window.addEventListener(PASSKEYS_CHANGED, reload);
    return () => window.removeEventListener(PASSKEYS_CHANGED, reload);
  }, []);

  async function add() {
    setTarget('add');
    await run(
      async () =>
        passkeyResult(
          await authClient.passkey.addPasskey({ name: defaultPasskeyName(navigator.userAgent) })
        ),
      {
        error: 'Could not add a passkey',
        success: (added) =>
          added
            ? { title: 'Passkey added', description: 'Next time, sign in with it.' }
            : undefined,
      }
    );
    await load();
  }

  async function rename() {
    if (!renaming) return;
    const { id } = renaming;
    const name = renaming.name.trim();
    const current = passkeys?.find((p) => p.id === id);
    setRenaming(null);
    if (!name || name === current?.name) return;
    setTarget(id);
    await run(async () => passkeyResult(await authClient.passkey.updatePasskey({ id, name })), {
      error: 'Could not rename the passkey',
    });
    await load();
  }

  async function remove(passkey: Passkey) {
    setToRemove(null);
    setTarget(passkey.id);
    await run(
      async () => passkeyResult(await authClient.passkey.deletePasskey({ id: passkey.id })),
      {
        error: 'Could not remove the passkey',
        success: {
          title: 'Passkey removed',
          description: 'You can still sign in with an email link.',
        },
      }
    );
    await load();
  }

  return (
    <SettingsSection
      id="passkeys"
      title="Passkeys"
      framed
      description="Sign in with Face ID, Touch ID or your device's lock instead of waiting for an email."
    >
      {passkeys === null ? (
        <div className="flex items-center justify-center px-4 py-6">
          <Spinner />
        </div>
      ) : (
        <>
          {passkeys.length === 0 && (
            <p className="text-muted-foreground text-ui px-4 py-3">No passkeys yet.</p>
          )}
          {passkeys.map((passkey) => (
            <div key={passkey.id} className="touch:min-h-11 flex items-center gap-3 px-4 py-3">
              <KeyIcon aria-hidden className="text-muted-foreground size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                {renaming?.id === passkey.id ? (
                  <Input
                    ref={renameInput}
                    aria-label="Passkey name"
                    className="h-8"
                    value={renaming.name}
                    maxLength={60}
                    onChange={(event) => setRenaming({ id: passkey.id, name: event.target.value })}
                    onBlur={() => void rename()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void rename();
                      if (event.key === 'Escape') setRenaming(null);
                    }}
                  />
                ) : (
                  <p className="text-ui truncate font-medium">{passkey.name || 'Passkey'}</p>
                )}
                <p className="text-muted-foreground text-xs">
                  {passkey.backedUp ? 'Synced' : 'This device only'}
                  {passkey.createdAt
                    ? ` · Added ${formatRelative(new Date(passkey.createdAt).getTime())}`
                    : ''}
                </p>
              </div>
              {renaming?.id !== passkey.id && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => setRenaming({ id: passkey.id, name: passkey.name ?? '' })}
                  >
                    Rename
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => setToRemove(passkey)}
                  >
                    {busy === passkey.id ? <Spinner /> : null}
                    Remove
                  </Button>
                </div>
              )}
            </div>
          ))}
          {supported && (
            <div className="flex justify-end px-4 py-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => void add()}
              >
                {busy === 'add' ? <Spinner /> : null}
                Add a passkey
              </Button>
            </div>
          )}
        </>
      )}

      <AlertDialog open={toRemove !== null} onOpenChange={(open) => !open && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this passkey?</AlertDialogTitle>
            <AlertDialogDescription>
              You can still sign in with an email link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => toRemove && void remove(toRemove)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}
