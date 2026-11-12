// Masks email addresses in everything the CMS logs (console.log, warn, error
// and the rest), before Cloudflare sends its logs on to Better Stack in the US.
// Imported first by the Worker entry (src/server.ts), so it covers every
// request and cron run. Errors are logged as masked copies; the originals,
// which Sentry reports, are left as they are.
import { maskEmails } from '@ll/content';

function masked(value: unknown): unknown {
  if (typeof value === 'string') return maskEmails(value);
  if (value instanceof Error) {
    const copy = new Error(maskEmails(value.message));
    copy.name = value.name;
    if (value.stack) copy.stack = maskEmails(value.stack);
    return copy;
  }
  if (value && typeof value === 'object') {
    try {
      return JSON.parse(maskEmails(JSON.stringify(value)));
    } catch {
      return value;
    }
  }
  return value;
}

const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;
const marker = Symbol.for('ll.redact-console');
const patched = globalThis as { [marker]?: boolean };

if (!patched[marker]) {
  patched[marker] = true;
  // Wrapping console is the point of this file, so the no-console rule does not apply.
  /* eslint-disable no-console */
  for (const method of methods) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => original(...args.map(masked));
  }
}
/* eslint-enable no-console */
