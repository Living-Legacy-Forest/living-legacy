import { createFileRoute, redirect } from '@tanstack/react-router';
import { Check, TreeDeciduous } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
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
    <main className="bg-background grid min-h-svh place-items-center px-6 py-10">
      <div className="w-full max-w-[21rem]">
        <header className="flex flex-col items-center text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-[#2c4633] text-white">
            <TreeDeciduous aria-hidden className="size-5" />
          </span>
          <h1 className="mt-5 text-lg font-semibold tracking-tight">Living Legacy Forest</h1>
          <p className="text-muted-foreground mt-1 text-sm text-balance">
            Sign in to manage the website content.
          </p>
        </header>

        <div className="mt-8">
          {error && (
            <p
              role="alert"
              className="bg-destructive/10 text-destructive mb-4 rounded-md px-3 py-2 text-sm"
            >
              {errorMessages[error] ?? 'Sign-in failed. Please try again.'}
            </p>
          )}
          <MagicLinkForm />
          {google && <GoogleSignIn />}
        </div>
      </div>
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
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-8 text-center">
        <span className="bg-muted text-foreground flex size-9 items-center justify-center rounded-full">
          <Check aria-hidden className="size-4" />
        </span>
        <div className="space-y-1 px-6">
          <p className="text-sm font-medium">Check your inbox</p>
          <p className="text-muted-foreground text-sm text-balance">
            If {email} has access, a sign-in link is on its way. It expires in five minutes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@livinglegacyforest.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={failed || undefined}
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
      <div className="my-5 flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">or</span>
        <span className="bg-border h-px flex-1" />
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        size="lg"
        onClick={signIn}
        disabled={pending}
      >
        {pending ? 'Redirecting to Google…' : 'Continue with Google'}
      </Button>
    </>
  );
}
