import { useState } from 'react';
import { ArrowDownIcon } from '@/components/icons';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  type AnalyticsRange,
  formatPercent,
  formatSeconds,
  pageName,
  percentOf,
} from '@/lib/analytics';
import { formatInteger } from '@/lib/format';
import { siteUrl } from '@/lib/site';
import { cn } from '@/lib/utils';
import type { AnalyticsResult, PageRow } from '@/server/analytics';
import { AnalyticsPage } from './analytics-page';

type SortKey = 'views' | 'visitors' | 'entries' | 'bounce' | 'exits' | 'seconds';

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: 'views', label: 'Views', title: 'Times the page was opened' },
  { key: 'visitors', label: 'Visitors', title: 'Different people who opened it' },
  { key: 'entries', label: 'Entries', title: 'Visits that started on this page' },
  { key: 'bounce', label: 'Bounce', title: 'Visits that started here and went no further' },
  { key: 'exits', label: 'Exits', title: 'Visits that ended on this page' },
  { key: 'seconds', label: 'Time on page', title: 'Average time spent on the page' },
];

const bounce = (p: PageRow) => percentOf(p.bounces, p.entries);
const sortValue = (p: PageRow, key: SortKey) =>
  key === 'bounce' ? (bounce(p) ?? -1) : key === 'seconds' ? (p.seconds ?? -1) : p[key];

export function PagesPage({
  result,
  onRangeChange,
}: {
  result: AnalyticsResult<PageRow[]>;
  onRangeChange: (days: AnalyticsRange) => void;
}) {
  return (
    <AnalyticsPage
      title="Pages"
      description="Which pages people read, where their visits start and end, and how long they stay on each."
      result={result}
      onRangeChange={onRangeChange}
      isEmpty={(rows) => rows.length === 0}
    >
      {(rows) => <PagesTable rows={rows} />}
    </AnalyticsPage>
  );
}

function PagesTable({ rows }: { rows: PageRow[] }) {
  const [sort, setSort] = useState<SortKey>('views');
  const sorted = [...rows].sort((a, b) => sortValue(b, sort) - sortValue(a, sort));

  return (
    <>
      {/* Seven columns need the room: below lg, the list. */}
      <div className="overflow-hidden rounded-lg border max-lg:hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Page</TableHead>
              {COLUMNS.map((c) => (
                <TableHead
                  key={c.key}
                  className="text-right last:pr-4"
                  aria-sort={sort === c.key ? 'descending' : undefined}
                >
                  <button
                    type="button"
                    title={c.title}
                    onClick={() => setSort(c.key)}
                    className={cn(
                      'hover:text-foreground inline-flex items-center gap-1 whitespace-nowrap',
                      sort === c.key ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {sort === c.key && <ArrowDownIcon aria-hidden className="size-3" />}
                    {c.label}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((p) => (
              <TableRow key={p.path}>
                <TableCell className="max-w-80 pl-4">
                  <PageLink page={p} />
                  <span className="text-muted-foreground block truncate text-xs">{p.path}</span>
                </TableCell>
                <Num value={formatInteger(p.views)} />
                <Num value={formatInteger(p.visitors)} />
                <Num value={formatInteger(p.entries)} />
                <Num value={formatPercent(bounce(p))} />
                <Num value={formatInteger(p.exits)} />
                <Num value={formatSeconds(p.seconds)} className="pr-4" />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Phones and tablets: a row a page, its views on the right and the rest underneath. */}
      <ul className="divide-y overflow-hidden rounded-lg border max-md:divide-(--ios-separator) max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell) lg:hidden">
        {sorted.map((p) => (
          <li key={p.path} className="space-y-1 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <PageLink page={p} />
              <span className="shrink-0 text-sm tabular-nums">
                {formatInteger(p.views)} <span className="text-muted-foreground">views</span>
              </span>
            </div>
            <p className="text-muted-foreground text-xs tabular-nums">
              {formatInteger(p.visitors)} visitors · {formatInteger(p.entries)} entries ·{' '}
              {formatPercent(bounce(p))} bounce · {formatSeconds(p.seconds)} on page
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

function Num({ value, className }: { value: string; className?: string }) {
  return <TableCell className={cn('text-right tabular-nums', className)}>{value}</TableCell>;
}

function PageLink({ page }: { page: PageRow }) {
  return (
    <a
      href={siteUrl(page.path)}
      target="_blank"
      rel="noreferrer"
      title={page.path}
      className="text-ui block min-w-0 truncate text-blue-600 hover:underline dark:text-blue-400"
    >
      {pageName(page)}
    </a>
  );
}
