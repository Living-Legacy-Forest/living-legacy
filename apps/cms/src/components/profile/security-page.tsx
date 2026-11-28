import { useEffect, useState } from 'react';
import { MailIcon } from '@/components/icons';
import { SettingsRow, SettingsSection } from '@/components/settings/settings-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';
import { reportInvalid } from '@/lib/form-validation';
import { notify } from '@/lib/notify';
import type { SessionUser } from '@/lib/session';
import { DevicesSection } from './devices-section';
import { PasskeysSection } from './passkeys-section';

/** Sign-in and devices: the address you sign in with, where you are signed in, and passkeys. */
export function SecurityPage({
  user,
  justConfirmedEmail,
  passkeys,
}: {
  user: SessionUser;
  justConfirmedEmail: boolean;
  /** Passkeys are on here (the live CMS only). */
  passkeys: boolean;
}) {
  useEffect(() => {
    if (justConfirmedEmail) {
      notify.success({
        id: 'email-confirmed',
        title: 'Email confirmed',
        description: 'Sign in with the new address from now on.',
      });
    }
  }, [justConfirmedEmail]);

  return (
    <div data-slot="stack-page" className="mx-auto w-full max-w-3xl space-y-10">
      <div className="space-y-1 max-md:px-4">
        <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
          Sign-in &amp; devices
        </h1>
        <p className="text-muted-foreground text-sm">
          How you sign in, and where you are signed in right now.
        </p>
      </div>
      <ChangeEmail currentEmail={user.email} />
      <DevicesSection />
      {passkeys && <PasskeysSection />}
    </div>
  );
}

function ChangeEmail({ currentEmail }: { currentEmail: string }) {
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    if (newEmail.trim().toLowerCase() === currentEmail.toLowerCase()) {
      notify.error('Nothing to change', "That's already your email.");
      return;
    }
    setPending(true);
    const { error } = await authClient.changeEmail({
      newEmail: newEmail.trim(),
      callbackURL: '/profile/security?emailConfirmed=yes',
    });
    setPending(false);
    if (error) {
      notify.error('Could not send the link', error.message ?? 'Please try again.');
      return;
    }
    setSentTo(newEmail.trim());
    setEditing(false);
  }

  return (
    <SettingsSection
      id="sign-in"
      title="Sign-in"
      description="There is no password: you sign in with a link sent to this address."
    >
      <SettingsRow id="profile-email" title="Email">
        <div className="flex items-center gap-2 max-md:justify-end">
          <span className="text-muted-foreground text-ui flex min-w-0 items-center gap-2">
            <MailIcon aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{currentEmail}</span>
          </span>
          {!editing && (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              Change
            </Button>
          )}
        </div>
      </SettingsRow>
      {editing && (
        <form noValidate onSubmit={send} className="flex flex-wrap gap-2 max-md:px-4 max-md:py-3">
          <Input
            id="profile-email"
            type="email"
            maxLength={254}
            required
            placeholder="new@address.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full sm:w-72"
          />
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner /> : null}
            Send link
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      )}
      {sentTo && (
        <p className="text-muted-foreground text-xs max-md:px-4 max-md:py-3">
          We sent a confirmation link to <span className="text-foreground">{sentTo}</span>. Your
          sign-in email changes once you click it.
        </p>
      )}
    </SettingsSection>
  );
}
