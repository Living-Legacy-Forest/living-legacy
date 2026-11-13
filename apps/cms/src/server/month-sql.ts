import { type SQL, sql } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

/** A timestamp column as the month it falls in, "2026-11", once the zone's offset is added. */
export const monthOf = (at: SQLiteColumn, offsetMs: number): SQL<string> =>
  sql<string>`strftime('%Y-%m', (${at} + ${offsetMs}) / 1000, 'unixepoch')`;
