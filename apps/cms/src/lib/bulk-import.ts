import { toCsv } from '@llf/content';
import type { ZodError } from 'zod';

/** A CSV row the server did not apply, and why. `row` is the spreadsheet row number. */
export type BulkSkip = { row: number; reason: string };
export type BulkResult = { added: number; updated: number; skipped: BulkSkip[] };

/** The first problem in a failed validation, prefixed with its column. */
export function firstIssue(error: ZodError): string {
  const issue = error.issues[0]!;
  const column = issue.path[0];
  return column === undefined ? issue.message : `${String(column)}: ${issue.message}`;
}

/** Saves rows as a CSV file. The byte order mark makes Excel read it as UTF-8. */
export function downloadCsv(fileName: string, rows: string[][]) {
  const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** A status cell: blank or "draft" is draft, "published" is published, anything else is wrong. */
export function readStatus(value: string): 'draft' | 'published' | null {
  const v = value.trim().toLowerCase();
  if (v === '' || v === 'draft') return 'draft';
  return v === 'published' ? 'published' : null;
}

/** A yes/no cell: blank, no, false or 0 is no; yes, true or 1 is yes. */
export function readYesNo(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (['', 'no', 'false', '0'].includes(v)) return false;
  return ['yes', 'true', '1'].includes(v) ? true : null;
}
