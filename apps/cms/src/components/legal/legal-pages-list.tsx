import { Link } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import type { LegalPageSummary } from '@/server/legal-page-store';

// Two fixed pages, so a plain list rather than the list-page building blocks
// (no selection, no deleting, nothing to search).
export function LegalPagesList({ pages }: { pages: LegalPageSummary[] }) {
  const timeZone = useTimeZone();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 data-slot="page-title" className="text-xl font-semibold">
          Legal pages
        </h1>
        <p className="text-muted-foreground text-ui mt-1">
          Changes go live when an admin publishes them. Every published version is kept.
        </p>
      </div>
      <ul className="divide-y rounded-lg border">
        {pages.map((page) => (
          <li key={page.slug}>
            <Link
              to="/legal/$slug"
              params={{ slug: page.slug }}
              className="hover:bg-muted/50 touch:min-h-11 flex items-center gap-3 px-4 py-3"
            >
              <span className="flex-1">
                <span className="text-ui block font-medium">{page.title}</span>
                <span className="text-muted-foreground block text-xs">
                  {page.lastPublishedAt
                    ? `Last updated ${formatDate(page.lastPublishedAt, timeZone)}`
                    : 'Not published'}
                </span>
              </span>
              {page.reviewRequestedAt ? (
                <Badge variant="secondary">Review requested</Badge>
              ) : page.hasDraft ? (
                <Badge variant="outline">Unpublished changes</Badge>
              ) : (
                <Badge variant="outline">Published</Badge>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
