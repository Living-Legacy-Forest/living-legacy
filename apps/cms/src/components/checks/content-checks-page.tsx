import { Link, type LinkProps } from '@tanstack/react-router';
import { type ReactElement, useState } from 'react';
import {
  CalendarClockIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  LinkIcon,
  ImageIcon,
  type LucideIcon,
  SearchIcon,
} from '@/components/icons';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pager } from '@/components/pager';
import { Spinner } from '@/components/ui/spinner';
import { formatDate, formatInteger } from '@/lib/format';
import { useAction } from '@/lib/use-action';
import { usePaged } from '@/lib/use-paged';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import type { ContentChecks } from '@/server/content-checks';
import { updateMedia } from '@/server/media';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { RevealWords } from '@/components/dashboard/reveal-words';

type CheckKey = 'noDescription' | 'noImage' | 'noAlt' | 'events';

/** Every check, passing or not, so the page shows what is looked at as well as what failed. */
const CHECKS: { key: CheckKey; icon: LucideIcon; title: string; passing: string; why: string }[] = [
  {
    key: 'noDescription',
    icon: SearchIcon,
    title: 'Search descriptions',
    passing: 'Every published post has one.',
    why: 'With no SEO description and no excerpt, search results show whatever text they find.',
  },
  {
    key: 'noImage',
    icon: LinkIcon,
    title: 'Share images',
    passing: 'Every published post has one.',
    why: 'With no share image and no featured image, links to the post show no picture when shared.',
  },
  {
    key: 'noAlt',
    icon: ImageIcon,
    title: 'Alt text',
    passing: 'Every image in use has it.',
    why: 'Screen readers have nothing to say for these. Images placed inside text have their own alt text and are not listed.',
  },
  {
    key: 'events',
    icon: CalendarClockIcon,
    title: 'Event details',
    passing: 'Every upcoming event has a cover photo and a summary.',
    why: 'Event lists on the website show the cover photo and summary.',
  },
];

/** What each check lists, for the pager's count. */
const NOUNS: Record<CheckKey, string> = {
  noDescription: 'posts',
  noImage: 'posts',
  noAlt: 'images',
  events: 'events',
};
/** Rows here are tall, so a page is shorter than a plain list's. */
const PAGE_SIZES = [10, 25, 50, 100] as const;

const fixClass = cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'touch:min-h-11 shrink-0');

export function ContentChecksPage({
  data,
  canEditMedia,
}: {
  data: ContentChecks;
  /** Alt text is saved to the media library, which needs media:write. */
  canEditMedia: boolean;
}) {
  const failing = CHECKS.filter((check) => data[check.key].total > 0);
  const passing = CHECKS.filter((check) => data[check.key].total === 0);
  const gaps = failing.reduce((sum, check) => sum + data[check.key].total, 0);

  const revealing = useRevealOnce();

  return (
    <div
      data-slot="stack-page"
      data-revealing={revealing || undefined}
      className="mx-auto w-full max-w-3xl space-y-6"
    >
      <div className="space-y-1">
        <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
          <RevealWords text="Content checks" />
        </h1>
        <p className="text-muted-foreground text-sm">
          {gaps === 0
            ? 'Published content has what visitors, search engines and screen readers need.'
            : `${formatInteger(gaps)} ${gaps === 1 ? 'gap' : 'gaps'} in published content, each with a button that takes you to the fix.`}
        </p>
      </div>

      {failing.map((check) => (
        <CheckSection key={check.key} check={check} total={data[check.key].total}>
          <CheckRows checkKey={check.key} data={data} canEditMedia={canEditMedia} />
        </CheckSection>
      ))}

      {passing.length > 0 && <PassingList checks={passing} />}
    </div>
  );
}

/** How many a failing check has to fix. */
function ToFix({ total }: { total: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-amber-700 tabular-nums dark:text-amber-400">
      <CircleAlertIcon aria-hidden className="size-3.5" />
      {formatInteger(total)} to fix
    </span>
  );
}

function CheckIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="bg-muted text-muted-foreground grid size-8 shrink-0 place-items-center rounded-md max-md:hidden">
      <Icon aria-hidden className="size-4" />
    </span>
  );
}

/**
 * A failing check: what it looks at and why it matters, then each thing to fix. Phones show the
 * header as iOS's small heading over a grouped list.
 */
function CheckSection({
  check,
  total,
  children,
}: {
  check: (typeof CHECKS)[number];
  total: number;
  children: React.ReactNode;
}) {
  const headingId = `check-${check.key}`;
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-lg border max-md:rounded-none max-md:border-0"
    >
      <header className="flex items-start gap-3 px-4 py-3 max-md:px-4 max-md:pt-0 max-md:pb-2">
        <CheckIcon icon={check.icon} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id={headingId}
              className="text-ui font-medium max-md:text-[0.8125rem] max-md:font-normal max-md:text-(--ios-secondary)"
            >
              {check.title}
            </h2>
            <ToFix total={total} />
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs max-md:text-(--ios-secondary)">
            {check.why}
          </p>
        </div>
      </header>
      {children}
    </section>
  );
}

