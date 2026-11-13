// Keeps PostHog's answers in D1 so the dashboard never waits for one. PostHog can take many
// seconds over months of pageviews, and a Worker's own memory is lost on every cold start, so a
// job refreshes the answers on a schedule (refreshAnalytics) and a page only reads them.

const MINUTE_MS = 60_000;
/** An answer this young is used as it is. */
export const FRESH_MS = 15 * MINUTE_MS;
/** The job refreshes answers older than this, so each lands just inside FRESH_MS. */
export const REFRESH_AFTER_MS = 12 * MINUTE_MS;
/**
 * An older answer still shows instantly (the job should have renewed it by now). Past this the
 * job has plainly stopped, or the answer is new to it, so a page asks PostHog itself.
 */
const USABLE_MS = 60 * MINUTE_MS;

type Row = { value: string; fetched_at: number };

async function read(d1: D1Database, key: string) {
  const row = await d1
    .prepare('SELECT value, fetched_at FROM analytics_cache WHERE key = ?')
    .bind(key)
    .first<Row>();
  return row ? { value: row.value, at: row.fetched_at } : null;
}

async function write(d1: D1Database, key: string, value: unknown, now: number) {
  await d1
    .prepare(
      `INSERT INTO analytics_cache (key, value, fetched_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, fetched_at = excluded.fetched_at`
    )
    .bind(key, JSON.stringify(value), now)
    .run();
}

/**
 * The answer for `key`: stored if recent enough, else fetched and stored. If fetching fails an
 * older stored answer is better than none, so it is used; with none, the error is thrown.
 */
export async function readThrough<T>(
  d1: D1Database,
  key: string,
  fetcher: () => Promise<T>,
  now = Date.now()
): Promise<T> {
  const stored = await read(d1, key);
  if (stored && now - stored.at < USABLE_MS) return JSON.parse(stored.value) as T;
  try {
    const value = await fetcher();
    await write(d1, key, value, now);
    return value;
  } catch (error) {
    if (stored) return JSON.parse(stored.value) as T;
    throw error;
  }
}

/** Renews `key` unless it is still young. Returns whether PostHog was asked. */
export async function refresh<T>(
  d1: D1Database,
  key: string,
  fetcher: () => Promise<T>,
  now = Date.now()
): Promise<boolean> {
  const stored = await read(d1, key);
  if (stored && now - stored.at < REFRESH_AFTER_MS) return false;
  await write(d1, key, await fetcher(), now);
  return true;
}

/** Clears answers nobody has renewed for two days, such as those for dates now past. */
export async function pruneAnalyticsCache(d1: D1Database, now = Date.now()) {
  await d1
    .prepare('DELETE FROM analytics_cache WHERE fetched_at < ?')
    .bind(now - 2 * 24 * 60 * MINUTE_MS)
    .run();
}
