import {
  type PostInput,
  type Role,
  SEO_DESCRIPTION_LIMIT,
  SEO_TITLE_LIMIT,
  can,
  emptyPostInput,
  publishErrors,
  slugify,
} from '@llf/content';
import { ClientOnly, Link, useBlocker, useNavigate, useRouter } from '@tanstack/react-router';
import {
  CalendarClockIcon,
  CheckIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  FolderIcon,
  GlobeIcon,
  LinkIcon,
  type LucideIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SendIcon,
  TagIcon,
  Trash2Icon,
  Undo2Icon,
  UserIcon,
} from '@/components/icons';
import { type ReactNode, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, formatRelative } from '@/lib/format';
import { readableError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import {
  type PostEditorData,
  createCategory,
  discardChanges,
  getRevision,
  publishPost,
  requestReview,
  savePostSeo,
  restorePosts,
  savePost,
  schedulePost,
  trashPosts,
  unpublishPost,
  unschedulePost,
} from '@/server/posts';
import { PostStatusBadge } from './post-status-badge';
import { SchedulePopover } from './schedule-popover';
import { clearPostPreviews } from './use-post-preview';

// Browser only: the editor has nothing to server-render, and keeping
// ProseMirror out of the server bundle avoids loading it twice in dev.
const DocumentEditor = lazy(() =>
  import('./document-editor').then((m) => ({ default: m.DocumentEditor }))
);

const SITE_HOST = 'livinglegacyforest.com.au';

type Meta = {
  id: string | null;
  status: 'draft' | 'published';
  hasDraft: boolean;
  updatedAt: number | undefined;
  publishedAt: number | null;
  trashed: boolean;
  /** When this draft is due to publish itself; null if not scheduled. */
  scheduledAt: number | null;
  /** When an author asked for review; publishing clears it. */
  reviewRequestedAt: number | null;
};

type Option = { id: string; name: string };

const errorMessage = readableError;

/**
 * Create and edit form for a post. Remount it (change its `key`) to reload
 * from the server, for example after discarding changes.
 */
/**
 * What the signed-in person may do here. `full` edits and publishes; `author`
 * edits and submits for review; `seo` changes only the search listing;
 * `readonly` looks.
 */
export type PostAccess = 'full' | 'author' | 'seo' | 'readonly';

/** Access for a person on a post; `createdBy` is null for a new post. */
export function postAccessFor(
  user: { id: string; role: Role },
  createdBy: string | null
): PostAccess {
  if (can(user.role, 'posts:publish')) return 'full';
  if (can(user.role, 'posts:write') && (createdBy === null || createdBy === user.id)) {
    return 'author';
  }
  return can(user.role, 'seo:write') ? 'seo' : 'readonly';
}

export function PostEditor({
  data,
  access,
  onReload,
}: {
  data: PostEditorData;
  access: PostAccess;
  onReload: () => Promise<void>;
}) {
  const contentLocked = access === 'seo' || access === 'readonly';
  const router = useRouter();
  const navigate = useNavigate();
  const initial = data.post?.values ?? emptyPostInput;

  const [values, setValues] = useState<PostInput>(initial);
  const [saved, setSaved] = useState<PostInput>(initial);
  const [meta, setMeta] = useState<Meta>({
    id: data.post?.id ?? null,
    status: data.post?.status ?? 'draft',
    hasDraft: data.post?.hasDraft ?? false,
    updatedAt: data.post?.updatedAt,
    publishedAt: data.post?.publishedAt ?? null,
    trashed: data.post?.trashed ?? false,
    scheduledAt: data.post?.scheduledAt ?? null,
    reviewRequestedAt: data.post?.reviewRequestedAt ?? null,
  });
  // The permalink follows the title until it is edited by hand or the post goes live.
  const [slugTouched, setSlugTouched] = useState(
    meta.status === 'published' || (data.post !== null && initial.slug !== slugify(initial.title))
  );
  const [bodyKey, setBodyKey] = useState(0);
  const [categories, setCategories] = useState<Option[]>(data.categories);
  const [busy, setBusy] = useState<null | 'save' | 'publish' | 'other'>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(data.post?.updatedAt ?? null);

  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const skipBlockRef = useRef(false);

  const blocker = useBlocker({
    shouldBlockFn: () => dirtyRef.current && !skipBlockRef.current,
    enableBeforeUnload: () => dirtyRef.current,
    withResolver: true,
  });

  const update = (patch: Partial<PostInput>) => setValues((v) => ({ ...v, ...patch }));
  const setTitle = (title: string) =>
    update(slugTouched ? { title } : { title, slug: slugify(title) });

  /** Saves or publishes; resolves to the post ID, or null if it failed. */
  async function persist(
    kind: 'save' | 'publish',
    { quiet = false }: { quiet?: boolean } = {}
  ): Promise<string | null> {
    if (kind === 'publish') {
      const errors = publishErrors(values);
      if (errors.length) {
        toast.error(errors.join(' '));
        return null;
      }
    }
    setBusy(kind);
    try {
      const fn = kind === 'publish' ? publishPost : savePost;
      const result = await fn({
        data: { id: meta.id ?? undefined, values, expectedUpdatedAt: meta.updatedAt },
      });
      clearPostPreviews();
      // The server may adjust the permalink to keep it unique.
      const next = { ...values, slug: result.slug };
      setValues(next);
      setSaved(next);
      setLastSavedAt(result.updatedAt);
      setMeta((m) => ({
        ...m,
        id: result.id,
        updatedAt: result.updatedAt,
        status: kind === 'publish' ? 'published' : m.status,
        hasDraft: kind === 'save' && m.status === 'published',
        publishedAt: kind === 'publish' ? (m.publishedAt ?? result.updatedAt) : m.publishedAt,
        scheduledAt: kind === 'publish' ? null : m.scheduledAt,
        reviewRequestedAt: kind === 'publish' ? null : m.reviewRequestedAt,
      }));
      if (kind === 'publish') setSlugTouched(true);

      if (!quiet) {
        toast.success(
          kind === 'publish'
            ? meta.status === 'published'
              ? 'Post updated.'
              : meta.scheduledAt
                ? 'Post published now. The schedule was cleared.'
                : 'Post published.'
            : meta.status === 'published'
              ? 'Changes saved. They go live when you update the post.'
              : 'Draft saved.'
        );
      }

      if (!meta.id) {
        skipBlockRef.current = true;
        await navigate({ to: '/posts/$postId', params: { postId: result.id }, replace: true });
      } else {
        await router.invalidate();
      }
      return result.id;
    } catch (error) {
      toast.error(errorMessage(error));
      return null;
    } finally {
      setBusy(null);
    }
  }

  /** Saves the current values and schedules the post; true on success. */
  async function schedule(at: number): Promise<boolean> {
    const errors = publishErrors(values);
    if (errors.length) {
      toast.error(errors.join(' '));
      return false;
    }
    setBusy('publish');
    try {
      const result = await schedulePost({
        data: {
          id: meta.id ?? undefined,
          values,
          expectedUpdatedAt: meta.updatedAt,
          scheduledAt: at,
        },
      });
      clearPostPreviews();
      const next = { ...values, slug: result.slug };
      setValues(next);
      setSaved(next);
      setLastSavedAt(result.updatedAt);
      setMeta((m) => ({
        ...m,
        id: result.id,
        updatedAt: result.updatedAt,
        scheduledAt: result.scheduledAt,
      }));
      toast.success(`Scheduled for ${formatDateTime(result.scheduledAt)}.`);
      if (!meta.id) {
        skipBlockRef.current = true;
        await navigate({ to: '/posts/$postId', params: { postId: result.id }, replace: true });
      } else {
        await router.invalidate();
      }
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function unschedule() {
    if (!meta.id) return;
    try {
      const result = await unschedulePost({ data: { id: meta.id } });
      clearPostPreviews();
      setMeta((m) => ({ ...m, scheduledAt: null, updatedAt: result.updatedAt }));
      toast.success('Unscheduled. The post is a draft again.');
      await router.invalidate();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  /** Opens the preview in a new tab, saving unsaved changes first. */
  async function preview() {
    // Open synchronously so the browser treats it as a user action, not a popup.
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    const canSave = access === 'full' || access === 'author';
    const id = canSave && (dirty || !meta.id) ? await persist('save', { quiet: true }) : meta.id;
    if (!id) {
      tab?.close();
      return;
    }
    if (tab) tab.location.href = `/preview/posts/${id}`;
    else toast.error('Allow pop-ups for this site to open the preview.');
  }

  async function other(
    action: () => Promise<unknown>,
    success: string,
    after?: () => Promise<void>
  ) {
    setBusy('other');
    try {
      await action();
      clearPostPreviews();
      toast.success(success);
      await (after ? after() : onReload());
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  /** Saves if needed, then hands the post to an editor. */
  async function submitForReview() {
    const id = dirty || !meta.id ? await persist('save', { quiet: true }) : meta.id;
    if (!id) return;
    setBusy('other');
    try {
      const result = await requestReview({ data: { id } });
      setMeta((m) => ({ ...m, ...result }));
      toast.success('Sent for review. An editor will check it and publish it.');
      await router.invalidate();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function saveSeo() {
    if (!meta.id) return;
    setBusy('save');
    try {
      const { seoTitle, seoDescription, noindex } = values;
      const result = await savePostSeo({
        data: { id: meta.id, seoTitle, seoDescription, noindex, expectedUpdatedAt: meta.updatedAt },
      });
      setSaved((s) => ({ ...s, seoTitle, seoDescription, noindex }));
      setMeta((m) => ({ ...m, updatedAt: result.updatedAt }));
      setLastSavedAt(result.updatedAt);
      toast.success(
        meta.status === 'published'
          ? 'Search listing updated on the live post.'
          : 'Search listing saved.'
      );
      await router.invalidate();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function loadRevision(id: string) {
    try {
      const revision = await getRevision({ data: { id } });
      setValues(revision);
      setSlugTouched(true);
      setBodyKey((k) => k + 1);
      toast.success(
        meta.status === 'published'
          ? 'Revision loaded. Update the post to make it live.'
          : 'Revision loaded. Save to keep it.'
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function addCategory(name: string) {
    try {
      const category = await createCategory({ data: { name } });
      setCategories((list) =>
        list.some((c) => c.id === category.id)
          ? list
          : [...list, category].sort((a, b) => a.name.localeCompare(b.name))
      );
      setValues((v) => ({ ...v, categoryIds: [...new Set([...v.categoryIds, category.id])] }));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  // Cmd/Ctrl+S saves.
  const persistRef = useRef(persist);
  persistRef.current = persist;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (dirtyRef.current) void persistRef.current('save');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isLive = meta.status === 'published';
  const working = busy !== null;
  const saveState = dirty
    ? 'Unsaved changes'
    : lastSavedAt
      ? `Saved ${formatRelative(lastSavedAt)}`
      : 'Not saved yet';

  if (meta.trashed && meta.id) {
    const id = meta.id;
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Trash2Icon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{values.title || 'Untitled'} is in the trash</EmptyTitle>
          <EmptyDescription>Restore it as a draft to keep editing.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button
            variant="outline"
            size="sm"
            render={<Link to="/posts" search={{ status: 'trash' }} />}
            nativeButton={false}
          >
            Go to the trash
          </Button>
          <Button
            size="sm"
            disabled={working}
            onClick={() =>
              other(() => restorePosts({ data: { ids: [id] } }), 'Post restored as a draft.')
            }
          >
            Restore
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-0">
      <div className="bg-background flex min-w-0 flex-col overflow-hidden rounded-lg border lg:mr-6 lg:h-[calc(100svh-7.5rem)]">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
          <PostStatusBadge
            status={meta.status}
            hasDraft={meta.hasDraft}
            inReview={meta.reviewRequestedAt !== null}
            scheduledAt={meta.scheduledAt}
            showDate
            className="text-foreground text-[13px]"
          />
          <span className="text-muted-foreground text-xs" aria-live="polite">
            {saveState}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {access === 'full' ? (
              <>
                {meta.hasDraft && !dirty && meta.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={working}
                    onClick={() =>
                      other(
                        () => discardChanges({ data: { id: meta.id as string } }),
                        'Changes discarded.'
                      )
                    }
                  >
                    <Undo2Icon aria-hidden data-icon="inline-start" />
                    Discard changes
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={working || (!dirty && meta.id !== null)}
                  onClick={() => persist('save')}
                >
                  {busy === 'save' ? (
                    <>
                      <Spinner data-icon="inline-start" />
                      Saving…
                    </>
                  ) : isLive ? (
                    'Save changes'
                  ) : (
                    'Save draft'
                  )}
                </Button>
                <div className="flex">
                  <Button
                    size="sm"
                    disabled={working || (isLive && !dirty && !meta.hasDraft)}
                    onClick={() => persist('publish')}
                    className={cn(!isLive && 'rounded-r-none')}
                  >
                    {busy === 'publish' ? (
                      <>
                        <Spinner data-icon="inline-start" />
                        Publishing…
                      </>
                    ) : (
                      <>
                        <SendIcon aria-hidden data-icon="inline-start" />
                        {isLive ? 'Update' : meta.scheduledAt ? 'Publish now' : 'Publish'}
                      </>
                    )}
                  </Button>
                  {!isLive && (
                    <SchedulePopover
                      scheduledAt={meta.scheduledAt}
                      disabled={working}
                      onSchedule={schedule}
                      onUnschedule={unschedule}
                    />
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}
                  >
                    <MoreHorizontalIcon aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem disabled={working} onClick={preview}>
                      <EyeIcon aria-hidden />
                      Preview
                    </DropdownMenuItem>
                    {isLive && (
                      <DropdownMenuItem
                        disabled={working}
                        onClick={() =>
                          other(
                            () => unpublishPost({ data: { id: meta.id as string } }),
                            'Post unpublished. It is a draft again.'
                          )
                        }
                      >
                        <EyeOffIcon aria-hidden />
                        Unpublish
                      </DropdownMenuItem>
                    )}
                    {meta.id && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={working}
                          onClick={() =>
                            other(
                              () => trashPosts({ data: { ids: [meta.id as string] } }),
                              'Post moved to the trash.',
                              async () => {
                                skipBlockRef.current = true;
                                await navigate({ to: '/posts' });
                              }
                            )
                          }
                        >
                          <Trash2Icon aria-hidden />
                          Move to trash
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                {access === 'author' && meta.hasDraft && !dirty && meta.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={working}
                    onClick={() =>
                      other(
                        () => discardChanges({ data: { id: meta.id as string } }),
                        'Changes discarded.'
                      )
                    }
                  >
                    <Undo2Icon aria-hidden data-icon="inline-start" />
                    Discard changes
                  </Button>
                )}
                {access === 'readonly' && (
                  <span className="text-muted-foreground px-2 text-xs">Read only</span>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Preview"
                  disabled={working || !meta.id}
                  onClick={preview}
                >
                  <EyeIcon aria-hidden />
                </Button>
                {access === 'author' && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={working || (!dirty && meta.id !== null)}
                      onClick={() => persist('save')}
                    >
                      {busy === 'save' ? (
                        <>
                          <Spinner data-icon="inline-start" />
                          Saving…
                        </>
                      ) : (
                        'Save draft'
                      )}
                    </Button>
                    <Button
                      size="sm"
                      disabled={working || (meta.reviewRequestedAt !== null && !dirty)}
                      onClick={submitForReview}
                    >
                      <SendIcon aria-hidden data-icon="inline-start" />
                      {meta.reviewRequestedAt !== null && !dirty
                        ? 'Submitted for review'
                        : 'Submit for review'}
                    </Button>
                  </>
                )}
                {access === 'seo' && (
                  <Button size="sm" disabled={working || !dirty || !meta.id} onClick={saveSeo}>
                    {busy === 'save' ? (
                      <>
                        <Spinner data-icon="inline-start" />
                        Saving…
                      </>
                    ) : (
                      'Save search listing'
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
        </header>

        <div className="min-h-[32rem] flex-1 lg:min-h-0">
          <ClientOnly fallback={<EditorFallback />}>
            <Suspense fallback={<EditorFallback />}>
              <DocumentEditor
                key={bodyKey}
                title={values.title}
                onTitleChange={setTitle}
                excerpt={values.excerpt}
                onExcerptChange={(excerpt) => update({ excerpt })}
                body={values.body}
                onBodyChange={(body) => update({ body })}
                readOnly={contentLocked}
              />
            </Suspense>
          </ClientOnly>
        </div>
      </div>

      <aside className="space-y-6 text-[13px] lg:sticky lg:top-6 lg:self-start lg:border-l lg:pl-6">
        {/* A disabled fieldset locks every picker inside for SEO and read-only access. */}
        <fieldset disabled={contentLocked} className="min-w-0 space-y-0.5 disabled:opacity-70">
          <h2 className="text-muted-foreground mb-2 text-xs font-medium">Properties</h2>
          <Property label="Author" icon={UserIcon}>
            <SinglePicker
              label="Author"
              options={data.authors}
              value={values.authorId}
              placeholder="No author"
              onChange={(authorId) => update({ authorId })}
            />
          </Property>
          <Property label="Categories" icon={FolderIcon}>
            <MultiPicker
              label="Categories"
              options={categories}
              selected={values.categoryIds}
              placeholder="Add categories"
              onChange={(categoryIds) => update({ categoryIds })}
              onCreate={addCategory}
            />
          </Property>
          <Property label="Tags" icon={TagIcon}>
            <MultiPicker
              label="Tags"
              options={tagOptions(data.tags, values.tags)}
              selected={values.tags}
              placeholder="Add tags"
              onChange={(tags) => update({ tags })}
              onCreate={async (name) => update({ tags: [...values.tags, name] })}
            />
          </Property>
          <Property label="URL" icon={LinkIcon}>
            <UrlPicker
              slug={values.slug}
              liveSlug={isLive ? saved.slug : null}
              onChange={(slug) => {
                setSlugTouched(true);
                update({ slug });
              }}
            />
          </Property>
          {meta.scheduledAt && (
            <Property label="Goes live" icon={CalendarClockIcon}>
              <span className="px-2">{formatDateTime(meta.scheduledAt)}</span>
            </Property>
          )}
          {meta.publishedAt && (
            <Property label="Published" icon={GlobeIcon}>
              <span className="text-muted-foreground px-2">{formatDateTime(meta.publishedAt)}</span>
            </Property>
          )}
        </fieldset>

        <Section title="Search listing">
          <fieldset disabled={access === 'readonly'} className="min-w-0">
            <SeoFields values={values} onChange={update} />
          </fieldset>
        </Section>

        {data.revisions.length > 0 && (
          <Section title="Revisions" count={data.revisions.length}>
            <ul className="space-y-0.5">
              {data.revisions.map((revision, index) => (
                <li
                  key={revision.id}
                  className="hover:bg-accent flex min-h-8 items-center justify-between gap-2 rounded-md px-2"
                >
                  <span className="min-w-0 truncate">
                    {formatDateTime(revision.createdAt)}
                    <span className="text-muted-foreground"> · {revision.by}</span>
                  </span>
                  {index === 0 ? (
                    <span className="text-muted-foreground text-xs">Live</span>
                  ) : contentLocked ? null : (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-muted-foreground h-6"
                      onClick={() => loadRevision(revision.id)}
                    >
                      Restore
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </aside>

      <AlertDialog open={blocker.status === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              Your unsaved changes to this post will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => blocker.proceed?.()}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditorFallback() {
  return <div className="bg-muted/50 ml-8 h-64 animate-pulse rounded-md" />;
}

/** Tags are stored by name; existing and assigned ones form the option list. */
function tagOptions(existing: string[], assigned: string[]): Option[] {
  return [...new Set([...existing, ...assigned])]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ id: name, name }));
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
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Collapsible className="border-t pt-4">
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

/** Compact empty state for the property pickers. */
function PickerEmpty() {
  return (
    <Empty className="gap-1 p-4">
      <EmptyHeader className="gap-1">
        <EmptyTitle className="text-[13px]">No matches</EmptyTitle>
        <EmptyDescription className="text-xs">Try a different name.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

const valueButtonClass =
  'h-7 w-full justify-start gap-1.5 px-2 text-[13px] font-normal hover:bg-accent data-[popup-open]:bg-accent';

function Chips({ names, placeholder }: { names: string[]; placeholder: string }) {
  if (names.length === 0) return <span className="text-muted-foreground">{placeholder}</span>;
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {names.map((name) => (
        <span key={name} className="bg-muted truncate rounded px-1.5 py-px text-xs">
          {name}
        </span>
      ))}
    </span>
  );
}

function MultiPicker({
  label,
  options,
  selected,
  placeholder,
  onChange,
  onCreate,
}: {
  label: string;
  options: Option[];
  selected: string[];
  placeholder: string;
  onChange: (ids: string[]) => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const query = search.trim();
  const exists = options.some((o) => o.name.toLowerCase() === query.toLowerCase());
  const names = options.filter((o) => selected.includes(o.id)).map((o) => o.name);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <Popover onOpenChange={(open) => !open && setSearch('')}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            className={cn(valueButtonClass, names.length > 0 && 'h-auto min-h-7 py-1')}
            aria-label={`${label}: ${names.join(', ') || 'none'}`}
          />
        }
      >
        <Chips names={names} placeholder={placeholder} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <Command>
          <CommandInput
            placeholder={`Find or create ${label.toLowerCase()}…`}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="p-0">
              <PickerEmpty />
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem key={option.id} value={option.name} onSelect={() => toggle(option.id)}>
                  <CheckIcon
                    aria-hidden
                    className={cn(
                      'size-3.5',
                      selected.includes(option.id) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.name}
                </CommandItem>
              ))}
              {query && !exists && (
                <CommandItem
                  value={`create ${query}`}
                  onSelect={async () => {
                    await onCreate(query);
                    setSearch('');
                  }}
                >
                  <PlusIcon aria-hidden className="size-3.5" />
                  Create “{query}”
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SinglePicker({
  label,
  options,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  options: Option[];
  value: string | null;
  placeholder: string;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            className={valueButtonClass}
            aria-label={`${label}: ${current?.name ?? 'none'}`}
          />
        }
      >
        {current ? (
          <span className="truncate">{current.name}</span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <Command>
          <CommandInput placeholder={`Find ${label.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty className="p-0">
              <PickerEmpty />
            </CommandEmpty>
            <CommandGroup>
              {[{ id: '', name: placeholder }, ...options].map((option) => (
                <CommandItem
                  key={option.id || 'none'}
                  value={option.name}
                  onSelect={() => {
                    onChange(option.id || null);
                    setOpen(false);
                  }}
                >
                  <CheckIcon
                    aria-hidden
                    className={cn(
                      'size-3.5',
                      (value ?? '') === option.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function UrlPicker({
  slug,
  liveSlug,
  onChange,
}: {
  slug: string;
  liveSlug: string | null;
  onChange: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(slug);
  const changed = liveSlug !== null && slug !== liveSlug;
  const commit = () => {
    onChange(slugify(draft));
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(slug);
        setOpen(next);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            className={valueButtonClass}
            aria-label={`URL: /blog/${slug || ''}`}
          />
        }
      >
        <span className="truncate">
          <span className="text-muted-foreground">/blog/</span>
          {slug || <span className="text-muted-foreground">…</span>}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="post-slug" className="text-xs">
            Permalink
          </Label>
          <Input
            id="post-slug"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
            }}
            className="h-8"
          />
          <p className="text-muted-foreground truncate text-xs">
            {SITE_HOST}/blog/{slugify(draft) || '…'}
          </p>
        </div>
        {(changed || (liveSlug !== null && slugify(draft) !== liveSlug)) && (
          <p className="text-muted-foreground text-xs">
            The old link /blog/{liveSlug} will redirect here once you update the post.
          </p>
        )}
        <div className="flex justify-end">
          <Button size="sm" onClick={commit}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SeoFields({
  values,
  onChange,
}: {
  values: PostInput;
  onChange: (patch: Partial<PostInput>) => void;
}) {
  const title = values.seoTitle || values.title || 'Post title';
  const description = values.seoDescription || values.excerpt;

  return (
    <div className="space-y-4">
      <div className="space-y-0.5 rounded-md border p-3">
        <p className="text-muted-foreground truncate text-xs">
          {SITE_HOST} › blog › {values.slug || '…'}
        </p>
        <p className="line-clamp-2 font-medium">{title}</p>
        <p className="text-muted-foreground line-clamp-2 text-xs">
          {description || 'Add a summary or description to control this text.'}
        </p>
      </div>
      <CountedField
        id="seo-title"
        label="Title"
        value={values.seoTitle}
        limit={SEO_TITLE_LIMIT}
        placeholder={values.title}
        onChange={(seoTitle) => onChange({ seoTitle })}
      />
      <CountedField
        id="seo-description"
        label="Description"
        value={values.seoDescription}
        limit={SEO_DESCRIPTION_LIMIT}
        placeholder={values.excerpt || 'Summarise the post in a sentence or two.'}
        multiline
        onChange={(seoDescription) => onChange({ seoDescription })}
      />
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="seo-noindex" className="text-[13px] font-normal">
          Hide from search engines
        </Label>
        <Switch
          id="seo-noindex"
          aria-label="Hide from search engines"
          checked={values.noindex}
          onCheckedChange={(noindex) => onChange({ noindex })}
        />
      </div>
    </div>
  );
}

function CountedField({
  id,
  label,
  value,
  limit,
  placeholder,
  multiline = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  limit: number;
  placeholder?: string;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  const over = value.length > limit;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-muted-foreground text-xs font-normal">
          {label}
        </Label>
        <span
          className={cn('text-muted-foreground text-xs tabular-nums', over && 'text-destructive')}
        >
          {value.length}/{limit}
        </span>
      </div>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          placeholder={placeholder}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          className="text-[13px]"
        />
      ) : (
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-[13px]"
        />
      )}
    </div>
  );
}
