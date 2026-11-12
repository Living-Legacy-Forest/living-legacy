import { createDb } from '@ll/db';
import { env } from 'cloudflare:workers';
import { eventBookings } from '@ll/db/schema';
import { and, count, desc, isNotNull, isNull, min } from 'drizzle-orm';
import { formatBytes, formatInteger } from '@/lib/format';
import type { HealthStatus } from '@/lib/system-status';

// Green, yellow, red. A warning is worth knowing but not broken: slow, filling
// up, or switched off on purpose. Only problems reach the dashboard.
type Verdict = { status: HealthStatus; detail: string };
export type HealthCheck = Verdict & { key: string; title: string };

/** D1's limit per database on the Workers Paid plan. */
const DATABASE_LIMIT_BYTES = 10 * 1024 ** 3;
const DATABASE_WARN_SHARE = 0.8;
const DATABASE_PROBLEM_SHARE = 0.95;
const DATABASE_SLOW_MS = 1_000;
const STORAGE_SLOW_MS = 2_000;
const WEBSITE_URL = 'https://livinglegacy.com.au/';
const WEBSITE_SLOW_MS = 3_000;
const WEBSITE_TIMEOUT_MS = 5_000;
const HOUR_MS = 3_600_000;
/** The sync runs every 5 minutes: an hour is a dozen missed tries, six hours is broken. */
const BOOKING_LATE_MS = HOUR_MS;
const BOOKING_STUCK_MS = 6 * HOUR_MS;

type Failed = { error: string };
const failed = (probe: object): probe is Failed => 'error' in probe;
const plural = (n: number, one: string, many: string) =>
  `${formatInteger(n)} ${n === 1 ? one : many}`;

// The judges: readings in, a status and one line for admins out.

export function judgeDatabase(probe: { ms: number; bytes: number } | Failed): Verdict {
  if (failed(probe)) return { status: 'problem', detail: `Did not answer: ${probe.error}` };
  const share = probe.bytes / DATABASE_LIMIT_BYTES;
  const full = share >= DATABASE_WARN_SHARE;
  return {
    status:
      share >= DATABASE_PROBLEM_SHARE
        ? 'problem'
        : full || probe.ms > DATABASE_SLOW_MS
          ? 'warning'
          : 'ok',
    detail: `Answered in ${formatInteger(probe.ms)} ms. ${formatBytes(probe.bytes)} used of ${formatBytes(DATABASE_LIMIT_BYTES)}${full ? ', close to the limit' : ''}.`,
  };
}

export function judgeStorage(probe: { ms: number } | Failed): Verdict {
  if (failed(probe)) return { status: 'problem', detail: `Could not list files: ${probe.error}` };
  if (probe.ms > STORAGE_SLOW_MS) {
    return { status: 'warning', detail: `Answered, but slowly: ${formatInteger(probe.ms)} ms.` };
  }
  return { status: 'ok', detail: `Answered in ${formatInteger(probe.ms)} ms.` };
}

export function judgeWebsite(probe: { status: number; ms: number } | Failed): Verdict {
  if (failed(probe)) {
    return {
      status: 'problem',
      detail: `The home page did not load within ${WEBSITE_TIMEOUT_MS / 1000} seconds.`,
    };
  }
  if (probe.status !== 200) {
    return {
      status: 'problem',
      detail: `The home page answered ${probe.status} instead of loading.`,
    };
  }
  if (probe.ms > WEBSITE_SLOW_MS) {
    return {
      status: 'warning',
      detail: `The home page loaded, but slowly: ${formatInteger(probe.ms)} ms.`,
    };
  }
  return { status: 'ok', detail: `The home page loaded in ${formatInteger(probe.ms)} ms.` };
}

export function judgeHubspot(
  probe:
    | { connected: false }
    | { connected: true; waiting: number; oldestAt?: number | null; lastError?: string | null },
  now: number
): Verdict {
  if (!probe.connected) {
    return { status: 'warning', detail: 'Not connected. Bookings stay in the CMS until it is.' };
  }
  if (probe.waiting === 0) return { status: 'ok', detail: 'Every booking has been sent.' };
  const waited = probe.oldestAt ? now - probe.oldestAt : 0;
  if (waited <= BOOKING_LATE_MS) {
    return {
      status: 'ok',
      detail: `${plural(probe.waiting, 'booking', 'bookings')} waiting for the next send.`,
    };
  }
  const hours = Math.round(waited / HOUR_MS);
  return {
    status: waited > BOOKING_STUCK_MS ? 'problem' : 'warning',
    detail: `${plural(probe.waiting, 'booking', 'bookings')} not sent for ${plural(hours, 'hour', 'hours')}.${probe.lastError ? ` Last error: ${probe.lastError}` : ''}`,
  };
}

