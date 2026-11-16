import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { requirePermission } from '@/lib/session';
import { readThrough } from './analytics-cache';

// The Uptime page reads Better Stack's Uptime API with a read-only token kept as a Worker
// secret (BETTERSTACK_API_TOKEN). The answer is kept in D1 for a few minutes, so opening the page
// does not make a request per monitor each time.

const API = 'https://uptime.betterstack.com/api/v2';
const DAY_MS = 86_400_000;
const MAX_AGE_MS = 5 * 60_000;
const SPAN_DAYS = 30;
/** How far back the daily bars reach. */
export const BAR_DAYS = 90;

export type MonitorState = 'up' | 'down' | 'checking' | 'paused';

export type UptimeMonitor = {
  id: string;
  name: string;
  url: string;
  state: MonitorState;
  lastCheckedAt: number | null;
  /** Percent over the last 30 days; null when the API gave none. */
  availability: number | null;
  incidents: number;
  downtimeSeconds: number;
  /** Percent over the 30 days before those; null when the API gave none. */
  previousAvailability: number | null;
  /** Seconds down on each of the last 90 days (UTC), oldest first, worked out from incidents. */
  daily: number[];
  /** Percent up over those 90 days. */
  uptime90: number;
  /** Average response over the last 24 hours, in milliseconds. */
  responseMs: number | null;
};

export type UptimeIncident = {
  id: string;
  name: string;
  cause: string | null;
  startedAt: number;
  resolvedAt: number | null;
  url: string | null;
};

export type UptimeData =
  | { connected: false }
  | {
      connected: true;
      monitors: UptimeMonitor[];
      incidents: UptimeIncident[];
      /** How many incidents the 30 days before the listed ones held. */
      previousIncidents: number;
      fetchedAt: number;
    };

type Api<T> = { data: T; pagination?: { next?: string | null } };
type Resource<A> = { id: string; attributes: A };

