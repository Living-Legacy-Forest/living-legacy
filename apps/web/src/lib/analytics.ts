/**
 * Analytics events, in the shape the national measurement plan sets out: one
 * GA4 property for the whole site, with locations told apart by event
 * parameters rather than separate properties.
 *
 * Every event goes onto the dataLayer for Google Tag Manager, and to gtag.js
 * as well when that is loaded directly. Never pass names, email addresses or
 * phone numbers: GA4 must not receive personal information.
 *
 * Note GA4 reserves `page_location` (the full URL), so the location a page is
 * about travels as `location_slug` instead.
 */

/** What kind of page this is, for the `page_type` parameter. */
export type PageType = 'national' | 'location' | 'blog';

export interface PageContext {
  page_type: PageType;
  /** Set on a location's own pages, e.g. `logan`. */
  location_slug?: string;
}

/** Which form was sent, for the `form_type` parameter. */
export type FormType = 'contact' | 'partner' | 'interest' | 'tour' | 'brochure';

type EventParams = Record<string, string | number | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    /** Set by gtm.js once Tag Manager has loaded. */
    google_tag_manager?: unknown;
  }
}

/**
 * The page context for a path. Location pages will live at
 * /locations/{slug}/; /locations/upcoming/ is the national register-interest
 * page, not a location.
 */
export function pageContextFor(pathname: string): PageContext {
  if (pathname === '/blog' || pathname.startsWith('/blog/')) return { page_type: 'blog' };
  const match = /^\/locations\/([a-z0-9-]+)\/?$/.exec(pathname);
  if (match && match[1] !== 'upcoming') return { page_type: 'location', location_slug: match[1] };
  return { page_type: 'national' };
}

/**
 * Sends an event. Resolves once the tags have taken it, or after a second at
 * most, so a page can wait before navigating away without ever getting stuck
 * when the tags are blocked or not loaded.
 */
export function track(event: string, params: EventParams = {}): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 1000);
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    const dataLayer = (window.dataLayer ??= []);

    if (window.gtag) {
      // gtag.js sends to GA4 itself. GTM, if loaded too, still sees the event;
      // a GTM tag forwarding it to the same GA4 property would count it twice.
      window.gtag('event', event, { ...clean, event_callback: finish });
      dataLayer.push({ event, ...clean });
    } else if (window.google_tag_manager) {
      // GTM calls eventCallback once the tags listening for this event have fired.
      dataLayer.push({ event, ...clean, eventCallback: finish, eventTimeout: 1000 });
    } else {
      // No tags on this host (local dev, previews): nothing to wait for.
      dataLayer.push({ event, ...clean });
      finish();
    }
  });
}

/** A successful enquiry, sent only after the form service accepted it. */
export function trackLead(formType: FormType): Promise<void> {
  return track('generate_lead', { form_type: formType, ...pageContextFor(location.pathname) });
}
