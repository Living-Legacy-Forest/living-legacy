import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { getCurrentUser, getLoginOptions } from '@/lib/session';

const errorMessages: Record<string, string> = {
  not_invited: 'This account has not been invited. Ask an admin to invite you.',
};

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ error: z.string().optional() }),
  beforeLoad: async () => {
    if (await getCurrentUser()) throw redirect({ to: '/' });
  },
  loader: () => getLoginOptions(),
  head: () => ({ meta: [{ title: 'Sign in | Living Legacy Forest CMS' }] }),
  component: LoginPage,
});

function LoginPage() {
  const { error } = Route.useSearch();
  const { google } = Route.useLoaderData();

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
          <MagicLinkForm />
          {google && <GoogleSignIn />}
        </CardContent>
      </Card>
    </main>
  );
}

function MagicLinkForm() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setFailed(false);
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: '/' });
    setPending(false);
    // On success we always show the same message, whether or not a link was
    // actually sent, so the page never reveals who has access.
    if (error) setFailed(true);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-2 text-center">
        <p className="text-sm">
          If <span className="font-medium">{email}</span> has access, a sign-in link is on its way.
        </p>
        <p className="text-muted-foreground text-sm">
          The link expires in 5 minutes. You can close this tab.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@livinglegacyforest.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          Something went wrong. Please try again.
        </p>
      )}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? 'Sending…' : 'Email me a sign-in link'}
      </Button>
    </form>
  );
}

function GoogleSignIn() {
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/',
      errorCallbackURL: '/login',
    });
    if (error) setPending(false);
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">or</span>
        <span className="bg-border h-px flex-1" />
      </div>
      <Button variant="outline" className="w-full" onClick={signIn} disabled={pending}>
        {pending ? 'Redirecting to Google…' : 'Sign in with Google'}
      </Button>
    </>
  );
}
