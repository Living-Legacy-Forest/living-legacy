import { createLink, useNavigate, useRouter } from '@tanstack/react-router';
import { usePendingRange } from '@/components/analytics/analytics-page';
import { AnalyticsBodySkeleton } from '@/components/analytics/analytics-skeleton';
import { RevealWords } from '@/components/dashboard/reveal-words';
import { Flag } from '@/components/flag';
import { GlobeIcon, LaptopIcon, SmartphoneIcon, TabletIcon } from '@/components/icons';
import { SegmentedControl } from '@/components/segmented-control';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime, formatInteger, formatRelative } from '@/lib/format';
import { pageNumbers } from '@/lib/page-numbers';
import { siteUrl } from '@/lib/site';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { useTimeZone } from '@/lib/use-time-zone';
import {
  VISITORS_PAGE_SIZE,
  VISITOR_RANGES,
  type VisitorRange,
  type VisitorSession,
  sourceLabels,
} from '@/lib/visitors';
import type { VisitorsData } from '@/server/visitors';

const RANGE_OPTIONS = VISITOR_RANGES.map((d) => ({ value: String(d), label: `${d} days` }));

/** "Planting day | Living Legacy" reads as "Planting day": the site's name is on every page. */
const pageName = (page: { path: string; title: string }) =>
  page.title.replace(/\s+[|–—]\s+[^|–—]*$/, '').trim() || page.path;

const deviceIcons = { desktop: LaptopIcon, mobile: SmartphoneIcon, tablet: TabletIcon };

export function VisitorsPage({ data }: { data: VisitorsData }) {
  const navigate = useNavigate({ from: '/analytics/visitors' });
  const revealing = useRevealOnce();
  const days: VisitorRange = data.connected ? data.days : 30;
  // Visitors pages through PostHog, so a new page number loads as a new period does.
  const pending = usePendingRange(['days', 'page']);

  return (
    <div
      data-slot="stack-page"
      data-revealing={revealing || undefined}
      className="mx-auto w-full max-w-6xl"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
            <RevealWords text="Visitors" />
          </h1>
          <p className="text-muted-foreground text-sm">
            Recent visits to the website, newest first: where people came from and what they read.
          </p>
        </div>
        {data.connected && (
          <SegmentedControl
            label="Period"
            value={String(pending.days ?? days)}
            options={RANGE_OPTIONS}
            // A new period starts again from the first page.
            onValueChange={(value) =>
              navigate({
                search: { days: Number(value) === 30 ? undefined : Number(value), page: undefined },
              })
            }
          />
        )}
      </div>

      {pending.loading ? (
        <div role="status" aria-label="Loading">
          <AnalyticsBodySkeleton kind="visitors" />
        </div>
      ) : (
        <VisitorsBody data={data} />
      )}
    </div>
  );
}

