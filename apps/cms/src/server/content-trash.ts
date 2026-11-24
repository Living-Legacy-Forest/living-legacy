/**
 * The trash for team members, FAQs, testimonials and media coverage. Deleting one sets
 * `deleted_at`: it leaves the CMS and the website at once (every query on these tables skips
 * trashed rows), and the toast's Undo clears it again. Nothing in the CMS lists the trash, so the
 * daily job deletes trashed rows for good after the same 30 days as the media trash. Redirects,
 * announcements, categories and tags have no such column; `row-trash.ts` keeps those. Kept out of
 * the server functions so the integration tests run it against local D1.
 */
import { mediaPurgeCutoff } from '@ll/content';
import { type Db, createDb } from '@ll/db';
import { faqs, mediaCoverage, teamMembers, testimonials, trashedRows } from '@ll/db/schema';
import { and, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { chunk } from '@/lib/chunk';

const tables = { team: teamMembers, faqs, testimonials, coverage: mediaCoverage } as const;

export type TrashArea = keyof typeof tables;

// D1 takes about 100 bound values a query, and every id is one.
const IDS = 50;

/** Moves rows to the trash. Rows already there keep the time they went. */
export async function trashRows(
  db: Db,
  area: TrashArea,
  { ids, userId, now = new Date() }: { ids: string[]; userId: string; now?: Date }
) {
  const table = tables[area];
  for (const part of chunk(ids, IDS)) {
    await db
      .update(table)
      .set({ deletedAt: now, updatedBy: userId })
      .where(and(inArray(table.id, part), isNull(table.deletedAt)));
  }
}

/** Brings rows back from the trash, as they were. */
export async function restoreRows(
  db: Db,
  area: TrashArea,
  { ids, userId }: { ids: string[]; userId: string }
) {
  const table = tables[area];
  for (const part of chunk(ids, IDS)) {
    await db
      .update(table)
      .set({ deletedAt: null, updatedBy: userId })
      .where(and(inArray(table.id, part), isNotNull(table.deletedAt)));
  }
}

/** The daily job: deletes for good whatever has been in either trash for 30 days. */
export async function purgeTrashedContent(d1: D1Database, now: Date) {
  const db = createDb(d1);
  const cutoff = mediaPurgeCutoff(now);
  const due = (deletedAt: SQLiteColumn) => and(isNotNull(deletedAt), lt(deletedAt, cutoff));
  await db.batch([
    db.delete(teamMembers).where(due(teamMembers.deletedAt)),
    db.delete(faqs).where(due(faqs.deletedAt)),
    db.delete(testimonials).where(due(testimonials.deletedAt)),
    db.delete(mediaCoverage).where(due(mediaCoverage.deletedAt)),
    db.delete(trashedRows).where(lt(trashedRows.deletedAt, cutoff)),
  ]);
}
