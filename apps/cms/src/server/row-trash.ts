/**
 * The trash for redirects, announcements, categories and tags. Their tables have no `deleted_at`,
 * and giving them one would touch every query on them (a trashed redirect would also keep its
 * unique `from_path`), so deleting moves the whole row into `trashed_rows` instead and the delete
 * toast's Undo puts it back, by id, with the same id, timestamps and counts. The daily job clears
 * entries after 30 days (`purgeTrashedContent`). A category or tag also keeps the posts it was on.
 * Kept out of the server functions so the integration tests run it against local D1.
 */
import type { Db } from '@ll/db';
import { announcements, postTerms, posts, redirects, terms, trashedRows } from '@ll/db/schema';
import { type SQL, and, eq, getTableColumns, inArray } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { chunk } from '@/lib/chunk';

const tables = { redirects, announcements, terms } as const;

export type RowTrashArea = keyof typeof tables;

type Row = Record<string, unknown> & { id: string };
type Payload = { row: Row; postIds?: string[] };

// A query takes about 100 bound values: ids go 50 at a time, and a link has two values.
const IDS = 50;
const LINKS = 40;

/** Rows of `area` as the database holds them, by id. */
const selectRows = async (db: Db, area: RowTrashArea, ids: string[], also?: SQL) => {
  const table = tables[area];
  const found: Row[] = [];
  for (const part of chunk(ids, IDS)) {
    found.push(
      ...((await db
        .select()
        .from(table as SQLiteTable)
        .where(and(inArray(table.id, part), also))) as Row[])
    );
  }
  return found;
};

/**
 * Moves rows into the trash, whole. `also` narrows which rows count (a category list must not
 * delete a tag that shares an id). Resolves to the rows that went.
 */
export async function trashWholeRows(
  db: Db,
  area: RowTrashArea,
  { ids, userId, also, now = new Date() }: { ids: string[]; userId: string; also?: SQL; now?: Date }
): Promise<Row[]> {
  const rows = await selectRows(db, area, ids, also);
  if (rows.length === 0) return rows;
  const found = rows.map((row) => row.id);

  const links =
    area === 'terms'
      ? (
          await Promise.all(
            chunk(found, IDS).map((part) =>
              db.select().from(postTerms).where(inArray(postTerms.termId, part))
            )
          )
        ).flat()
      : [];
  const entries = rows.map((row) => ({
    area,
    rowId: row.id,
    payload: {
      row,
      ...(area === 'terms'
        ? { postIds: links.filter((l) => l.termId === row.id).map((l) => l.postId) }
        : {}),
    } satisfies Payload as Record<string, unknown>,
    deletedBy: userId,
    deletedAt: now,
  }));

  await db.batch([
    // Deleted, put back by hand, deleted again: the newer copy replaces the older.
    ...chunk(found, IDS).map((part) =>
      db
        .delete(trashedRows)
        .where(and(eq(trashedRows.area, area), inArray(trashedRows.rowId, part)))
    ),
    ...chunk(entries, 8).map((part) => db.insert(trashedRows).values(part)),
    ...chunk(found, IDS).map((part) =>
      db.delete(tables[area]).where(inArray(tables[area].id, part))
    ),
  ] as unknown as [never]);
  return rows;
}

/** The row's saved values, with its date columns turned back from JSON text into dates. */
function revive(area: RowTrashArea, row: Row): Row {
  const revived: Row = { ...row };
  for (const [name, column] of Object.entries(getTableColumns(tables[area]))) {
    const value = revived[name];
    if (column.dataType === 'date' && typeof value === 'string') revived[name] = new Date(value);
  }
  return revived;
}

const isTaken = (error: unknown) => {
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    if (/UNIQUE constraint failed/i.test(String((e as { message?: unknown }).message))) return true;
  }
  return false;
};

/**
 * Puts rows back as they were. A row whose address or slug has been taken since (a new redirect
 * from the same path) is left in the trash and counted in `skipped`.
 */
export async function restoreWholeRows(
  db: Db,
  area: RowTrashArea,
  { ids }: { ids: string[] }
): Promise<{ restored: number; skipped: number }> {
  const table = tables[area];
  const entries = (
    await Promise.all(
      chunk(ids, IDS).map((part) =>
        db
          .select()
          .from(trashedRows)
          .where(and(eq(trashedRows.area, area), inArray(trashedRows.rowId, part)))
      )
    )
  ).flat();

  let restored = 0;
  let skipped = 0;
  for (const entry of entries) {
    const payload = entry.payload as Payload;
    // Posts deleted since no longer exist to be linked.
    const postIds: string[] = [];
    for (const part of chunk(payload.postIds ?? [], IDS)) {
      postIds.push(
        ...(await db.select({ id: posts.id }).from(posts).where(inArray(posts.id, part))).map(
          (p) => p.id
        )
      );
    }
    try {
      await db.batch([
        db.insert(table).values(revive(area, payload.row) as never),
        ...chunk(postIds, LINKS).map((part) =>
          db
            .insert(postTerms)
            .values(part.map((postId) => ({ postId, termId: entry.rowId })))
            .onConflictDoNothing()
        ),
        db.delete(trashedRows).where(eq(trashedRows.id, entry.id)),
      ] as unknown as [never]);
      restored++;
    } catch (error) {
      if (!isTaken(error)) throw error;
      skipped++;
    }
  }
  return { restored, skipped: skipped + (ids.length - entries.length) };
}
