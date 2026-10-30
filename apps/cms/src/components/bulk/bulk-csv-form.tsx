import { readCsvRecords } from '@llf/content';
import { useState } from 'react';
import { DownloadIcon, UploadIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { type BulkResult, type BulkSkip, downloadCsv } from '@/lib/bulk-import';
import { useAction } from '@/lib/use-action';

/** A row ready to send: the spreadsheet row number, the id when updating, and the fields. */
export type BulkRow<T> = T & { row: number; id?: string };

type Plan<T> = {
  rows: BulkRow<T>[];
  added: number;
  updated: number;
  unchanged: number;
  problems: BulkSkip[];
};

const plural = (n: number, [one, many]: [string, string]) => `${n} ${n === 1 ? one : many}`;

/**
 * Bulk add and update from a CSV: download a blank template or the current
 * entries, edit in a spreadsheet, upload. Rows with an id update that entry,
 * rows without one are added, and unchanged rows are left alone.
 */
export function BulkCsvForm<T>({
  noun,
  fileName,
  fields,
  example,
  current,
  toRow,
  apply,
  onDone,
  footer,
}: {
  /** Singular and plural, e.g. ['team member', 'team members']. */
  noun: [string, string];
  /** Download name without the extension, e.g. "team". */
  fileName: string;
  /** Column names after id, in template order, e.g. ['name', 'role']. */
  fields: string[];
  /** One sample row for the blank template. */
  example: Record<string, string>;
  /** Current entries as CSV values, including id. */
  current: Record<string, string>[];
  /** Turns a row's values into fields to save, or a message saying what is wrong. */
  toRow: (values: Record<string, string>) => T | string;
  apply: (rows: BulkRow<T>[]) => Promise<BulkResult>;
  onDone: () => void;
  footer: (submit: React.ReactNode) => React.ReactNode;
}) {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [skipped, setSkipped] = useState<BulkSkip[]>([]);
  const { run, pending } = useAction();

  const keys = ['id', ...fields];
  const parsed = file ? readCsvRecords(file.text, keys) : null;
  const missing = parsed ? fields.filter((key) => parsed.missing.includes(key)) : [];
  const plan = parsed && missing.length === 0 ? planRows(parsed.records) : null;

  function planRows(records: ReturnType<typeof readCsvRecords>['records']): Plan<T> {
    const byId = new Map(current.map((c) => [c.id, c]));
    const result: Plan<T> = { rows: [], added: 0, updated: 0, unchanged: 0, problems: [] };
    for (const { row, values } of records) {
      const existing = values.id ? byId.get(values.id) : undefined;
      if (values.id && !existing) {
        result.problems.push({ row, reason: `No ${noun[0]} has this id.` });
        continue;
      }
      if (existing && fields.every((key) => (existing[key] ?? '') === values[key])) {
        result.unchanged++;
        continue;
      }
      const fieldsOrError = toRow(values);
      if (typeof fieldsOrError === 'string') {
        result.problems.push({ row, reason: fieldsOrError });
        continue;
      }
      result.rows.push({ ...fieldsOrError, row, ...(values.id ? { id: values.id } : {}) });
      if (existing) result.updated++;
      else result.added++;
    }
    return result;
  }

  async function load(chosen: File | undefined) {
    if (!chosen) return;
    setFile({ name: chosen.name, text: await chosen.text() });
    setSkipped([]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan || plan.rows.length === 0) return;
    const result = await run(
      () => apply(plan.rows),
      ({ added, updated }) =>
        [added > 0 && `${plural(added, noun)} added`, updated > 0 && `${updated} updated`]
          .filter(Boolean)
          .join(', ')
          .replace(/^./, (c) => c.toUpperCase()) + '.'
    );
    if (!result) return;
    setFile(null);
    if (result.skipped.length === 0) return onDone();
    setSkipped(result.skipped);
  }

  const problems = [...(plan?.problems ?? []), ...skipped].sort((a, b) => a.row - b.row);
  const changes = plan?.rows.length ?? 0;

  return (
    <form noValidate onSubmit={submit} className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-sm font-medium">1. Download a template</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(`${fileName}-template.csv`, [
                keys,
                keys.map((key) => (key === 'id' ? '' : (example[key] ?? ''))),
              ])
            }
          >
            <DownloadIcon aria-hidden data-icon="inline-start" />
            Blank template
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={current.length === 0}
            onClick={() =>
              downloadCsv(`${fileName}.csv`, [
                keys,
                ...current.map((c) => keys.map((key) => c[key] ?? '')),
              ])
            }
          >
            <DownloadIcon aria-hidden data-icon="inline-start" />
            Current {noun[1]} ({current.length})
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Keep a row&apos;s id to update that {noun[0]}. Rows with an empty id are added as new.
          Deleting a row in the file does not delete anything here.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">2. Upload the filled-in file</h3>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" render={<label />} nativeButton={false}>
            <UploadIcon aria-hidden data-icon="inline-start" />
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                void load(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </Button>
          {file && <span className="text-muted-foreground truncate text-xs">{file.name}</span>}
        </div>
        {missing.length > 0 && (
          <p className="text-destructive text-xs">
            The file has no {missing.join(', ')} column. Start from one of the templates above.
          </p>
        )}
        {plan && (
          <p className="text-sm">
            {[
              plan.added > 0 && `${plan.added} to add`,
              plan.updated > 0 && `${plan.updated} to update`,
              plan.unchanged > 0 && `${plan.unchanged} unchanged`,
              plan.problems.length > 0 && plural(plan.problems.length, ['problem', 'problems']),
            ]
              .filter(Boolean)
              .join(', ') || 'No rows found.'}
          </p>
        )}
      </section>

      {problems.length > 0 && (
        <ul className="divide-y rounded-lg border text-xs">
          {problems.map((p) => (
            <li key={`${p.row}-${p.reason}`} className="flex gap-3 px-3 py-2">
              <span className="text-muted-foreground shrink-0 tabular-nums">Row {p.row}</span>
              <span className="text-destructive min-w-0 flex-1">{p.reason}</span>
            </li>
          ))}
        </ul>
      )}

      {footer(
        <Button type="submit" disabled={pending || changes === 0}>
          {pending ? (
            <>
              <Spinner />
              Saving…
            </>
          ) : changes > 0 ? (
            `Apply ${plural(changes, ['change', 'changes'])}`
          ) : (
            'Apply changes'
          )}
        </Button>
      )}
    </form>
  );
}
