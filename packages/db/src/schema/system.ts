import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
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
    .$type<301 | 302 | 410>()
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
