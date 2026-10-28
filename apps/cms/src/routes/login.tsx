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
    <main className="bg-background flex min-h-svh items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-[#2c4633] text-white">
            <TreeDeciduous aria-hidden className="size-5" />
          </span>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground text-sm text-balance">
              Sign in to manage Living Legacy Forest content.
            </p>
          </div>
        </header>

        <div className="mt-8">
          {error && (
            <p
              role="alert"
              className="bg-destructive/10 text-destructive mb-4 rounded-lg px-3 py-2 text-sm"
            >
              {errorMessages[error] ?? 'Sign-in failed. Please try again.'}
            </p>
          )}

          {google && (
            <>
              <GoogleSignIn />
              <div className="my-5 flex items-center gap-3">
                <span className="bg-border h-px flex-1" />
                <span className="text-muted-foreground text-xs">or</span>
                <span className="bg-border h-px flex-1" />
              </div>
            </>
          )}

          <MagicLinkForm />
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
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-8 text-center">
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
    <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email" className="text-xs">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@livinglegacyforest.com"
          className="h-11"
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
      <Button type="submit" className="mt-1 h-11 w-full rounded-xl" disabled={pending}>
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
    <Button
      type="button"
      variant="outline"
      onClick={signIn}
      disabled={pending}
      className="h-11 w-full gap-2.5 rounded-xl"
    >
      <GoogleIcon />
      {pending ? 'Redirecting to Google…' : 'Continue with Google'}
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 256 262" aria-hidden className="size-4">
      <path
        fill="#4285f4"
        d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
      />
      <path
        fill="#34a853"
        d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
      />
      <path
        fill="#fbbc05"
        d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
      />
      <path
        fill="#eb4335"
        d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
      />
    </svg>
  );
}
