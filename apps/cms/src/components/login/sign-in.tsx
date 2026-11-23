import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type Transition,
  type Variants,
} from 'motion/react';
import logoMark from '@/assets/brand/logo-mark.webp';
import { MailCheck } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { GoogleIcon } from '@/components/brand-logos';
import { authClient } from '@/lib/auth-client';
import { motionTokens } from '@/components/arc/motion-tokens';
import { notify } from '@/lib/notify';
import { reportInvalid } from '@/lib/form-validation';

type Step = 'email' | 'sent';
type StepCustom = { direction: number; reduce: boolean };

// Matches the server's cooldown, so Resend is only offered once it will send.
const RESEND_SECONDS = 60;

const domainFixes: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'iclod.com': 'icloud.com',
  'icoud.com': 'icloud.com',
  'yaho.com': 'yahoo.com',
};

function suggestionFor(value: string) {
  const [local, domain, extra] = value.trim().toLowerCase().split('@');
  return local && domain && extra === undefined && domainFixes[domain]
    ? `${local}@${domainFixes[domain]}`
    : '';
}

const stepMotion: Variants = {
  enter: ({ direction, reduce }: StepCustom) =>
    reduce
      ? { opacity: 0 }
      : { opacity: 0, x: direction * 28, filter: `blur(${motionTokens.blur.soft}px)` },
  center: ({ reduce }: StepCustom) => ({
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: reduce
      ? { duration: motionTokens.duration.instant }
      : {
          x: motionTokens.spring.smooth,
          opacity: {
            duration: motionTokens.duration.standard,
            ease: motionTokens.ease.enter,
            delay: 0.05,
          },
          filter: { duration: motionTokens.duration.standard, ease: motionTokens.ease.enter },
        },
  }),
  exit: ({ direction, reduce }: StepCustom) =>
    reduce
      ? { opacity: 0, transition: { duration: 0 } }
      : {
          opacity: 0,
          x: direction * -20,
          filter: `blur(${motionTokens.blur.soft}px)`,
          transition: {
            x: motionTokens.spring.smooth,
            opacity: { duration: motionTokens.duration.exit, ease: motionTokens.ease.standard },
            filter: { duration: motionTokens.duration.exit },
          },
        },
};

/** Seconds roll down while the timer runs. */
const roll: Variants = {
  enter: { opacity: 0, y: '-0.7em', filter: `blur(${motionTokens.blur.subtle}px)` },
  center: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: '0.7em', filter: `blur(${motionTokens.blur.subtle}px)` },
};

