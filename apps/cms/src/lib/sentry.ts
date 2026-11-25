// Settings both Sentry SDKs share: the browser one (router.tsx) and the
// Worker one (server.ts). No Sentry import here, so neither side pulls in the
// other's SDK.
import { maskEmails } from '@ll/content';

/**
 * Masks email addresses anywhere in an event (messages, exception values,
 * breadcrumbs, tags, URLs) before it leaves for Sentry's US region, as the
 * logs sent to Better Stack are (lib/redact-console.ts). Sentry still groups
 * and links errors, since the stack traces are untouched.
 */
export function scrubEmails<T>(event: T): T {
  try {
    return JSON.parse(maskEmails(JSON.stringify(event))) as T;
  } catch {
    return event;
  }
}

const SECRET_KEY = /x[-_]internal[-_]key/i;
const FILTERED = '[Filtered]';

/**
 * Replaces the website's shared key wherever it shows up by name: a request header, or a span
 * attribute such as `http.request.header.x_internal_key`. Its value is a credential, so it must
 * not reach Sentry (traces are sampled at 1.0). Values are replaced whole, whatever their shape.
 */
function filterSecretKey(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(filterSecretKey);
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([k, v]) => [k, SECRET_KEY.test(k) ? FILTERED : filterSecretKey(v)])
    );
  }
  return node;
}

/** What is sent to Sentry: emails masked and the internal key filtered. */
export function scrubEvent<T>(event: T): T {
  try {
    return scrubEmails(filterSecretKey(event) as T);
  } catch {
    return event;
  }
}

// Public by design: the browser bundle carries it too. It lets someone send
// events to the project, not read them.
const DSN =
  'https://280438d33e22448502e812c90ebfaf18@o4512395918311424.ingest.us.sentry.io/4512395952455680';

export const sentryOptions = {
  dsn: DSN,
  // Production only: set in vite.config.ts.
  enabled: import.meta.env.PROD && import.meta.env.VITE_SENTRY_ENVIRONMENT === 'production',
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
  release: import.meta.env.VITE_APP_COMMIT,
  // The CMS is small enough to trace everything.
  tracesSampleRate: 1.0,
  // Editors type names, emails and unpublished content into the CMS. Keep
  // request bodies and cookies (the session) out of Sentry.
  dataCollection: { httpBodies: [], cookies: false },
  // A tab still running the CMS from before a deploy calls server functions
  // that no longer exist. It is offered a reload (components/shell/updates.tsx), so this is
  // expected after every deploy, not a bug.
  ignoreErrors: [/Server function info not found/],
  beforeSend: scrubEvent,
  // Spans carry URLs and attributes, so they are masked too. Not `beforeSendTransaction`: with
  // span streaming, the SDK's default, that is ignored (and logs a warning on every request).
  beforeSendSpan: scrubEvent,
};
