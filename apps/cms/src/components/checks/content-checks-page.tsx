import { Link } from '@tanstack/react-router';
import { CheckboxTickIcon } from '@/components/icons';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { formatDate } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import type { ContentChecks } from '@/server/content-checks';

const linkClass = 'underline-offset-4 hover:underline';

/** One kind of problem: what it is, why it matters, and each item to fix. */
function Check({
  title,
  why,
  total,
  children,
}: {
  title: string;
  why: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    // Phones: the header becomes iOS's small heading over a grouped list.
    <section className="rounded-lg border max-md:rounded-none max-md:border-0">
      <header className="flex items-baseline justify-between gap-4 border-b px-4 py-3 max-md:border-0 max-md:pt-0 max-md:pb-1.5">
        <div className="min-w-0">
          <h2 className="text-ui font-medium max-md:text-[0.8125rem] max-md:font-normal max-md:text-(--ios-secondary) max-md:uppercase">
            {title}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">{why}</p>
        </div>
        <span className="text-muted-foreground text-xs tabular-nums">{total}</span>
      </header>
      <ul className="divide-y text-sm max-md:divide-(--ios-separator) max-md:overflow-hidden max-md:rounded-[10px] max-md:bg-(--ios-cell)">
        {children}
      </ul>
    </section>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => (
  <li className="touch:min-h-11 flex items-center justify-between gap-3 px-4 py-2">{children}</li>
);

const More = ({ shown, total }: { shown: number; total: number }) =>
  total > shown ? (
    <li className="text-muted-foreground px-4 py-2 text-xs">
      And {total - shown} more. Fix these first and the rest will show.
    </li>
  ) : null;

export function ContentChecksPage({
  data,
  canEditMedia,
}: {
  data: ContentChecks;
  /** The media library needs media:write; without it an image is named, not linked. */
  canEditMedia: boolean;
}) {
  const timeZone = useTimeZone();
  const { noDescription, noImage, noAlt, events } = data;
  const problems = noDescription.total + noImage.total + noAlt.total + events.total;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 space-y-1">
        <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
          Content checks
        </h1>
        <p className="text-muted-foreground text-sm">
          Gaps in published content that visitors, search engines and screen readers notice.
        </p>
      </div>

      {problems === 0 ? (
        <Empty className="rounded-lg border max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CheckboxTickIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Nothing to fix</EmptyTitle>
            <EmptyDescription>
              Published posts, images and upcoming events have what they need.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          {noDescription.total > 0 && (
            <Check
              title="Posts with no description"
              why="No SEO description and no excerpt, so search results show whatever text they find."
              total={noDescription.total}
            >
              {noDescription.rows.map((p) => (
                <Row key={p.id}>
                  <Link to="/posts/$postId" params={{ postId: p.id }} className={linkClass}>
                    {p.title || 'Untitled'}
                  </Link>
                </Row>
              ))}
              <More shown={noDescription.rows.length} total={noDescription.total} />
            </Check>
          )}

          {noImage.total > 0 && (
            <Check
              title="Posts with no share image"
              why="No share image and no featured image, so links to them show no picture when shared."
              total={noImage.total}
            >
              {noImage.rows.map((p) => (
                <Row key={p.id}>
                  <Link to="/posts/$postId" params={{ postId: p.id }} className={linkClass}>
                    {p.title || 'Untitled'}
                  </Link>
                </Row>
              ))}
              <More shown={noImage.rows.length} total={noImage.total} />
            </Check>
          )}

          {noAlt.total > 0 && (
            <Check
              title="Images with no alt text"
              why="Used on the site with nothing for screen readers to say. Images placed inside text have their own alt text and are not listed."
              total={noAlt.total}
            >
              {noAlt.rows.map((m) => (
                <Row key={m.id}>
                  {canEditMedia ? (
                    <Link
                      to="/media"
                      search={{ selected: m.id }}
                      className={`${linkClass} truncate`}
                    >
                      {m.filename}
                    </Link>
                  ) : (
                    <span className="truncate">{m.filename}</span>
                  )}
                </Row>
              ))}
              <More shown={noAlt.rows.length} total={noAlt.total} />
            </Check>
          )}

          {events.total > 0 && (
            <Check
              title="Upcoming events missing details"
              why="Published events with no cover photo or no summary, which event lists show."
              total={events.total}
            >
              {events.rows.map((e) => (
                <Row key={e.id}>
                  {/* The details sit under the title, so a long one is not cut short. */}
                  <div className="min-w-0">
                    <Link to="/events" className={`${linkClass} block truncate`}>
                      {e.title || 'Untitled'}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {[
                        formatDate(e.startsAt, timeZone),
                        e.noCover && 'no cover photo',
                        e.noSummary && 'no summary',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </Row>
              ))}
              <More shown={events.rows.length} total={events.total} />
            </Check>
          )}
        </div>
      )}
    </div>
  );
}
