import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth';
import { id, timestamps } from './columns';

export const entityTypes = ['post', 'faq', 'testimonial', 'team_member', 'settings'] as const;
export type EntityType = (typeof entityTypes)[number];

// Single row (id = 'site'); the JSON shape is validated by @llf/content.
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
