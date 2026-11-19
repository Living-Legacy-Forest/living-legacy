import type { ComponentProps, ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatInteger } from '@/lib/format';
import { pageNumbers } from '@/lib/page-numbers';
import { cn } from '@/lib/utils';

/** What a page link needs to look right, whatever it navigates with. */
export type PagerLinkProps = Pick<
  ComponentProps<typeof PaginationLink>,
  'size' | 'isActive' | 'aria-label' | 'className'
>;

/** One of the links in the pager: Previous, Next or a page number. */
export type PagerItem = {
  /** The page it goes to, from 1. */
  page: number;
  props: PagerLinkProps;
  /** The icon and text, or the number. Render it as the link's children. */
  content: ReactNode;
};

/** Previous or Next at either end: shown, but not a link, so nothing marks it as the current page. */
const endProps = {
  'aria-disabled': true,
  tabIndex: -1,
} as const;

const toIcon = 'touch:min-h-11';

/**
 * The footer under every paged list: "1–50 of 1,850 visits", how many rows a
 * page, and Previous, the page numbers and Next. Every screen that pages uses
 * this, so they look and behave the same.
 *
 * Pages that keep the page in the address pass `renderItem` to render each link
 * with the router's `createLink(PaginationLink)`; the rest pass `onPageChange`.
 */
export function Pager({
  page,
  pageCount,
  total,
  pageSize,
  noun,
  label,
  rows,
  onPageChange,
  renderItem,
  className,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  /** What is being counted, plural: "visits", "entries". */
  noun: string;
  /** Names the page links for screen readers: "Visitor pages". */
  label: string;
  /** Leave out when the page size is fixed. */
  rows?: { options: readonly number[]; onChange: (rows: number) => void };
  onPageChange?: (page: number) => void;
  renderItem?: (item: PagerItem) => ReactNode;
  className?: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const link = (item: PagerItem) =>
    renderItem ? (
      renderItem(item)
    ) : (
      <PaginationLink
        {...item.props}
        href="#"
        onClick={(event) => {
          event.preventDefault();
          onPageChange?.(item.page);
        }}
      >
        {item.content}
      </PaginationLink>
    );
  const previous = (
    <>
      <ChevronLeftIcon data-icon="inline-start" className="cn-rtl-flip" />
      <span className="hidden sm:block">Previous</span>
    </>
  );
  const next = (
    <>
      <span className="hidden sm:block">Next</span>
      <ChevronRightIcon data-icon="inline-end" className="cn-rtl-flip" />
    </>
  );
  const sizeItems = rows?.options.map((n) => ({ value: String(n), label: String(n) })) ?? [];

  return (
    <div
      className={cn(
        'text-muted-foreground mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs',
        className
      )}
    >
      <div className="flex items-center gap-4">
        <span className="tabular-nums">
          {formatInteger(from)}–{formatInteger(to)} of {formatInteger(total)} {noun}
        </span>
        {rows && (
          <label className="flex items-center gap-2">
            Rows
            <Select
              items={sizeItems}
              value={String(pageSize)}
              onValueChange={(value) => rows.onChange(Number(value))}
            >
              <SelectTrigger size="sm" aria-label="Rows a page" className="w-18">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sizeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
      </div>
      {pageCount > 1 && (
        <Pagination aria-label={label} className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              {page <= 1 ? (
                <PaginationLink
                  {...endProps}
                  size="default"
                  aria-label="Go to previous page"
                  className="pointer-events-none pl-1.5! opacity-50"
                >
                  {previous}
                </PaginationLink>
              ) : (
                link({
                  page: page - 1,
                  props: {
                    size: 'default',
                    'aria-label': 'Go to previous page',
                    className: cn(toIcon, 'pl-1.5!'),
                  },
                  content: previous,
                })
              )}
            </PaginationItem>
            {pageNumbers(page, pageCount).map((n, i) => (
              <PaginationItem key={n ?? `gap-${i}`}>
                {n === null ? (
                  <PaginationEllipsis />
                ) : (
                  link({
                    page: n,
                    props: {
                      isActive: n === page,
                      'aria-label': `Page ${n}`,
                      className: 'touch:size-11 tabular-nums',
                    },
                    content: n,
                  })
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              {page >= pageCount ? (
                <PaginationLink
                  {...endProps}
                  size="default"
                  aria-label="Go to next page"
                  className="pointer-events-none pr-1.5! opacity-50"
                >
                  {next}
                </PaginationLink>
              ) : (
                link({
                  page: page + 1,
                  props: {
                    size: 'default',
                    'aria-label': 'Go to next page',
                    className: cn(toIcon, 'pr-1.5!'),
                  },
                  content: next,
                })
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