/** The checks with nothing to fix, together at the end, so the page shows all that is looked at. */
function PassingList({ checks }: { checks: (typeof CHECKS)[number][] }) {
  return (
    <section aria-labelledby="checks-passing" className="space-y-2">
      <h2
        id="checks-passing"
        className="text-muted-foreground px-1 text-xs font-medium max-md:px-4 max-md:text-[0.8125rem] max-md:font-normal max-md:text-(--ios-secondary)"
      >
        Passing
      </h2>
      <ul className="divide-y rounded-lg border max-md:divide-(--ios-separator) max-md:overflow-hidden max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)">
        {checks.map((check) => (
          <li key={check.key} className="touch:min-h-11 flex items-center gap-3 px-4 py-3">
            <CheckIcon icon={check.icon} />
            <span className="min-w-0 flex-1">
              <span className="text-ui block font-medium">{check.title}</span>
              <span className="text-muted-foreground block text-xs">{check.passing}</span>
            </span>
            <CircleCheckIcon
              aria-hidden
              className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <li className="touch:min-h-11 flex min-h-13 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 md:pl-15">
      {children}
    </li>
  );
}

function FixLink({ label, ...link }: LinkProps & { label: string }) {
  return (
    <Link {...link} className={fixClass}>
      {label}
    </Link>
  );
}

/** A failing check's rows, a page at a time. The server lists up to 100; "And N more" follows the last. */
function CheckRows({
  checkKey,
  data,
  canEditMedia,
}: {
  checkKey: CheckKey;
  data: ContentChecks;
  canEditMedia: boolean;
}) {
  const rows = useCheckRows(checkKey, data, canEditMedia);
  const paged = usePaged(rows, '', PAGE_SIZES);
  const { page, pageCount } = paged.pager;

  return (
    <>
      <ul className="divide-y border-t max-md:divide-(--ios-separator) max-md:overflow-hidden max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)">
        {paged.shown}
        {page === pageCount && <More shown={rows.length} total={data[checkKey].total} />}
      </ul>
      {paged.needed && (
        <Pager
          {...paged.pager}
          noun={NOUNS[checkKey]}
          label={`Pages of ${NOUNS[checkKey]} to fix`}
          className="mt-0 border-t px-4 py-2 max-md:border-0"
        />
      )}
    </>
  );
}

function useCheckRows(
  checkKey: CheckKey,
  data: ContentChecks,
  canEditMedia: boolean
): ReactElement[] {
  const timeZone = useTimeZone();
  // Kept here, not in each row, so alt text typed but not yet saved survives a change of page.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  switch (checkKey) {
    case 'noDescription':
      return data.noDescription.rows.map((p) => (
        <Row key={p.id}>
          <span className="text-ui line-clamp-2 min-w-0 flex-1">{p.title || 'Untitled'}</span>
          <FixLink
            label="Add a description"
            to="/posts/$postId"
            params={{ postId: p.id }}
            search={{ focus: 'seo' }}
          />
        </Row>
      ));
    case 'noImage':
      return data.noImage.rows.map((p) => (
        <Row key={p.id}>
          <span className="text-ui line-clamp-2 min-w-0 flex-1">{p.title || 'Untitled'}</span>
          <FixLink
            label="Add an image"
            to="/posts/$postId"
            params={{ postId: p.id }}
            search={{ focus: 'image' }}
          />
        </Row>
      ));
    case 'noAlt':
      return data.noAlt.rows.map((m) => (
        <AltTextRow
          key={m.id}
          id={m.id}
          filename={m.filename}
          canEdit={canEditMedia}
          alt={drafts[m.id] ?? ''}
          onAlt={(alt) => setDrafts((previous) => ({ ...previous, [m.id]: alt }))}
        />
      ));
    case 'events':
      return data.events.rows.map((e) => (
        <Row key={e.id}>
          <span className="min-w-0 flex-1">
            <span className="text-ui line-clamp-2">{e.title || 'Untitled'}</span>
            <span className="text-muted-foreground block text-xs">
              {[
                formatDate(e.startsAt, timeZone),
                e.noCover && 'no cover photo',
                e.noSummary && 'no summary',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          <FixLink label="Open the event" to="/events/$eventId" params={{ eventId: e.id }} />
        </Row>
      ));
  }
}

/** Alt text is quick to write, so it is written here rather than in the media library. */
function AltTextRow({
  id,
  filename,
  canEdit,
  alt,
  onAlt,
}: {
  id: string;
  filename: string;
  canEdit: boolean;
  alt: string;
  onAlt: (alt: string) => void;
}) {
  const { run, pending } = useAction();

  return (
    <Row>
      <img
        src={`/api/media/${id}?w=96`}
        alt=""
        title={filename}
        loading="lazy"
        className="bg-muted size-9 shrink-0 rounded-md border object-cover"
      />
      {canEdit ? (
        <form
          className="flex min-w-0 flex-1 basis-64 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!alt.trim()) return;
            void run(() => updateMedia({ data: { id, alt } }), {
              success: { title: 'Alt text saved', description: `${filename} is described now.` },
              error: 'Could not save the alt text',
            });
          }}
        >
          <Input
            aria-label={`Alt text for ${filename}`}
            placeholder="Describe the image"
            value={alt}
            maxLength={300}
            onChange={(e) => onAlt(e.target.value)}
            className="touch:min-h-11 min-w-0 flex-1"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={pending || !alt.trim()}
            className="touch:min-h-11"
          >
            {pending ? <Spinner /> : 'Save'}
          </Button>
        </form>
      ) : (
        <span className="text-ui min-w-0 flex-1 truncate">{filename}</span>
      )}
    </Row>
  );
}

function More({ shown, total }: { shown: number; total: number }) {
  return total > shown ? (
    <li className="text-muted-foreground px-4 py-2.5 text-xs md:pl-15">
      And {formatInteger(total - shown)} more. They show here as these are fixed.
    </li>
  ) : null;
}
