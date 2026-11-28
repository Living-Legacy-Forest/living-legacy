import { createFileRoute, redirect } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { SignIn } from '@/components/login/sign-in';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { getCurrentUser, getDevLoginLink, getLoginOptions } from '@/lib/session';
import { notify } from '@/lib/notify';

const errorMessages: Record<string, string> = {
  not_invited: 'This account has not been invited. Ask an admin to invite you.',
  google_disabled: 'Google sign-in is turned off. Use an email link instead.',
  passkeys_off: 'Passkey sign-in is not available here. Use an email link instead.',
};

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ error: z.string().optional() }),
  beforeLoad: async () => {
    if (await getCurrentUser()) throw redirect({ to: '/' });
  },
  loader: () => getLoginOptions(),
  head: () => ({ meta: [{ title: 'Sign in | Living Legacy CMS' }] }),
  component: LoginPage,
});

function LoginPage() {
  const { error } = Route.useSearch();
  const { google, passkeys } = Route.useLoaderData();

  useEffect(() => {
    if (error) {
      notify.error('Could not sign you in', errorMessages[error] ?? 'Please try again.', {
        id: 'login-error',
      });
    }
  }, [error]);

  return (
    <main className="bg-background flex min-h-svh items-center justify-center px-6 py-16">
      <div className="flex flex-col items-center gap-4">
        <SignIn google={google} passkeys={passkeys} errorMessages={errorMessages} />
        {import.meta.env.DEV && <DevSignIn />}
      </div>
    </main>
  );
}

/** Local dev only (`vite dev`): skips the inbox. The server refuses it anywhere but localhost. */
function DevSignIn() {
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    try {
      const { url } = await getDevLoginLink();
      window.location.href = url;
    } catch (error) {
      notify.error('Dev sign-in failed', (error as Error).message);
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={signIn} disabled={pending}>
      {pending && <Spinner />}
      Dev sign-in (localhost only)
    </Button>
  );
}
