import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { activityActions, apiKeyScopes, entityTypes } from '../enums';
import { user } from './auth';
import { id, timestamps } from './columns';

export { activityActions, apiKeyScopes, entityTypes };
export type { ActivityAction, ApiKeyScope, EntityType } from '../enums';

// Single row (id = 'site'); the JSON shape is validated by @ll/content.
export const siteSettings = sqliteTable('site_settings', {
  id: text('id').primaryKey(),
  data: text('data', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const redirects = sqliteTable('redirects', {
  id: id(),
  fromPath: text('from_path').notNull().unique(),
  toPath: text('to_path').notNull(),
  // A trailing * on from_path matches everything under it; a * in to_path
  // receives the matched rest. 410 means "gone", and to_path is then empty.
  statusCode: integer('status_code', { mode: 'number' })
    .$type<301 | 302 | 307 | 308 | 410>()
    .notNull()
    .default(301),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  // Carry the request's query string (e.g. UTM tags) over to the destination.
  keepQuery: integer('keep_query', { mode: 'boolean' }).notNull().default(true),
  hits: integer('hits').notNull().default(0),
  lastHitAt: integer('last_hit_at', { mode: 'timestamp_ms' }),
  note: text('note'),
  ...timestamps(),
});

// Clicks per redirect per day (UTC), for the CMS's trend chart. Written by the website next to
// the running total on `redirects`; rows go with their redirect.
export const redirectDailyHits = sqliteTable(
  'redirect_daily_hits',
  {
    redirectId: text('redirect_id')
      .notNull()
      .references(() => redirects.id, { onDelete: 'cascade' }),
    /** The UTC calendar day, YYYY-MM-DD. */
    day: text('day').notNull(),
    hits: integer('hits').notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.redirectId, t.day] })]
);

// Paths the website answered "not found", counted so someone can redirect
// the ones people still follow. Written by the website, read in the CMS
// (Missing pages); paths unseen for 90 days are cleared by the daily job.
export const notFoundPaths = sqliteTable(
  'not_found_paths',
  {
    /** Normalised as redirects match paths: lowercase, no trailing slash. */
    path: text('path').primaryKey(),
    hits: integer('hits').notNull().default(1),
    firstSeenAt: integer('first_seen_at', { mode: 'timestamp_ms' }).notNull(),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }).notNull(),
    /** Set when someone decides it needs no redirect; it stays hidden. */
    dismissedAt: integer('dismissed_at', { mode: 'timestamp_ms' }),
  },
  (t) => [index('not_found_paths_last_seen').on(t.lastSeenAt)]
);

export const revisions = sqliteTable(
  'revisions',
  {
    id: id(),
    entityType: text('entity_type', { enum: entityTypes }).notNull(),
    entityId: text('entity_id').notNull(),
    snapshot: text('snapshot', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('revisions_entity').on(t.entityType, t.entityId, t.createdAt)]
);

// Feed for the public site's cache purging. The CMS only ever appends.
export const publishEvents = sqliteTable(
  'publish_events',
  {
    id: id(),
    entityType: text('entity_type', { enum: entityTypes }).notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action', {
      enum: ['publish', 'unpublish', 'trash', 'restore', 'delete', 'update'],
    }).notNull(),
    paths: text('paths', { mode: 'json' }).$type<string[]>().notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('publish_events_created_at').on(t.createdAt)]
);

// Human-readable audit trail, distinct from publish_events (which is a cache
// purge feed). The actor's name is a snapshot, so the entry still reads
// correctly after that person is removed.
export const activityLog = sqliteTable(
  'activity_log',
  {
    id: id(),
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    actorName: text('actor_name').notNull(),
    action: text('action', { enum: activityActions }).notNull(),
    summary: text('summary').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('activity_log_created_at').on(t.createdAt)]
);

// One row per job per run of the CMS's cron triggers (apps/cms/src/server.ts),
// for the System page. The daily job clears rows older than 14 days.
export const cronRuns = sqliteTable(
  'cron_runs',
  {
    id: id(),
    /** A key from the CMS's job list (apps/cms/src/lib/cron-jobs.ts). */
    job: text('job').notNull(),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    durationMs: integer('duration_ms').notNull(),
    /** Why it failed, cut short; null when it ran without a problem. */
    error: text('error'),
  },
  (t) => [
    index('cron_runs_job_started').on(t.job, t.startedAt),
    index('cron_runs_started').on(t.startedAt),
  ]
);

// Keys for the CMS API (/api/v1). Only a SHA-256 hash of each key is stored;
// the key itself is shown once, when it is created. A key acts as the admin
// who created it, so it stops working if that person is removed or loses the
// right to change content.
export const apiKeys = sqliteTable(
  'api_keys',
  {
    id: id(),
    name: text('name').notNull(),
    /** The first characters of the key, shown so people can tell keys apart. */
    prefix: text('prefix').notNull(),
    keyHash: text('key_hash').notNull().unique(),
    scope: text('scope', { enum: apiKeyScopes }).notNull(),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('api_keys_created_at').on(t.createdAt)]
);

/**
 * One counter for the website's page cache: database triggers (migration
 * 0033) add one whenever anything the website shows changes, so a cached page
 * built at an older version is never served again. Single row, id 1.
 */
export const contentVersion = sqliteTable('content_version', {
  id: integer('id').primaryKey(),
  version: integer('version').notNull().default(0),
});

// The last good answer to each website-analytics query, so the dashboard does not wait on
// PostHog. A job refreshes them every few minutes (apps/cms/src/server/analytics-cache.ts).
export const analyticsCache = sqliteTable('analytics_cache', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  fetchedAt: integer('fetched_at').notNull(),
});

// How many writing suggestions each person has asked for on a day, so one person (or a stuck
// button) cannot run up the bill. One row per person per day; old days are tidied as it is used.
export const aiUsage = sqliteTable(
  'ai_usage',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** The calendar day in the site's time zone, YYYY-MM-DD. */
    day: text('day').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })]
);