export function judgeEmail(probe: { hasKey: boolean; production: boolean }): Verdict {
  if (probe.hasKey) return { status: 'ok', detail: 'Sign-in links and invitations can be sent.' };
  return probe.production
    ? {
        status: 'problem',
        detail: 'No email key, so sign-in links and invitations cannot be sent.',
      }
    : {
        status: 'warning',
        detail: 'Not sending here: sign-in links are printed in the terminal.',
      };
}

// The probes: one reading each, never throwing.

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function timed<T>(work: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const started = Date.now();
  const value = await work();
  return { value, ms: Date.now() - started };
}

async function probeDatabase(d1: D1Database) {
  try {
    const { value, ms } = await timed(() => d1.prepare('select 1').run());
    return { ms, bytes: value.meta.size_after };
  } catch (error) {
    return { error: message(error) };
  }
}

async function probeStorage(bucket: R2Bucket) {
  try {
    const { ms } = await timed(() => bucket.list({ limit: 1 }));
    return { ms };
  } catch (error) {
    return { error: message(error) };
  }
}

async function probeWebsite(fetcher: typeof fetch) {
  try {
    const { value, ms } = await timed(() =>
      fetcher(WEBSITE_URL, { signal: AbortSignal.timeout(WEBSITE_TIMEOUT_MS) })
    );
    // Only the status matters; let the connection go.
    await value.body?.cancel();
    return { status: value.status, ms };
  } catch (error) {
    return { error: message(error) };
  }
}

async function probeHubspot(d1: D1Database, connected: boolean) {
  if (!connected) return { connected: false as const };
  const db = createDb(d1);
  // As the sync picks them: not sent yet, and with an address to send.
  const unsent = and(isNull(eventBookings.crmSyncedAt), isNotNull(eventBookings.email));
  const [[totals], [last]] = await db.batch([
    db
      .select({ waiting: count(), oldestAt: min(eventBookings.createdAt) })
      .from(eventBookings)
      .where(unsent),
    db
      .select({ error: eventBookings.crmError })
      .from(eventBookings)
      .where(and(unsent, isNotNull(eventBookings.crmError)))
      .orderBy(desc(eventBookings.createdAt))
      .limit(1),
  ]);
  return {
    connected: true as const,
    waiting: totals?.waiting ?? 0,
    oldestAt: totals?.oldestAt?.getTime() ?? null,
    lastError: last?.error ?? null,
  };
}

export interface HealthOptions {
  d1: D1Database;
  bucket: R2Bucket;
  hubspotConnected: boolean;
  hasEmailKey: boolean;
  production: boolean;
  now: number;
  /**
   * Also check the website and file storage. The System page does; the
   * dashboard does not, so opening it never waits on another service.
   */
  network: boolean;
  fetcher?: typeof fetch;
}

/** The checks against this deployment's own services and secrets. */
export function healthOptions(network: boolean): HealthOptions {
  return {
    d1: env.DB,
    bucket: env.MEDIA,
    hubspotConnected: Boolean(env.HUBSPOT_ACCESS_TOKEN),
    hasEmailKey: Boolean(env.RESEND_API_KEY),
    production: import.meta.env.VITE_SENTRY_ENVIRONMENT === 'production',
    now: Date.now(),
    network,
  };
}

/** The services the CMS depends on, checked side by side when asked. */
export async function runHealthChecks(options: HealthOptions): Promise<HealthCheck[]> {
  const { d1, bucket, network, now } = options;
  const [website, database, storage, hubspot] = await Promise.all([
    network ? probeWebsite(options.fetcher ?? fetch) : null,
    probeDatabase(d1),
    network ? probeStorage(bucket) : null,
    probeHubspot(d1, options.hubspotConnected).catch((error: unknown) => ({
      error: message(error),
    })),
  ]);

  const checks: HealthCheck[] = [];
  if (website) checks.push({ key: 'website', title: 'Website', ...judgeWebsite(website) });
  checks.push({ key: 'database', title: 'Database', ...judgeDatabase(database) });
  if (storage) checks.push({ key: 'storage', title: 'File storage', ...judgeStorage(storage) });
  checks.push({
    key: 'hubspot',
    title: 'HubSpot',
    ...(failed(hubspot)
      ? { status: 'problem' as const, detail: `Could not check: ${hubspot.error}` }
      : judgeHubspot(hubspot, now)),
  });
  checks.push({
    key: 'email',
    title: 'Email',
    ...judgeEmail({ hasKey: options.hasEmailKey, production: options.production }),
  });
  return checks;
}
