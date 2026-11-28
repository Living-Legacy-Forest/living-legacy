import { useState } from 'react';
import { CircleCheckIcon } from '@/components/icons';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import { Pager } from '@/components/pager';
import { formatDateTime } from '@/lib/format';
import type { SystemStatus } from '@/server/system';

/** The server keeps at most 50 failures, so 50 is every one of them on a page. */
const ROW_CHOICES = [5, 10, 25, 50] as const;
const DEFAULT_ROWS = 10;

const rowClass = 'touch:min-h-11 -mx-2 px-2';

/** Job failures from the last 14 days, a page at a time. */
export function FailuresList({
  failures,
  timeZone,
}: {
  failures: SystemStatus['failures'];
  timeZone: string;
}) {
  const [asked, setPage] = useState(1);
  const [rows, setRows] = useState<number>(DEFAULT_ROWS);

  if (failures.length === 0) {
    return (
      <Empty className="py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CircleCheckIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-sm">No failures</EmptyTitle>
          <EmptyDescription>Every job has run without a problem for 14 days.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const pageCount = Math.max(1, Math.ceil(failures.length / rows));
  // A refresh that leaves fewer failures lands on the last page there is.
  const page = Math.min(asked, pageCount);
  const shown = failures.slice((page - 1) * rows, page * rows);

  return (
    <>
      <ItemGroup className="gap-0">
        {shown.map((failure) => (
          <Item key={failure.id} size="sm" className={rowClass}>
            <ItemContent className="min-w-0">
              <ItemTitle>{failure.title}</ItemTitle>
              <ItemDescription>{formatDateTime(failure.startedAt, timeZone)}</ItemDescription>
              <p className="text-sm wrap-break-word">{failure.error}</p>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>

      {/* With no more failures than the smallest page, there is nothing to page or to choose. */}
      {failures.length > ROW_CHOICES[0] && (
        <Pager
          page={page}
          pageCount={pageCount}
          total={failures.length}
          pageSize={rows}
          noun="failures"
          label="Pages of failures"
          onPageChange={setPage}
          rows={{
            options: ROW_CHOICES,
            // A new page size starts again from the first page.
            onChange: (n) => {
              setRows(n);
              setPage(1);
            },
          }}
        />
      )}
    </>
  );
}
