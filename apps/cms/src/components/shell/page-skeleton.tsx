import { useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The page a navigation is heading to, once it has been loading for `delay` ms.
 * Only page changes count: filtering or searching within a page keeps its UI.
 */
export function usePendingPathname(delay = 120) {
  const target = useRouterState({
    select: (s) =>
      s.status === 'pending' && s.location.pathname !== s.resolvedLocation?.pathname
        ? s.location.pathname
        : null,
  });
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!target) {
      setShown(null);
      return;
    }
    const timer = setTimeout(() => setShown(target), delay);
    return () => clearTimeout(timer);
  }, [target, delay]);

  return target && shown === target ? target : null;
}

const splitSections = [
  'posts',
  'team',
  'testimonials',
  'locations',
  'media-coverage',
  'faqs',
  'redirects',
  'announcements',
];

/** A placeholder shaped like the page at `pathname`. */
export function PageSkeleton({ pathname }: { pathname: string }) {
  const [, section, child] = pathname.split('/');

  return (
    <div role="status" aria-label="Loading" className="contents">
      {!section ? (
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <DashboardSkeleton />
        </div>
      ) : section === 'posts' && child ? (
        <EditorSkeleton />
      ) : splitSections.includes(section) ? (
        <SplitSkeleton />
      ) : section === 'settings' ? (
        <SettingsSkeleton />
      ) : (
        <ListSkeleton />
      )}
    </div>
  );
}

function Lines({ count, className }: { count: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-3.5" style={{ width: `${92 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}

/** Content lists (posts, team, testimonials, FAQs, redirects): a list beside a pane. */
function SplitSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:flex-none">
      <div className="flex items-center gap-3">
        <Skeleton className="mr-auto h-7 w-32" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-lg border lg:grid-cols-[minmax(20rem,2fr)_minmax(0,3fr)]">
        <section className="flex min-h-0 flex-col lg:border-r">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
            <Skeleton className="h-6 w-full max-w-56" />
          </div>
          <div className="divide-y">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="space-y-2 px-3 py-3">
                <Skeleton className="h-4" style={{ width: `${80 - ((i * 13) % 35)}%` }} />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        </section>
        <section className="hidden min-h-0 flex-col lg:flex">
          <div className="flex h-11 shrink-0 items-center border-b px-3">
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="space-y-5 p-6">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="aspect-video w-full" />
            <Lines count={5} className="space-y-2.5" />
          </div>
        </section>
      </div>
    </div>
  );
}

/** Users: a heading over grouped rows. */
function ListSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      {[4, 3].map((rows, s) => (
        <section key={s} className="space-y-2.5">
          <Skeleton className="h-4 w-20" />
          <div className="divide-y rounded-lg border">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4" style={{ width: `${70 - ((i * 11) % 30)}%` }} />
                  <Skeleton className="h-3 w-2/5" />
                </div>
                <Skeleton className="size-7" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {[3, 2, 3].map((rows, s) => (
        <section key={s} className="space-y-3">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="divide-y rounded-lg border">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-64 max-w-[50%]" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** The post editor: the document beside its metadata sidebar. */
function EditorSkeleton() {
  return (
    <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-0">
      <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border lg:mr-6 lg:h-[calc(100svh-7.5rem)]">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
          <Skeleton className="h-5 w-24" />
          <div className="ml-auto flex gap-1.5">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        <div className="flex h-10 shrink-0 items-center gap-1.5 border-b px-3">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="size-6" />
          ))}
        </div>
        <div className="mx-auto w-full max-w-3xl space-y-5 p-8">
          <Skeleton className="h-9 w-3/4" />
          <Lines count={4} className="space-y-2.5" />
          <Lines count={5} className="space-y-2.5" />
        </div>
      </div>
      <aside className="space-y-6 lg:border-l lg:pl-6">
        {[2, 3, 2].map((rows, s) => (
          <div key={s} className="space-y-2.5">
            <Skeleton className="h-3.5 w-20" />
            {Array.from({ length: rows }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ))}
      </aside>
    </div>
  );
}