function VisitorsBody({ data }: { data: VisitorsData }) {
  const router = useRouter();
  const timeZone = useTimeZone();

  if (!data.connected) {
    return (
      <Notice
        title="Website analytics aren't connected"
        description="Once the website's analytics are connected to the CMS, its visits show here."
      />
    );
  }
  if (data.error) {
    return (
      <Notice title="Visitors didn't load" description={data.error}>
        <Button variant="outline" size="sm" onClick={() => void router.invalidate()}>
          Try again
        </Button>
      </Notice>
    );
  }
  if (data.total === 0) {
    return (
      <Notice
        title="No visits yet"
        description={`Nobody has visited the website in the last ${data.days} days.`}
      />
    );
  }

  return (
    <>
      {/* From md: a table, one visit a row. */}
      <div className="overflow-hidden rounded-lg border max-md:hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Last view</TableHead>
              <TableHead>Visitor</TableHead>
              <TableHead>Came from</TableHead>
              <TableHead>Entry page</TableHead>
              <TableHead>Exit page</TableHead>
              <TableHead className="pr-4 text-right">Views</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((visit) => (
              <TableRow key={visit.id}>
                <TableCell
                  className="pl-4 whitespace-nowrap tabular-nums"
                  title={formatRelative(visit.lastView)}
                >
                  {formatDateTime(visit.lastView, timeZone)}
                </TableCell>
                <TableCell>
                  <Visitor visit={visit} />
                </TableCell>
                <TableCell>
                  <Source visit={visit} />
                </TableCell>
                <TableCell className="max-w-56">
                  <PageLink page={visit.entry} />
                </TableCell>
                <TableCell className="max-w-56">
                  <PageLink page={visit.exit} />
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums">
                  {formatInteger(visit.views)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Phones: one card a visit, in iOS Settings' inset group. */}
      <ul className="divide-y divide-(--ios-separator) overflow-hidden rounded-[10px] bg-(--ios-cell) md:hidden">
        {data.rows.map((visit) => (
          <li key={visit.id} className="space-y-1.5 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <Visitor visit={visit} />
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {formatRelative(visit.lastView)}
              </span>
            </div>
            <Source visit={visit} />
            <p className="text-ui flex min-w-0 flex-wrap items-center gap-x-1.5">
              <PageLink page={visit.entry} />
              {visit.views > 1 && (
                <>
                  <span aria-hidden className="text-muted-foreground shrink-0">
                    →
                  </span>
                  <PageLink page={visit.exit} />
                </>
              )}
            </p>
            <p className="text-muted-foreground text-xs">
              {visit.views === 1 ? '1 page viewed' : `${formatInteger(visit.views)} pages viewed`}
            </p>
          </li>
        ))}
      </ul>

      <Pager data={data} />
    </>
  );
}

function Notice({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <Empty className="rounded-lg border max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <GlobeIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}

/** Where the visitor is and what they used: country, city, system, browser and device. */
function Visitor({ visit }: { visit: VisitorSession }) {
  const place = [visit.city, visit.countryName ?? visit.country].filter(Boolean).join(', ');
  const kit = [visit.os, visit.browser].filter(Boolean).join(' · ');
  const DeviceIcon = visit.device ? deviceIcons[visit.device] : null;
  return (
    <span className="block min-w-0">
      <span className="text-ui flex items-center gap-1.5">
        <Flag code={visit.country} />
        <span className="truncate">{place || 'Unknown location'}</span>
      </span>
      {(kit || DeviceIcon) && (
        <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
          {DeviceIcon && <DeviceIcon aria-label={visit.device ?? undefined} className="size-3.5" />}
          <span className="truncate">{kit}</span>
        </span>
      )}
    </span>
  );
}

function Source({ visit }: { visit: VisitorSession }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      {visit.referrer && <span className="text-ui truncate font-medium">{visit.referrer}</span>}
      <Badge variant="secondary" className="font-normal">
        {sourceLabels[visit.source]}
      </Badge>
    </span>
  );
}

/** A page of the website, by its title, opening the live page in a new tab. */
function PageLink({ page }: { page: { path: string; title: string } }) {
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

// Pagination links that navigate inside the app, keeping the period.
const PageNumber = createLink(PaginationLink);
const PagePrevious = createLink(PaginationPrevious);
const PageNext = createLink(PaginationNext);
const EXACT = { exact: true } as const;
const endProps = {
  'aria-disabled': true,
  tabIndex: -1,
  className: 'pointer-events-none opacity-50',
} as const;

type VisitorsSearch = { page?: number; days?: number };

function Pager({ data }: { data: Extract<VisitorsData, { connected: true }> }) {
  const { page, pageCount, total } = data;
  const from = (page - 1) * VISITORS_PAGE_SIZE + 1;
  const to = Math.min(page * VISITORS_PAGE_SIZE, total);
  const toPage = (n: number) => (prev: VisitorsSearch) => ({
    ...prev,
    page: n > 1 ? n : undefined,
  });

  return (
    <div className="text-muted-foreground mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="tabular-nums">
        {formatInteger(from)}–{formatInteger(to)} of {formatInteger(total)} visits
      </span>
      {pageCount > 1 && (
        <Pagination aria-label="Visitor pages" className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              {page <= 1 ? (
                <PaginationPrevious {...endProps} />
              ) : (
                <PagePrevious
                  to="/analytics/visitors"
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
                    to="/analytics/visitors"
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
                  to="/analytics/visitors"
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
