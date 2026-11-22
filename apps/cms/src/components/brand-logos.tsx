import {
  type SimpleIcon,
  siBetterstack,
  siClaude,
  siGoogleanalytics,
  siGoogletagmanager,
  siHubspot,
  siMeta,
  siPosthog,
  siResend,
  siSentry,
} from 'simple-icons';
import { cn } from '@/lib/utils';

// Brand marks are not interface icons, so this is the one place an icon package is imported
// directly. simple-icons is CC0 and tree-shaken: only the marks named above reach the page.

/** Google's multicolour "G". The one mark simple-icons draws in a single colour, so it is kept here. */
export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 262" aria-hidden className={cn('size-4', className)}>
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

// Claude Code's pixel mark is not in simple-icons yet, so it is drawn here from Anthropic's own SVG.
const claudeCode = {
  path: 'M21 10.5h3v3h-3v3h-1.5v3H18v-3h-1.5v3H15v-3H9v3H7.5v-3H6v3H4.5v-3H3v-3H0v-3h3v-6h18Zm-15 0h1.5v-3H6Zm10.5 0H18v-3h-1.5z',
  hex: 'D97757',
};

const marks = {
  betterstack: siBetterstack,
  claude: siClaude,
  claudecode: claudeCode,
  googleanalytics: siGoogleanalytics,
  googletagmanager: siGoogletagmanager,
  hubspot: siHubspot,
  meta: siMeta,
  posthog: siPosthog,
  resend: siResend,
  sentry: siSentry,
} satisfies Record<string, Pick<SimpleIcon, 'path' | 'hex'>>;

export type BrandName = keyof typeof marks | 'google';

/** A service's mark on its own, in its brand colour, for places too small for a tile (tabs). */
export function BrandMark({ brand, className }: { brand: BrandName; className?: string }) {
  if (brand === 'google') return <GoogleIcon className={className} />;
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn('size-4', className)}>
      <path d={marks[brand].path} fill={`#${marks[brand].hex}`} />
    </svg>
  );
}

/**
 * A service's logo on a white tile, so a black mark (Resend, PostHog, Better Stack) reads in dark
 * mode as well as light. Decorative: the service's name is always written beside it.
 */
export function BrandLogo({ brand, className }: { brand: BrandName; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-black/10',
        className
      )}
    >
      <BrandMark brand={brand} className="size-5" />
    </span>
  );
}
