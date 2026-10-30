// Minimal RFC 4180 CSV: quoted cells may hold commas, quotes ("") and line
// breaks. Enough for spreadsheet exports from Excel, Numbers and Google Sheets.

/** Splits CSV text into rows of cells. Empty rows are kept so row numbers match the sheet. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quoted) {
      if (char !== '"') cell += char;
      else if (source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
    } else if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Joins rows into CSV, quoting only the cells that need it. */
export function toCsv(rows: string[][]): string {
  const quote = (cell: string) =>
    /[",\r\n]|^\s|\s$/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
  return rows.map((row) => row.map(quote).join(',')).join('\r\n') + '\r\n';
}

export type CsvRecord = {
  /** The row's number in the spreadsheet, counting the header as row 1. */
  row: number;
  values: Record<string, string>;
};

/**
 * Reads a CSV whose first row names the columns. Headers are matched to `keys`
 * ignoring case and spaces; unknown columns are ignored and blank rows skipped.
 */
export function readCsvRecords(
  text: string,
  keys: readonly string[]
): { records: CsvRecord[]; missing: string[] } {
  const [header = [], ...body] = parseCsv(text);
  const simplify = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
  const index = new Map(header.map((name, i) => [simplify(name), i]));
  const columns = keys.map((key) => [key, index.get(simplify(key))] as const);

  const records = body.flatMap((cells, i) => {
    if (cells.every((cell) => cell.trim() === '')) return [];
    const values = Object.fromEntries(
      columns.map(([key, at]) => [
        key,
        // Excel writes line breaks inside cells as \r\n; store plain \n like the CMS does.
        at === undefined ? '' : (cells[at] ?? '').replace(/\r\n?/g, '\n').trim(),
      ])
    );
    return [{ row: i + 2, values }];
  });
  return { records, missing: columns.filter(([, at]) => at === undefined).map(([key]) => key) };
}
