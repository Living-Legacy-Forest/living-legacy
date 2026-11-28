import { type ReactNode, useEffect } from 'react';
import {
  CalendarClockIcon,
  ChevronRightIcon,
  FolderIcon,
  GlobeIcon,
  LinkIcon,
  type LucideIcon,
  MapPinIcon,
  TagIcon,
  UserIcon,
} from '@/components/icons';
import { suggestPostTags, suggestPostText } from '@/components/ai/post-suggestions';
import { SuggestButton, SuggestTagsButton } from '@/components/ai/suggest-button';
import { ImageField } from '@/components/media/image-field';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatDateTime } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { COLLAPSIBLE_CONTENT } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { ContentScorePanel } from './content-score/content-score-panel';
import { rememberChoice } from '@/lib/last-choice';
import { useContentScore } from './content-score/use-content-score';
import { MultiPicker, SinglePicker, UrlPicker, tagOptions } from './property-pickers';
import { SeoFields, SocialFields } from './seo-fields';
import type { PostEditorState } from './use-post-editor';

/** The sidebar beside the post: content score, properties, featured image, search listing, revisions. */
export function PropertiesPanel({
  editor,
  focus,
}: {
  editor: PostEditorState;
  focus?: 'seo' | 'image';
}) {
  // Arriving to fix one thing: bring its section into view.
  useEffect(() => {
    if (!focus) return;
    document
      .getElementById(`post-section-${focus}`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focus]);

  const timeZone = useTimeZone();
  const { values, meta, update, contentLocked } = editor;
  const score = useContentScore(values, editor.contentTargets);

  return (
    <>
      <Section id="post-section-score" title="Content score" count={score.score} defaultOpen first>
        <ContentScorePanel result={score} values={values} update={update} />
      </Section>

      <Section title="Properties" defaultOpen>
        {/* A disabled fieldset locks every picker inside for SEO and read-only access. */}
        <fieldset disabled={contentLocked} className="min-w-0 space-y-0.5 disabled:opacity-70">
          <Property label="Author" icon={UserIcon}>
            <SinglePicker
              label="Author"
              options={editor.authors}
              value={values.authorId}
              placeholder="No author"
              onChange={(authorId) => {
                update({ authorId });
                // Picked by hand: the next new post starts with the same author.
                rememberChoice('post-author', authorId);
              }}
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
          <Property label="Location" icon={MapPinIcon}>
            <SinglePicker
              label="Location"
              options={editor.locations}
              value={values.locationId}
              placeholder="No location"
              onChange={(locationId) => update({ locationId })}
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
            <div className="px-2 pt-1 pb-1">
              <SuggestTagsButton
                tags={values.tags}
                request={() => suggestPostTags(values, editor.tags)}
                onApply={(tags) => update({ tags })}
              />
            </div>
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
          <div className="space-y-1.5 pt-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="post-summary" className="text-muted-foreground text-xs font-normal">
                Summary
              </Label>
              <SuggestButton
                group="summaries"
                value={values.excerpt}
                request={() => suggestPostText('excerpt', values)}
                onApply={(excerpt) => update({ excerpt })}
              />
            </div>
            <Textarea
              id="post-summary"
              value={values.excerpt}
              rows={3}
              placeholder="A sentence or two about the post."
              onChange={(e) => update({ excerpt: e.target.value })}
              className="text-ui md:text-ui"
            />
            <p className="text-muted-foreground text-xs">
              Shown on blog cards, and in search results when Description is empty.
            </p>
          </div>
        </fieldset>
      </Section>

      <Section id="post-section-image" title="Featured image" defaultOpen>
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

      <Section id="post-section-seo" title="Search listing" defaultOpen={focus === 'seo'}>
        <fieldset disabled={editor.access === 'readonly'} className="min-w-0">
          <SeoFields values={values} onChange={update} />
        </fieldset>
      </Section>

      <Section id="post-section-social" title="Social sharing" defaultOpen={focus === 'seo'}>
        <fieldset disabled={editor.access === 'readonly'} className="min-w-0">
          <SocialFields values={values} onChange={update} />
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
  id,
  title,
  count,
  defaultOpen = false,
  first = false,
  children,
}: {
  id?: string;
  title: string;
  count?: number;
  defaultOpen?: boolean;
  /** Drops the extra top gap for the first section in the sidebar. */
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible
      id={id}
      defaultOpen={defaultOpen}
      className={cn('scroll-mt-6', first ? 'pt-4' : 'pt-6')}
    >
      <CollapsibleTrigger className="group text-muted-foreground hover:text-foreground flex w-full items-center gap-1 text-xs font-medium">
        <ChevronRightIcon
          aria-hidden
          className="size-3.5 transition-transform duration-150 group-data-[panel-open]:rotate-90 motion-reduce:transition-none"
        />
        {title}
        {count !== undefined && <span className="ml-auto tabular-nums">{count}</span>}
      </CollapsibleTrigger>
      {/* Height animates from Base UI's measured panel height; instant with reduced motion. */}
      <CollapsibleContent className={COLLAPSIBLE_CONTENT}>
        <div className="pt-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
