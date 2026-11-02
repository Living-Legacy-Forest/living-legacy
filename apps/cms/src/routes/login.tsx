import { createFileRoute, redirect } from '@tanstack/react-router';
import { MailCheck } from '@/components/icons';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import logoMark from '@/assets/brand/logo-mark.webp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
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
  head: () => ({ meta: [{ title: 'Sign in | Living Legacy CMS' }] }),
  component: LoginPage,
});

function LoginPage() {
  const { error } = Route.useSearch();
  const { google } = Route.useLoaderData();
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      toast.error(errorMessages[error] ?? 'Sign-in failed. Please try again.', {
        id: 'login-error',
      });
    }
  }, [error]);

  return (
    <main className="bg-background flex min-h-svh items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        {sentTo ? (
          <SentConfirmation email={sentTo} onReset={() => setSentTo(null)} />
        ) : (
          <>
            <header className="flex flex-col items-center gap-3 text-center">
              {/* White artwork painted in the brand colour via a CSS mask, as on the site. */}
              <span
                role="img"
                aria-label="Living Legacy"
                className="bg-brand inline-block shrink-0"
                style={{
                  height: '2.75rem',
                  aspectRatio: '97 / 81',
                  WebkitMask: `url("${logoMark}") center / contain no-repeat`,
                  mask: `url("${logoMark}") center / contain no-repeat`,
                }}
              />
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
                <p className="text-muted-foreground text-sm text-balance">
                  Sign in to manage Living Legacy content.
                </p>
              </div>
            </header>

            <div className="mt-8">
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

              <MagicLinkForm onSent={setSentTo} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function SentConfirmation({ email, onReset }: { email: string; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="bg-brand/10 text-brand flex size-12 items-center justify-center rounded-full">
        <MailCheck aria-hidden className="size-5" />
      </span>
      <div className="space-y-1.5">
        <p className="text-lg font-semibold tracking-tight">Check your inbox</p>
        <p className="text-muted-foreground text-sm text-balance">
          If <span className="text-foreground font-medium">{email}</span> has access, a sign-in link
          is on its way. It expires in five minutes.
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={onReset}
      >
        Use a different email
      </Button>
    </div>
  );
}

function MagicLinkForm({ onSent }: { onSent: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: '/' });
    setPending(false);
    if (error) {
      toast.error('Something went wrong. Please try again.');
      return;
    }
    // Same outcome for everyone, whether or not a link was actually sent, so the
    // page never reveals who has access.
    toast.success('Check your email for a sign-in link.');
    onSent(email);
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
          placeholder="you@example.com"
          className="h-11"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <Button type="submit" className="mt-1 h-11 w-full rounded-xl" disabled={pending}>
        {pending ? (
          <>
            <Spinner />
            Sending…
          </>
        ) : (
          'Send sign-in link'
        )}
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
      {pending ? (
        <>
          <Spinner />
          Redirecting to Google…
        </>
      ) : (
        <>
          <GoogleIcon />
          Continue with Google
        </>
      )}
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
