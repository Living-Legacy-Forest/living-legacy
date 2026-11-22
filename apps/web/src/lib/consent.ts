/**
 * The visitor's cookie choice in the browser. The rules (what the cookie holds, when it lapses)
 * are in @ll/content; this reads and writes it and tells the page when it changes.
 *
 * Pages are cached and shared, so nothing here can come from the server: the choice is read from
 * `document.cookie` after the page loads, and until it says yes, nothing optional runs.
 */
import {
  CONSENT_VERSION,
  allows,
  consentCookie,
  isTrackingName,
  parseConsent,
  trackingCookiesToClear,
  withdrawnCategories,
  type ConsentCategory,
  type ConsentChoice,
  type ConsentRecord,
} from '@ll/content/consent';
import { consentMonths } from '@/lib/tracking-client';

/** Sent on `window` when a choice is saved, with the new record as `detail`. */
export const CONSENT_EVENT = 'll:consent';

export function getConsent(): ConsentRecord | null {
  if (typeof document === 'undefined') return null;
  return parseConsent(document.cookie, Date.now(), consentMonths());
}

export function hasConsent(category: ConsentCategory): boolean {
  return allows(getConsent(), category);
}

/**
 * Deletes what these categories' tags stored: their cookies, and PostHog's copy of its id in
 * local storage. A cookie set for the whole domain (Google's `_ga`) only goes when deleted with
 * that domain, so each parent of this host is tried as well as the host itself.
 *
 * Run on every page load too, for the categories not allowed: PostHog writes its state again as
 * the page unloads, so what a withdrawal deleted can come back before the reload.
 */
export function clearTrackingData(categories: readonly ConsentCategory[]): void {
  const parts = location.hostname.split('.');
  const domains = [undefined, ...parts.slice(0, -1).map((_, i) => parts.slice(i).join('.'))];
  for (const name of trackingCookiesToClear(document.cookie, categories)) {
    for (const domain of domains) {
      document.cookie = `${name}=; Path=/; Max-Age=0${domain ? `; Domain=${domain}` : ''}`;
    }
  }
  for (const store of [localStorage, sessionStorage]) {
    for (const key of Object.keys(store)) {
      if (isTrackingName(key, categories)) store.removeItem(key);
    }
  }
}

/**
 * Saves a choice. If it takes back a yes, what that category stored is deleted and the page
 * reloads: a tag that has already loaded cannot be unloaded, so a clean page is the only way to
 * stop it.
 */
export function saveConsent(choice: ConsentChoice): void {
  const before = getConsent();
  const now = Date.now();
  document.cookie = consentCookie(choice, now, location.protocol === 'https:', consentMonths());

  const withdrawn = withdrawnCategories(before, choice);
  if (withdrawn.length > 0) {
    clearTrackingData(withdrawn);
    location.reload();
    return;
  }
  const record: ConsentRecord = { v: CONSENT_VERSION, ...choice, at: now };
  window.dispatchEvent(new CustomEvent<ConsentRecord>(CONSENT_EVENT, { detail: record }));
}

/** Runs `run` once, as soon as this category is allowed: now if it already is, otherwise later. */
export function whenAllowed(category: ConsentCategory, run: () => void): void {
  if (hasConsent(category)) {
    run();
    return;
  }
  const listener = (event: Event) => {
    if (!allows((event as CustomEvent<ConsentRecord>).detail, category)) return;
    window.removeEventListener(CONSENT_EVENT, listener);
    run();
  };
  window.addEventListener(CONSENT_EVENT, listener);
}
