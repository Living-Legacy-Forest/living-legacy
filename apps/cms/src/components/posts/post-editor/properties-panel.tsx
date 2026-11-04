import type { ReactNode } from 'react';
import {
  CalendarClockIcon,
  ChevronRightIcon,
  FolderIcon,
  GlobeIcon,
  LinkIcon,
  type LucideIcon,
  TagIcon,
  UserIcon,
} from '@/components/icons';
import { ImageField } from '@/components/media/image-field';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatDateTime } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import { MultiPicker, SinglePicker, UrlPicker, tagOptions } from './property-pickers';
import { SeoFields } from './seo-fields';
import type { PostEditorState } from './use-post-editor';

/** The sidebar beside the post: properties, featured image, search listing, revisions. */
export function PropertiesPanel({ editor }: { editor: PostEditorState }) {
  const timeZone = useTimeZone();
  const { values, meta, update, contentLocked } = editor;

  return (
    <>
      <Section title="Properties" defaultOpen first>
        {/* A disabled fieldset locks every picker inside for SEO and read-only access. */}
        <fieldset disabled={contentLocked} className="min-w-0 space-y-0.5 disabled:opacity-70">
          <Property label="Author" icon={UserIcon}>
            <SinglePicker
              label="Author"
              options={editor.authors}
              value={values.authorId}
              placeholder="No author"
              onChange={(authorId) => update({ authorId })}
            />
          </Property>
          <Property label="Categories" icon={FolderIcon}>
            <MultiPicker
              label="Categories"
              options={editor.categories}
              selected={values.categoryIds}
              placeholder="Add categories"
              onChange={(categoryIds) => update({ categoryIds })}
              onCreate={editor.addCategory}
            />
          </Property>
          <Property label="Tags" icon={TagIcon}>
            <MultiPicker
              label="Tags"
              options={tagOptions(editor.tags, values.tags)}
              selected={values.tags}
              placeholder="Add tags"
              onChange={(tags) => update({ tags })}
              onCreate={async (name) => update({ tags: [...values.tags, name] })}
            />
          </Property>
          <Property label="URL" icon={LinkIcon}>
            <UrlPicker
              slug={values.slug}
              liveSlug={editor.isLive ? editor.saved.slug : null}
              onChange={editor.setSlug}
            />
          </Property>
          {meta.scheduledAt && (
            <Property label="Goes live" icon={CalendarClockIcon}>
              <span className="px-2">{formatDateTime(meta.scheduledAt, timeZone)}</span>
            </Property>
          )}
          {meta.publishedAt && (
            <Property label="Published" icon={GlobeIcon}>
              <span className="text-muted-foreground px-2">
                {formatDateTime(meta.publishedAt, timeZone)}
              </span>
            </Property>
          )}
        </fieldset>
      </Section>

      <Section title="Featured image" defaultOpen>
        <fieldset disabled={contentLocked} className="min-w-0 disabled:opacity-70">
          <ImageField
            id="post-featured"
            aspect={3 / 2}
            label="Featured image"
            hideLabel
            description="Shown at the top of the post and on blog cards."
            mediaId={values.featuredMediaId}
            onChange={(featuredMediaId) => update({ featuredMediaId })}
          />
        </fieldset>
      </Section>

      <Section title="Search listing">
        <fieldset disabled={editor.access === 'readonly'} className="min-w-0">
          <SeoFields values={values} onChange={update} />
        </fieldset>
      </Section>

      {editor.revisions.length > 0 && (
        <Section title="Revisions" count={editor.revisions.length}>
          <ul className="space-y-0.5">
            {editor.revisions.map((revision, index) => (
              <li
                key={revision.id}
                className="hover:bg-accent flex min-h-8 items-center justify-between gap-2 rounded-md px-2"
              >
                <span className="min-w-0 truncate">
                  {formatDateTime(revision.createdAt, timeZone)}
                  <span className="text-muted-foreground"> · {revision.by}</span>
                </span>
                {index === 0 ? (
                  <span className="text-muted-foreground text-xs">Live</span>
                ) : contentLocked ? null : (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground h-6"
                    onClick={() => editor.loadRevision(revision.id)}
                  >
                    Restore
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

function Property({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-8 grid-cols-[6.5rem_minmax(0,1fr)] items-center">
      <span className="text-muted-foreground flex items-center gap-2">
        <Icon aria-hidden className="size-3.5 shrink-0" />
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Section({
  title,
  count,
  defaultOpen = false,
  first = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  /** Drops the top border/padding for the first section in the sidebar. */
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn('pt-4', !first && 'border-t')}>
      <CollapsibleTrigger className="group text-muted-foreground hover:text-foreground flex w-full items-center gap-1 text-xs font-medium">
        <ChevronRightIcon
          aria-hidden
          className="size-3.5 transition-transform duration-150 group-data-[panel-open]:rotate-90 motion-reduce:transition-none"
        />
        {title}
        {count !== undefined && <span className="ml-auto tabular-nums">{count}</span>}
      </CollapsibleTrigger>
      {/* Height animates from Base UI's measured panel height; instant with reduced motion. */}
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none">
        <div className="pt-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
