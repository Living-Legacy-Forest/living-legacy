import { Link, type LinkProps } from '@tanstack/react-router';
import { useState } from 'react';
import {
  CalendarClockIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  LinkIcon,
  ImageIcon,
  type LucideIcon,
  SearchIcon,
} from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { formatDate, formatInteger } from '@/lib/format';
import { useAction } from '@/lib/use-action';
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
            : `${formatInteger(gaps)} ${gaps === 1 ? 'gap' : 'gaps'} in published content. Each one has a button that takes you to the fix.`}
        </p>
      </div>

      <Summary data={data} />

      {failing.map((check) => (
        <Section key={check.key} check={check} total={data[check.key].total}>
          <Items checkKey={check.key} data={data} canEditMedia={canEditMedia} />
          <More shown={data[check.key].rows.length} total={data[check.key].total} />
        </Section>
      ))}
    </div>
  );
}

/** One line per check: a tick when it passes, the count and a jump link when it does not. */
function Summary({ data }: { data: ContentChecks }) {
  return (
    <ul className="divide-y rounded-lg border max-md:divide-(--ios-separator) max-md:overflow-hidden max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)">
      {CHECKS.map((check) => {
        const total = data[check.key].total;
        const body = (
          <>
            <check.icon aria-hidden className="text-muted-foreground size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="text-ui block font-medium">{check.title}</span>
              <span className="text-muted-foreground block text-xs">
                {total === 0 ? check.passing : check.why}
              </span>
            </span>
            {total === 0 ? (
              <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                <CircleCheckIcon aria-hidden className="size-3.5" />
                Passing
              </span>
            ) : (
              <Badge
                variant="outline"
                className="shrink-0 gap-1 border-amber-300 text-amber-800 tabular-nums dark:border-amber-700 dark:text-amber-300"
              >
                <CircleAlertIcon aria-hidden className="size-3" />
                {formatInteger(total)} to fix
              </Badge>
            )}
          </>
        );
        return (
          <li key={check.key}>
            {total === 0 ? (
              <div className="touch:min-h-11 flex items-center gap-3 px-4 py-3">{body}</div>
            ) : (
              <a
                href={`#check-${check.key}`}
                className="touch:min-h-11 hover:bg-muted/60 flex items-center gap-3 px-4 py-3 transition-colors"
              >
                {body}
                <ChevronRightIcon
                  aria-hidden
                  className="text-muted-foreground/60 size-4 shrink-0"
                />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Section({
  check,
  total,
  children,
}: {
  check: (typeof CHECKS)[number];
  total: number;
  children: React.ReactNode;
}) {
  return (
    // Phones: the header becomes iOS's small heading over a grouped list.
    <section
      id={`check-${check.key}`}
      className="scroll-mt-6 rounded-lg border max-md:rounded-none max-md:border-0"
    >
      <header className="flex items-baseline justify-between gap-4 border-b px-4 py-3 max-md:border-0 max-md:px-4 max-md:pt-0 max-md:pb-1.5">
        <h2 className="text-ui font-medium max-md:text-[0.8125rem] max-md:font-normal max-md:text-(--ios-secondary) max-md:uppercase">
          {check.title}
        </h2>
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatInteger(total)} to fix
        </span>
      </header>
      <ul className="divide-y max-md:divide-(--ios-separator) max-md:overflow-hidden max-md:rounded-[10px] max-md:bg-(--ios-cell)">
        {children}
      </ul>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <li className="touch:min-h-11 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
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

function Items({
  checkKey,
  data,
  canEditMedia,
}: {
  checkKey: CheckKey;
  data: ContentChecks;
  canEditMedia: boolean;
}) {
  const timeZone = useTimeZone();

  switch (checkKey) {
    case 'noDescription':
      return data.noDescription.rows.map((p) => (
        <Row key={p.id}>
          <span className="text-ui min-w-0 flex-1 truncate">{p.title || 'Untitled'}</span>
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
          <span className="text-ui min-w-0 flex-1 truncate">{p.title || 'Untitled'}</span>
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
        <AltTextRow key={m.id} id={m.id} filename={m.filename} canEdit={canEditMedia} />
      ));
    case 'events':
      return data.events.rows.map((e) => (
        <Row key={e.id}>
          <span className="min-w-0 flex-1">
            <span className="text-ui block truncate">{e.title || 'Untitled'}</span>
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
          <FixLink label="Open the event" to="/events" search={{ open: e.id }} />
        </Row>
      ));
  }
}

/** Alt text is quick to write, so it is written here rather than in the media library. */
function AltTextRow({ id, filename, canEdit }: { id: string; filename: string; canEdit: boolean }) {
  const [alt, setAlt] = useState('');
  const { run, pending } = useAction();

  return (
    <Row>
      <img
        src={`/api/media/${id}?w=96`}
        alt=""
        loading="lazy"
        className="bg-muted size-10 shrink-0 rounded-md border object-cover"
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
            placeholder={`Describe ${filename}`}
            value={alt}
            maxLength={300}
            onChange={(e) => setAlt(e.target.value)}
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
    <li className="text-muted-foreground px-4 py-2 text-xs">
      And {formatInteger(total - shown)} more. Fix these first and the rest will show.
    </li>
  ) : null;
}
