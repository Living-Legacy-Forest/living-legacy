import { createLink, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { ArrowDownIcon } from '@/components/icons';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { pageNumbers } from '@/lib/page-numbers';
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

      <Pager total={rows.length} page={page} pageCount={pageCount} pageSize={pageSize} />
    </>
  );
}

// Page links that navigate inside the app, keeping the period and the rows chosen.
const PageNumber = createLink(PaginationLink);
const PagePrevious = createLink(PaginationPrevious);
const PageNext = createLink(PaginationNext);
const EXACT = { exact: true } as const;
const endProps = {
  'aria-disabled': true,
  tabIndex: -1,
  className: 'pointer-events-none opacity-50',
} as const;
const SIZE_ITEMS = PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }));

type PagesSearch = { days?: number; page?: number; rows?: number };
const toPage = (n: number) => (prev: PagesSearch) => ({ ...prev, page: n > 1 ? n : undefined });

/** Where in the list this is, how many rows a page, and the way to the others. */
function Pager({
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
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="text-muted-foreground mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
      <div className="flex items-center gap-4">
        <span className="tabular-nums">
          {formatInteger(from)}–{formatInteger(to)} of {formatInteger(total)} pages
        </span>
        <label className="flex items-center gap-2">
          Rows
          <Select
            items={SIZE_ITEMS}
            value={String(pageSize)}
            // A new page size starts again from the first page.
            onValueChange={(value) => {
              const rows = Number(value);
              void navigate({
                search: (s) => ({
                  ...s,
                  rows: rows === DEFAULT_PAGE_SIZE ? undefined : rows,
                  page: undefined,
                }),
              });
            }}
          >
            <SelectTrigger size="sm" aria-label="Rows a page" className="w-18">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIZE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      {pageCount > 1 && (
        <Pagination aria-label="Pages of the table" className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              {page <= 1 ? (
                <PaginationPrevious {...endProps} />
              ) : (
                <PagePrevious
                  to="/analytics/pages"
                  activeOptions={EXACT}
                  search={toPage(page - 1)}
                  className="touch:min-h-11"
                />
              )}
            </PaginationItem>
            {pageNumbers(page, pageCount).map((n, i) => (
              <PaginationItem key={n ?? `gap-${i}`}>
                {n === null ? (
                  <PaginationEllipsis />
                ) : (
                  <PageNumber
                    to="/analytics/pages"
                    activeOptions={EXACT}
                    search={toPage(n)}
                    isActive={n === page}
                    aria-label={`Page ${n}`}
                    className="touch:size-11 tabular-nums"
                  >
                    {n}
                  </PageNumber>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              {page >= pageCount ? (
                <PaginationNext {...endProps} />
              ) : (
                <PageNext
                  to="/analytics/pages"
                  activeOptions={EXACT}
                  search={toPage(page + 1)}
                  className="touch:min-h-11"
                />
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
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