async function get<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Better Stack answered ${response.status}`);
  return (await response.json()) as T;
}

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) : null);

function stateOf(status: string): MonitorState {
  if (status === 'up') return 'up';
  if (status === 'down') return 'down';
  if (status === 'paused') return 'paused';
  return 'checking';
}

async function load(token: string, now: number) {
  const list = await get<
    Api<
      Resource<{
        pronounceable_name: string;
        url: string;
        status: string;
        last_checked_at: string | null;
      }>[]
    >
  >(token, '/monitors?per_page=50');
  const from = day(now - SPAN_DAYS * DAY_MS);
  const to = day(now);
  const dayAgo = new Date(now - DAY_MS).toISOString();
  const nowIso = new Date(now).toISOString();

  // Incidents over the bars' whole span; the monitors' bars are worked out from them.
  type Incident = Resource<{
    name: string;
    cause: string | null;
    started_at: string;
    resolved_at: string | null;
    url?: string | null;
  }> & { relationships?: { monitor?: { data?: { id: string } | null } } };
  const barFrom = day(now - BAR_DAYS * DAY_MS);
  const found: Incident[] = [];
  for (let page = 1; page <= 6; page++) {
    const result = await get<Api<Incident[]> & { pagination?: { next?: string | null } }>(
      token,
      `/incidents?from=${barFrom}&to=${to}&per_page=50&page=${page}`
    ).catch(() => null);
    if (!result) break;
    found.push(...result.data);
    if (!result.pagination?.next) break;
  }
  const firstDay = Date.parse(`${barFrom}T00:00:00Z`);
  const downByMonitor = new Map<string, number[]>();
  for (const i of found) {
    const id = i.relationships?.monitor?.data?.id;
    if (!id) continue;
    const bars = downByMonitor.get(id) ?? new Array<number>(BAR_DAYS + 1).fill(0);
    const start = Date.parse(i.attributes.started_at);
    const end = i.attributes.resolved_at ? Date.parse(i.attributes.resolved_at) : now;
    // Each day takes the part of the incident that fell inside it.
    for (let d = Math.max(0, Math.floor((start - firstDay) / DAY_MS)); d <= BAR_DAYS; d++) {
      const dayStart = firstDay + d * DAY_MS;
      if (dayStart >= end) break;
      bars[d]! += Math.max(0, Math.min(end, dayStart + DAY_MS) - Math.max(start, dayStart)) / 1000;
    }
    downByMonitor.set(id, bars);
  }

  const monitors = await Promise.all(
    list.data.map(async (m): Promise<UptimeMonitor> => {
      const [sla, before, times] = await Promise.all([
        get<
          Api<{
            attributes: {
              availability: number;
              total_downtime: number;
              number_of_incidents: number;
            };
          }>
        >(token, `/monitors/${m.id}/sla?from=${from}&to=${to}`).catch(() => null),
        get<Api<{ attributes: { availability: number } }>>(
          token,
          `/monitors/${m.id}/sla?from=${day(now - 2 * SPAN_DAYS * DAY_MS)}&to=${from}`
        ).catch(() => null),
        get<
          Api<{
            attributes: { regions: { response_times: { response_time: number }[] }[] };
          }>
        >(
          token,
          `/monitors/${m.id}/response-times?from=${encodeURIComponent(dayAgo)}&to=${encodeURIComponent(nowIso)}`
        ).catch(() => null),
      ]);
      const points = (times?.data.attributes.regions ?? []).flatMap((r) =>
        r.response_times.map((p) => p.response_time)
      );
      const daily = (downByMonitor.get(m.id) ?? new Array<number>(BAR_DAYS + 1).fill(0))
        .slice(-BAR_DAYS)
        .map(Math.round);
      const down = daily.reduce((sum, n) => sum + n, 0);
      return {
        id: m.id,
        daily,
        uptime90: Math.max(0, 100 - (down / (BAR_DAYS * 86_400)) * 100),
        name: m.attributes.pronounceable_name,
        url: m.attributes.url,
        state: stateOf(m.attributes.status),
        lastCheckedAt: time(m.attributes.last_checked_at),
        availability: sla?.data.attributes.availability ?? null,
        previousAvailability: before?.data.attributes.availability ?? null,
        incidents: sla?.data.attributes.number_of_incidents ?? 0,
        downtimeSeconds: sla?.data.attributes.total_downtime ?? 0,
        // The API reports seconds.
        responseMs: points.length
          ? Math.round((points.reduce((sum, p) => sum + p, 0) / points.length) * 1000)
          : null,
      };
    })
  );

  // The page lists the last 30 days; the API returns newest first.
  const recent = Date.parse(`${from}T00:00:00Z`);
  const incidents: UptimeIncident[] = found
    .filter((i) => Date.parse(i.attributes.started_at) >= recent)
    .slice(0, 100)
    .map((i) => ({
      id: i.id,
      name: i.attributes.name,
      cause: i.attributes.cause,
      startedAt: Date.parse(i.attributes.started_at),
      resolvedAt: time(i.attributes.resolved_at),
      url: i.attributes.url ?? null,
    }));
  incidents.sort((a, b) => b.startedAt - a.startedAt);

  const before = Date.parse(`${day(now - 2 * SPAN_DAYS * DAY_MS)}T00:00:00Z`);
  const previousIncidents = found.filter((i) => {
    const at = Date.parse(i.attributes.started_at);
    return at >= before && at < recent;
  }).length;

  return { monitors, incidents, previousIncidents, fetchedAt: now };
}

/** The Uptime page: each monitor's state and 30-day availability, and recent incidents. */
export const getUptime = createServerFn({ method: 'GET' })
  .middleware([requirePermission('settings:write')])
  .handler(async (): Promise<UptimeData> => {
    const token = (env as unknown as { BETTERSTACK_API_TOKEN?: string }).BETTERSTACK_API_TOKEN;
    if (!token) return { connected: false };
    const now = Date.now();
    const data = await readThrough(env.DB, 'uptime4', () => load(token, now), now, MAX_AGE_MS);
    return { connected: true, ...data };
  });
