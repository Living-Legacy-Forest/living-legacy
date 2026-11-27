import { useRouter, useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
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
import { AnalyticsBodySkeleton, type AnalyticsSkeletonKind } from './analytics-skeleton';
import type { AnalyticsResult } from '@/server/analytics';

const RANGE_OPTIONS = ANALYTICS_RANGES.map((d) => ({ value: String(d), label: `${d} days` }));

/**
 * The frame every Analytics page shares: the title, a line on what it shows, the period, and
 * what to say when analytics are not connected or did not load. `children` gets the answer.
 */
/**
 * What this same page is loading, once it has taken `delay` ms: a new period, or anything else
 * in `watch` (Visitors pages through PostHog, so its page number counts too). The cards give way
 * to their skeleton then, rather than show the old numbers under the new choice. `days` is the
 * period asked for, at once, so the control moves on the tap.
 */
export function usePendingRange(watch: string[] = ['days'], delay = 120) {
  const key = watch.join(',');
  const days = useRouterState({
    select: (s) => {
      if (s.status !== 'pending' || s.location.pathname !== s.resolvedLocation?.pathname) {
        return null;
      }
      const next = s.location.search as Record<string, unknown>;
      const now = s.resolvedLocation.search as Record<string, unknown>;
      if (!key.split(',').some((k) => next[k] !== now[k])) return null;
      return ((next.days as number | undefined) ?? DEFAULT_RANGE) as AnalyticsRange;
    },
  });
  const [late, setLate] = useState<AnalyticsRange | null>(null);
  useEffect(() => {
    if (days === null) {
      setLate(null);
      return;
    }
    const timer = setTimeout(() => setLate(days), delay);
    return () => clearTimeout(timer);
  }, [days, delay]);
  return { days, loading: days !== null && late === days };
}

export function AnalyticsPage<T>({
  kind,
  title,
  description,
  result,
  onRangeChange,
  isEmpty,
  emptyTitle = 'Nothing yet',
  emptyDescription,
  children,
}: {
  /** Which page, for the skeleton shown while a new period loads. */
  kind: AnalyticsSkeletonKind;
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
  const days = result.days;
  const pending = usePendingRange();

  let body: React.ReactNode;
  if (pending.loading) {
    body = (
      <div role="status" aria-label="Loading">
        <AnalyticsBodySkeleton kind={kind} />
      </div>
    );
  } else if (!result.connected) {
    // The page keeps its layout with nothing in it, as the dashboard does.
    body = (
      <div className="space-y-4 max-md:space-y-3">
        <NotConnectedNote />
        {children(result.data, days)}
      </div>
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
    <div data-slot="stack-page" data-revealing={revealing || undefined} className="w-full">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
            <RevealWords text={title} />
          </h1>
          <p className="text-muted-foreground text-sm text-pretty">{description}</p>
        </div>
        <SegmentedControl
          label="Period"
          value={String(pending.days ?? days)}
          options={RANGE_OPTIONS}
          onValueChange={(value) => onRangeChange(Number(value) as AnalyticsRange)}
        />
      </div>
      {body}
    </div>
  );
}

/** One line above the empty cards, until the website's analytics are connected to the CMS. */
export function NotConnectedNote() {
  return (
    <p role="status" className="text-muted-foreground flex items-center gap-2 text-sm max-md:px-1">
      <ChartAreaIcon aria-hidden className="size-4 shrink-0" />
      Website analytics aren't connected to the CMS yet, so there is nothing to show.
    </p>
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
    <Empty className="rounded-lg max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)">
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
