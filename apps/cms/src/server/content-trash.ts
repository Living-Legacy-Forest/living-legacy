/**
 * The trash for team members, FAQs and testimonials. Deleting one sets `deleted_at`: it leaves the
 * CMS and the website at once (every query on these tables skips trashed rows), and the toast's
 * Undo clears it again. Nothing in the CMS lists the trash, so the daily job deletes trashed rows
 * for good after the same 30 days as the media trash. Kept out of the server functions so the
 * integration tests run it against local D1.
 */
import { mediaPurgeCutoff } from '@ll/content';
import { type Db, createDb } from '@ll/db';
import { faqs, teamMembers, testimonials } from '@ll/db/schema';
import { and, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

const tables = { team: teamMembers, faqs, testimonials } as const;

export type TrashArea = keyof typeof tables;

/** Moves rows to the trash. Rows already there keep the time they went. */
export async function trashRows(
  db: Db,
  area: TrashArea,
  { ids, userId, now = new Date() }: { ids: string[]; userId: string; now?: Date }
) {
  const table = tables[area];
  await db
    .update(table)
    .set({ deletedAt: now, updatedBy: userId })
    .where(and(inArray(table.id, ids), isNull(table.deletedAt)));
}

/** Brings rows back from the trash, as they were. */
export async function restoreRows(
  db: Db,
  area: TrashArea,
  { ids, userId }: { ids: string[]; userId: string }
) {
  const table = tables[area];
  await db
    .update(table)
    .set({ deletedAt: null, updatedBy: userId })
    .where(and(inArray(table.id, ids), isNotNull(table.deletedAt)));
}

/** The daily job: deletes for good whatever has been in the trash for 30 days. */
export async function purgeTrashedContent(d1: D1Database, now: Date) {
  const db = createDb(d1);
  const cutoff = mediaPurgeCutoff(now);
  const due = (deletedAt: SQLiteColumn) => and(isNotNull(deletedAt), lt(deletedAt, cutoff));
  await db.batch([
    db.delete(teamMembers).where(due(teamMembers.deletedAt)),
    db.delete(faqs).where(due(faqs.deletedAt)),
    db.delete(testimonials).where(due(testimonials.deletedAt)),
  ]);
}
