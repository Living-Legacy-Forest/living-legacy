import { integer, text } from 'drizzle-orm/sqlite-core';
import { ulid } from 'ulid';
import { user } from './auth';

export const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => ulid());

export const timestamps = () => ({
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Shared draft/publish/trash fields (spec section 5). Typed columns hold the
// live version; pending edits to a published item live in `draft`.
export const lifecycle = () => ({
  status: text('status', { enum: ['draft', 'published'] })
    .notNull()
    .default('draft'),
  draft: text('draft', { mode: 'json' }).$type<Record<string, unknown>>(),
  publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
  updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
  ...timestamps(),
});

// Tiptap JSON document.
export const richText = (name: string) =>
  text(name, { mode: 'json' }).$type<Record<string, unknown>>();
