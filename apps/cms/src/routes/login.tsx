import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authClient } from '@/lib/auth-client';
import { getCurrentUser } from '@/lib/session';

const errorMessages: Record<string, string> = {
  not_invited: 'This Google account has not been invited. Ask an admin to invite you.',
};

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ error: z.string().optional() }),
  beforeLoad: async () => {
    if (await getCurrentUser()) throw redirect({ to: '/' });
  },
  head: () => ({ meta: [{ title: 'Sign in | Living Legacy Forest CMS' }] }),
  component: LoginPage,
});

function LoginPage() {
  const { error } = Route.useSearch();
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    const { error: signInError } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/',
      errorCallbackURL: '/login',
    });
    if (signInError) setPending(false);
  }

  return (
    <main className="bg-muted/40 grid min-h-svh place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>
            <h1 className="text-2xl">Living Legacy Forest</h1>
          </CardTitle>
          <CardDescription>Sign in to manage the website content.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {errorMessages[error] ?? 'Sign-in failed. Please try again.'}
            </p>
          )}
          <Button className="w-full" size="lg" onClick={signIn} disabled={pending}>
            {pending ? 'Redirecting to Google…' : 'Sign in with Google'}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
