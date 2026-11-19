import { createLink, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { ArrowDownIcon } from '@/components/icons';
import { PaginationLink } from '@/components/ui/pagination';
import { Pager } from '@/components/pager';
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
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  type PageSize,
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
  page,
  rows: pageSize,
  onRangeChange,
}: {
  result: AnalyticsResult<PageRow[]>;
  /** Which page of the table, from 1. */
  page: number;
  /** How many rows a page. */
  rows: PageSize;
  onRangeChange: (days: AnalyticsRange) => void;
}) {
  return (
    <AnalyticsPage
      kind="pages"
      title="Pages"
      description="Which pages people read, where their visits start and end, and how long they stay on each."
      result={result}
      onRangeChange={onRangeChange}
      isEmpty={(rows) => rows.length === 0}
    >
      {(rows) => <PagesTable rows={rows} page={page} pageSize={pageSize} />}
    </AnalyticsPage>
  );
}

function PagesTable({
  rows,
  page: asked,
  pageSize,
}: {
  rows: PageRow[];
  page: number;
  pageSize: PageSize;
}) {
  const navigate = useNavigate({ from: '/analytics/pages' });
  const [sort, setSortKey] = useState<SortKey>('views');
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  // An address from a longer list (or a bigger page) lands on the last page there is.
  const page = Math.min(asked, pageCount);
  const sorted = [...rows]
    .sort((a, b) => sortValue(b, sort) - sortValue(a, sort))
    .slice((page - 1) * pageSize, page * pageSize);
  // A new order starts again from the top.
  const setSort = (key: SortKey) => {
    setSortKey(key);
    if (page > 1) void navigate({ search: (s) => ({ ...s, page: undefined }) });
  };

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

      <PagesPager total={rows.length} page={page} pageCount={pageCount} pageSize={pageSize} />
    </>
  );
}

// Page links that navigate inside the app, keeping the period and the rows chosen.
const PageItem = createLink(PaginationLink);
const EXACT = { exact: true } as const;

type PagesSearch = { days?: number; page?: number; rows?: number };
const toPage = (n: number) => (prev: PagesSearch) => ({ ...prev, page: n > 1 ? n : undefined });

/** Where in the list this is, how many rows a page, and the way to the others. */
function PagesPager({
  total,
  page,
  pageCount,
  pageSize,
}: {
  total: number;
  page: number;
  pageCount: number;
  pageSize: PageSize;
}) {
  const navigate = useNavigate({ from: '/analytics/pages' });

  return (
    <Pager
      page={page}
      pageCount={pageCount}
      total={total}
      pageSize={pageSize}
      noun="pages"
      label="Pages of the table"
      rows={{
        options: PAGE_SIZES,
        // A new page size starts again from the first page.
        onChange: (rows) =>
          void navigate({
            search: (s) => ({
              ...s,
              rows: rows === DEFAULT_PAGE_SIZE ? undefined : rows,
              page: undefined,
            }),
          }),
      }}
      renderItem={({ page: n, props, content }) => (
        <PageItem to="/analytics/pages" activeOptions={EXACT} search={toPage(n)} {...props}>
          {content}
        </PageItem>
      )}
    />
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
