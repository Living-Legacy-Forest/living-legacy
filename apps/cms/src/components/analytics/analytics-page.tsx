import { useRouter } from '@tanstack/react-router';
import { RevealWords } from '@/components/dashboard/reveal-words';
import { ChartAreaIcon } from '@/components/icons';
import { SegmentedControl } from '@/components/segmented-control';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { ANALYTICS_RANGES, type AnalyticsRange, DEFAULT_RANGE } from '@/lib/analytics';
import { useRevealOnce } from '@/lib/use-reveal-once';
import type { AnalyticsResult } from '@/server/analytics';

const RANGE_OPTIONS = ANALYTICS_RANGES.map((d) => ({ value: String(d), label: `${d} days` }));

/**
 * The frame every Analytics page shares: the title, a line on what it shows, the period, and
 * what to say when analytics are not connected or did not load. `children` gets the answer.
 */
export function AnalyticsPage<T>({
  title,
  description,
  result,
  onRangeChange,
  isEmpty,
  emptyTitle = 'Nothing yet',
  emptyDescription,
  children,
}: {
  title: string;
  description: string;
  result: AnalyticsResult<T>;
  onRangeChange: (days: AnalyticsRange) => void;
  /** Whether the answer has nothing in it, to say so rather than show empty cards. */
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  emptyDescription?: (days: AnalyticsRange) => string;
  children: (data: T, days: AnalyticsRange) => React.ReactNode;
}) {
  const router = useRouter();
  const revealing = useRevealOnce();
  const days = result.connected ? result.days : DEFAULT_RANGE;

  let body: React.ReactNode;
  if (!result.connected) {
    body = (
      <AnalyticsNotice
        title="Website analytics aren't connected"
        description="Once the website's analytics are connected to the CMS, its numbers show here."
      />
    );
  } else if (!result.data) {
    body = (
      <AnalyticsNotice title={`${title} didn't load`} description={result.error ?? ''}>
        <Button variant="outline" size="sm" onClick={() => void router.invalidate()}>
          Try again
        </Button>
      </AnalyticsNotice>
    );
  } else if (isEmpty?.(result.data)) {
    body = (
      <AnalyticsNotice
        title={emptyTitle}
        description={
          emptyDescription?.(days) ?? `Nobody has visited the website in the last ${days} days.`
        }
      />
    );
  } else {
    body = children(result.data, days);
  }

  return (
    <div
      data-slot="stack-page"
      data-revealing={revealing || undefined}
      className="mx-auto w-full max-w-6xl"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
            <RevealWords text={title} />
          </h1>
          <p className="text-muted-foreground text-sm text-pretty">{description}</p>
        </div>
        {result.connected && (
          <SegmentedControl
            label="Period"
            value={String(days)}
            options={RANGE_OPTIONS}
            onValueChange={(value) => onRangeChange(Number(value) as AnalyticsRange)}
          />
        )}
      </div>
      {body}
    </div>
  );
}

export function AnalyticsNotice({
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
          <ChartAreaIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}

/** The period as the address keeps it: 30 days, the default, is left out. */
export const rangeSearch = (days: AnalyticsRange) => ({
  days: days === DEFAULT_RANGE ? undefined : days,
});
