// Rules for passkey sign-in that both the server and the browser use. Kept free of Workers and
// browser APIs so they can be tested on their own.

/**
 * Passkeys are for the live CMS only: a passkey belongs to the address it was made on, so one made
 * on a preview or on localhost would never work on the live site. On means a deployed build
 * answering on the address in BETTER_AUTH_URL.
 */
export function passkeysAllowed(opts: { dev: boolean; requestUrl: string; authUrl: string }) {
  if (opts.dev) return false;
  try {
    return new URL(opts.requestUrl).origin === new URL(opts.authUrl).origin;
  } catch {
    return false;
  }
}

/** How long "Not now" on the add-a-passkey prompt keeps it away, on that device. */
export const NUDGE_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;
/** Where that device remembers when "Not now" was chosen (localStorage, milliseconds). */
export const NUDGE_KEY = 'll:passkey-nudge-dismissed';

/** Whether to offer someone a passkey after they signed in another way. */
export function shouldOfferPasskey(opts: {
  supported: boolean;
  passkeyCount: number;
  dismissedAt: number | null;
  now: number;
}) {
  if (!opts.supported || opts.passkeyCount > 0) return false;
  return opts.dismissedAt === null || opts.now - opts.dismissedAt >= NUDGE_SNOOZE_MS;
}

/** A first name for a new passkey, from the device it is made on; the owner can rename it. */
export function defaultPasskeyName(userAgent: string) {
  if (/iPhone/.test(userAgent)) return 'iPhone';
  if (/iPad/.test(userAgent)) return 'iPad';
  if (/Android/.test(userAgent)) return 'Android phone';
  if (/Macintosh|Mac OS X/.test(userAgent)) return 'Mac';
  if (/Windows/.test(userAgent)) return 'Windows PC';
  return 'This device';
}