function RollingTime({ seconds, reduce }: { seconds: number; reduce: boolean }) {
  const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const transition: Transition = reduce
    ? { duration: 0 }
    : {
        y: motionTokens.spring.snappy,
        opacity: { duration: motionTokens.duration.fast },
        filter: { duration: motionTokens.duration.fast },
      };
  return (
    <span className="inline-flex tabular-nums" aria-hidden>
      {text.split('').map((character, index) => (
        <span key={index} className="relative inline-flex overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={character}
              variants={roll}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
            >
              {character}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

/** The card follows its content on a spring only while the step changes; otherwise it stays auto, so it never lags. */
function useStepHeight(step: Step, reduce: boolean) {
  const track = useRef<HTMLDivElement>(null);
  const height = useMotionValue<number | 'auto'>('auto');
  const measured = useRef(0);
  const gliding = useRef(false);
  const lastStep = useRef(step);

  const glide = useCallback(
    (to: number) => {
      gliding.current = true;
      animate(height, to, {
        ...motionTokens.spring.smooth,
        onComplete: () => {
          gliding.current = false;
          height.jump('auto');
        },
      });
    },
    [height]
  );

  useEffect(() => {
    const node = track.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      measured.current = entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight;
      if (gliding.current) glide(measured.current);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [glide]);

  useLayoutEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    const current = height.get();
    const from = typeof current === 'number' ? current : measured.current;
    const to = track.current?.offsetHeight ?? 0;
    if (reduce || !from || !to) {
      gliding.current = false;
      height.jump('auto');
      return;
    }
    if (current === 'auto') height.jump(from);
    glide(to);
  }, [step, reduce, height, glide]);

  return { track, height };
}

export function SignIn({
  google,
  errorMessages,
}: {
  google: boolean;
  errorMessages: Record<string, string>;
}) {
  const reduce = !!useReducedMotion();
  const [step, setStep] = useState<Step>('email');
  const [direction, setDirection] = useState(1);
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState<null | 'email' | 'google' | 'resend'>(null);
  const [resendIn, setResendIn] = useState(0);
  const [suggestionShown, setSuggestionShown] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const { track, height } = useStepHeight(step, reduce);

  const suggestion = suggestionShown ? suggestionFor(email) : '';
  const custom: StepCustom = { direction, reduce };

  useEffect(() => {
    if (step !== 'sent' || resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [step, resendIn]);

  async function sendLink(to: string) {
    const { error } = await authClient.signIn.magicLink({ email: to, callbackURL: '/' });
    if (error) {
      notify.error('Could not send the link', 'Something went wrong. Please try again.');
      return false;
    }
    return true;
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !reportInvalid(event.currentTarget)) return;
    const to = email.trim();
    setBusy('email');
    const ok = await sendLink(to);
    setBusy(null);
    if (!ok) return;
    // Same outcome for everyone, whether or not a link was sent, so the page never reveals who has access.
    setSentTo(to);
    setResendIn(RESEND_SECONDS);
    setDirection(1);
    setStep('sent');
  }

  async function resend() {
    if (busy || resendIn > 0) return;
    setBusy('resend');
    const ok = await sendLink(sentTo);
    setBusy(null);
    if (!ok) return;
    setResendIn(RESEND_SECONDS);
    notify.success({
      title: 'Link sent again',
      description: 'If this address has access, a new sign-in link is on its way.',
    });
  }

  function changeEmail() {
    setDirection(-1);
    setStep('email');
    setSuggestionShown(false);
    window.setTimeout(() => {
      emailRef.current?.focus();
      emailRef.current?.select();
    }, 0);
  }

  async function signInWithGoogle() {
    if (busy) return;
    setBusy('google');
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/',
      errorCallbackURL: '/login',
    });
    if (error) {
      setBusy(null);
      notify.error(
        'Could not sign you in',
        errorMessages[error.message ?? ''] ?? 'Please try again.'
      );
    }
  }

  return (
    <Card
      aria-label="Sign in"
      role="region"
      className="w-full max-w-sm [--card-spacing:--spacing(8)] sm:[--card-spacing:--spacing(10)]"
    >
      <motion.div className="overflow-hidden" style={{ height }}>
        {/* Inset here, not on the card, so the height glide measures the padded content. */}
        <div ref={track} className="px-(--card-spacing)">
          <AnimatePresence mode="popLayout" initial={false} custom={custom}>
            {step === 'email' && (
              <motion.div
                key="email"
                className="flex flex-col gap-8"
                custom={custom}
                variants={stepMotion}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <Heading
                  title="Welcome back"
                  description="Sign in to manage Living Legacy content."
                  mark
                />
                <div className="flex flex-col gap-5">
                  <form className="flex flex-col gap-3" onSubmit={submitEmail} noValidate>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="email" className="text-xs">
                        Email
                      </Label>
                      <Input
                        ref={emailRef}
                        id="email"
                        type="email"
                        required
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="you@example.com"
                        className="h-11"
                        value={email}
                        readOnly={busy === 'email'}
                        onChange={(event) => setEmail(event.target.value)}
                        onBlur={() => {
                          if (email.trim()) setSuggestionShown(true);
                        }}
                      />
                      <AnimatePresence initial={false}>
                        {suggestion && (
                          <motion.p
                            key="suggestion"
                            className="text-muted-foreground overflow-hidden text-xs"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={
                              reduce
                                ? { duration: 0 }
                                : {
                                    height: motionTokens.spring.smooth,
                                    opacity: { duration: motionTokens.duration.fast },
                                  }
                            }
                          >
                            Did you mean{' '}
                            <button
                              type="button"
                              className="text-foreground font-medium underline underline-offset-2"
                              onClick={() => {
                                setEmail(suggestion);
                                emailRef.current?.focus();
                              }}
                            >
                              {suggestion}
                            </button>
                            ?
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                    <Button
                      type="submit"
                      className="mt-1 h-11 w-full rounded-xl"
                      disabled={busy === 'email'}
                    >
                      {busy === 'email' ? (
                        <>
                          <Spinner />
                          Sending…
                        </>
                      ) : (
                        'Send sign-in link'
                      )}
                    </Button>
                  </form>

                  {google && (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="bg-border h-px flex-1" />
                        <span className="text-muted-foreground text-xs">or</span>
                        <span className="bg-border h-px flex-1" />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={signInWithGoogle}
                        disabled={busy === 'google'}
                        className="h-11 w-full gap-2.5 rounded-xl"
                      >
                        {busy === 'google' ? (
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
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {step === 'sent' && (
              <motion.div
                key="sent"
                className="flex flex-col items-center gap-6 text-center"
                custom={custom}
                variants={stepMotion}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <span className="bg-brand/10 text-brand flex size-12 items-center justify-center rounded-full">
                  <MailCheck aria-hidden className="size-5" />
                </span>
                <div className="space-y-1.5">
                  <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
                  <p className="text-muted-foreground text-sm text-balance">
                    If <span className="text-foreground font-medium break-all">{sentTo}</span> has
                    access, a sign-in link is on its way. It expires in five minutes.
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    disabled={resendIn > 0 || busy === 'resend'}
                    aria-label={
                      resendIn > 0 ? `Resend link, available in ${resendIn} seconds` : 'Resend link'
                    }
                    onClick={resend}
                  >
                    {busy === 'resend' ? (
                      <>
                        <Spinner />
                        Sending…
                      </>
                    ) : resendIn > 0 ? (
                      <>
                        Resend link in <RollingTime seconds={resendIn} reduce={reduce} />
                      </>
                    ) : (
                      'Resend link'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={changeEmail}
                  >
                    Use a different email
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </Card>
  );
}

function Heading({
  title,
  description,
  mark,
}: {
  title: string;
  description: string;
  mark?: boolean;
}) {
  return (
    <header className="flex flex-col items-center gap-3 text-center">
      {mark && (
        // White artwork painted in the brand colour via a CSS mask, as on the site.
        <span
          role="img"
          aria-label="Living Legacy"
          className="bg-brand inline-block shrink-0 dark:bg-white"
          style={{
            height: '2.75rem',
            aspectRatio: '1 / 1',
            WebkitMask: `url("${logoMark}") center / contain no-repeat`,
            mask: `url("${logoMark}") center / contain no-repeat`,
          }}
        />
      )}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm text-balance">{description}</p>
      </div>
    </header>
  );
}
