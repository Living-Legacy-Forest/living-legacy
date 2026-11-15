import { createFileRoute, redirect } from '@tanstack/react-router';
import { useEffect } from 'react';
import { z } from 'zod';
import { SignIn } from '@/components/login/sign-in';
import { getCurrentUser, getLoginOptions } from '@/lib/session';
import { notify } from '@/lib/notify';

const errorMessages: Record<string, string> = {
  not_invited: 'This account has not been invited. Ask an admin to invite you.',
  google_disabled: 'Google sign-in is turned off. Use an email link instead.',
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
  const { google } = Route.useLoaderData();

  useEffect(() => {
    if (error) {
      notify.error('Could not sign you in', errorMessages[error] ?? 'Please try again.', {
        id: 'login-error',
      });
    }
  }, [error]);

  return (
    <main className="bg-background flex min-h-svh items-center justify-center px-6 py-16">
      <SignIn google={google} errorMessages={errorMessages} />
    </main>
  );
}
