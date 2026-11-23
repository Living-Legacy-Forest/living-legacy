import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Better Auth tables. Property names must match Better Auth's field names;
// column names are snake_case. Better Auth generates its own IDs here.

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  /** Describes the photo for screen readers; set on the profile or by an admin. */
  imageAlt: text('image_alt'),
  bio: text('bio'),
  /** A chosen drawn avatar (DiceBear seed), shown when there is no photo. */
  avatarSeed: text('avatar_seed'),
  /** The wide image across the top of this person's profile (/api/banner/...); null shows a gradient. */
  banner: text('banner'),
  /** This person's light or dark choice; null follows the site setting. */
  theme: text('theme', { enum: ['system', 'light', 'dark'] }),
  /** JSON: this person's own colour and sidebar grain (`parseAppearance`); null follows the site. */
  appearance: text('appearance'),
  role: text('role', { enum: ['admin', 'editor', 'author', 'seo', 'viewer'] })
    .notNull()
    .default('editor'),
  /** JSON array of permission names on top of the role; read through `parseExtraPermissions`, never directly. */
  extraPermissions: text('extra_permissions').notNull().default('[]'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
});

// Sign-in is invite-only: Better Auth refuses to create a user whose email is
// not here (or in BOOTSTRAP_ADMIN_EMAILS).
export const invitation = sqliteTable('invitation', {
  email: text('email').primaryKey(),
  role: text('role', { enum: ['admin', 'editor', 'author', 'seo', 'viewer'] }).notNull(),
  /** Same shape as `user.extraPermissions`; copied onto the user when they accept. */
  extraPermissions: text('extra_permissions').notNull().default('[]'),
  invitedBy: text('invited_by').references(() => user.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});
