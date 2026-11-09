import { type PostInput, emptyPostInput, publishErrors, slugify } from '@ll/content';
import { useBlocker, useNavigate, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { type Notice, notify } from '@/lib/notify';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import {
  type PostEditorData,
  createCategory,
  discardChanges,
  duplicatePost,
  getRevision,
  publishPost,
  requestReview,
  restorePosts,
  savePost,
  savePostSeo,
  schedulePost,
  trashPosts,
  unpublishPost,
  unschedulePost,
} from '@/server/posts';
import { clearPostPreviews } from '../use-post-preview';
import { docxToBody } from './import-docx';
import type { PostAccess } from './post-access';
import type { Option } from './property-pickers';

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

export type PostEditorState = ReturnType<typeof usePostEditor>;

/**
 * Everything the post editor knows and can do: the form values, what the
 * server last saved, and every action from Save to Move to trash. The
 * components only render it.
 */
export function usePostEditor({
  data,
  access,
  onReload,
}: {
  data: PostEditorData;
  access: PostAccess;
  onReload: () => Promise<void>;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const timeZone = useTimeZone();
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
  // Bumped to remount the body editor when its content is replaced wholesale.
  const [bodyKey, setBodyKey] = useState(0);
  const [categories, setCategories] = useState<Option[]>(data.categories);
  const [busy, setBusy] = useState<null | 'save' | 'publish' | 'other'>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(data.post?.updatedAt ?? null);
  const [importingDocx, setImportingDocx] = useState(false);

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
  const setSlug = (slug: string) => {
    setSlugTouched(true);
    update({ slug });
  };

  /** The next navigation skips the unsaved-changes prompt. */
  const allowLeaving = () => {
    skipBlockRef.current = true;
  };

  /** The server's copy is now the saved one. It may have changed the permalink to keep it unique. */
  function markSaved(slug: string, updatedAt: number) {
    clearPostPreviews();
    const next = { ...values, slug };
    setValues(next);
    setSaved(next);
    setLastSavedAt(updatedAt);
  }

  /** A new post moves to its own URL; an existing one reloads. */
  async function refresh(id: string) {
    if (meta.id) return router.invalidate();
    allowLeaving();
    await navigate({ to: '/posts/$postId', params: { postId: id }, replace: true });
  }

  /** Publishing needs a title, body and so on; says what is missing. */
  function readyToPublish() {
    const errors = publishErrors(values);
    if (errors.length) notify.error('Not ready to publish', errors.join(' '));
    return errors.length === 0;
  }

  /** Saves or publishes; resolves to the post ID, or null if it failed. */
  async function persist(
    kind: 'save' | 'publish',
    { quiet = false }: { quiet?: boolean } = {}
  ): Promise<string | null> {
    if (kind === 'publish' && !readyToPublish()) return null;
    setBusy(kind);
    try {
      const fn = kind === 'publish' ? publishPost : savePost;
      const result = await fn({
        data: { id: meta.id ?? undefined, values, expectedUpdatedAt: meta.updatedAt },
      });
      markSaved(result.slug, result.updatedAt);
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
        notify.success(
          kind === 'publish'
            ? meta.status === 'published'
              ? { title: 'Changes published', description: 'They are live on the website.' }
              : meta.scheduledAt
                ? {
                    title: 'Post published',
                    description: 'It is live now, and the schedule was cleared.',
                  }
                : { title: 'Post published', description: 'It is live on the website.' }
            : meta.status === 'published'
              ? {
                  title: 'Draft saved',
                  description: 'The live post stays as it is until you publish the changes.',
                }
              : { title: 'Draft saved', description: 'Only people in the CMS can see it.' }
        );
      }
      await refresh(result.id);
      return result.id;
    } catch (error) {
      notify.error(kind === 'publish' ? 'Could not publish' : 'Could not save', error);
      return null;
    } finally {
      setBusy(null);
    }
  }

  /** Saves the current values and schedules the post; true on success. */
  async function schedule(at: number): Promise<boolean> {
    if (!readyToPublish()) return false;
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
      markSaved(result.slug, result.updatedAt);
      setMeta((m) => ({
        ...m,
        id: result.id,
        updatedAt: result.updatedAt,
        scheduledAt: result.scheduledAt,
      }));
      notify.success({
        title: 'Post scheduled',
        description: `It goes live ${formatDateTime(result.scheduledAt, timeZone)}.`,
      });
      await refresh(result.id);
      return true;
    } catch (error) {
      notify.error('Could not schedule', error);
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
      notify.success({ title: 'Schedule cancelled', description: 'The post is a draft again.' });
      await router.invalidate();
    } catch (error) {
      notify.error('Could not cancel the schedule', error);
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
    else notify.error('Preview blocked', 'Allow pop-ups for this site to open the preview.');
  }

  /** Runs a server action on the saved post, then reloads it (or does `after`). */
  async function act(
    action: (id: string) => Promise<unknown>,
    success: Notice,
    failure: string,
    after?: () => Promise<void>
  ) {
    if (!meta.id) return;
    setBusy('other');
    try {
      await action(meta.id);
      clearPostPreviews();
      notify.success(success);
      await (after ? after() : onReload());
    } catch (error) {
      notify.error(failure, error);
    } finally {
      setBusy(null);
    }
  }

  const discard = () =>
    act(
      (id) => discardChanges({ data: { id } }),
      { title: 'Changes discarded', description: 'The post is back to its live version.' },
      'Could not discard the changes'
    );
  const unpublish = () =>
    act(
      (id) => unpublishPost({ data: { id } }),
      { title: 'Post unpublished', description: 'It is off the website and a draft again.' },
      'Could not unpublish'
    );
  const restore = () =>
    act(
      (id) => restorePosts({ data: { ids: [id] } }),
      {
        title: 'Post restored',
        description: 'It is a draft. Publish it when it is ready to go live.',
      },
      'Could not restore'
    );
  const trash = () => {
    const id = meta.id;
    if (!id) return;
    return act(
      () => trashPosts({ data: { ids: [id] } }),
      {
        title: 'Post moved to the trash',
        description: 'It waits in the trash as a draft and is not on the website.',
        action: { label: 'Undo', onClick: () => void undoTrash(id) },
      },
      'Could not move to the trash',
      async () => {
        allowLeaving();
        await navigate({ to: '/posts' });
      }
    );
  };

  /** Undo on the trash toast: restore the post and open it again. */
  async function undoTrash(id: string) {
    try {
      await restorePosts({ data: { ids: [id] } });
      clearPostPreviews();
      notify.success({
        title: 'Post restored',
        description: 'It is a draft. Publish it when it is ready to go live.',
      });
      await navigate({ to: '/posts/$postId', params: { postId: id } });
    } catch (error) {
      notify.error('Could not restore', error);
    }
  }

  /** Copies the post into a new draft and opens it. */
  async function duplicate() {
    if (!meta.id) return;
    setBusy('other');
    try {
      const result = await duplicatePost({ data: { id: meta.id } });
      notify.success({ title: 'Post duplicated', description: 'You are now editing the copy.' });
      allowLeaving();
      await navigate({ to: '/posts/$postId', params: { postId: result.id } });
    } catch (error) {
      notify.error('Could not duplicate', error);
    } finally {
      setBusy(null);
    }
  }

  /** Saves if needed, then hands the post to a reviewer. */
  async function submitForReview(reviewerId: string | null): Promise<boolean> {
    const id = dirty || !meta.id ? await persist('save', { quiet: true }) : meta.id;
    if (!id) return false;
    setBusy('other');
    try {
      const result = await requestReview({ data: { id, reviewerId } });
      setMeta((m) => ({ ...m, ...result }));
      notify.success({
        title: 'Sent for review',
        description: reviewerId
          ? 'The reviewer was notified.'
          : 'Anyone who can publish was notified.',
      });
      await router.invalidate();
      return true;
    } catch (error) {
      notify.error('Could not send for review', error);
      return false;
    } finally {
      setBusy(null);
    }
  }

  /** Saves only the search listing, for people with SEO access. */
  async function saveSeo() {
    if (!meta.id) return;
    setBusy('save');
    try {
      const { seoTitle, seoDescription, noindex, ogMediaId, focusKeyword, relatedTerms } = values;
      const result = await savePostSeo({
        data: {
          id: meta.id,
          seoTitle,
          seoDescription,
          noindex,
          ogMediaId,
          focusKeyword,
          relatedTerms,
          expectedUpdatedAt: meta.updatedAt,
        },
      });
      setSaved((s) => ({
        ...s,
        seoTitle,
        seoDescription,
        noindex,
        ogMediaId,
        focusKeyword,
        relatedTerms,
      }));
      setMeta((m) => ({ ...m, updatedAt: result.updatedAt }));
      setLastSavedAt(result.updatedAt);
      notify.success({
        title: 'Search listing saved',
        description:
          meta.status === 'published'
            ? 'It is live on the post now.'
            : 'It goes live when the post is published.',
      });
      await router.invalidate();
    } catch (error) {
      notify.error('Could not save the search listing', error);
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
      notify.success({
        title: 'Revision loaded',
        description:
          meta.status === 'published'
            ? 'Publish the changes to make it live.'
            : 'Save the post to keep it.',
      });
    } catch (error) {
      notify.error('Could not load the revision', error);
    }
  }

  /** Replaces the body with a Word document's content, after asking. */
  async function importDocx(file: File) {
    if (values.body && !window.confirm(`Replace the current content with ${file.name}?`)) {
      return;
    }
    setImportingDocx(true);
    try {
      const { body, failedImages } = await docxToBody(file);
      update({ body });
      setBodyKey((k) => k + 1);
      notify.success({
        title: 'Document imported',
        description:
          failedImages > 0
            ? `${file.name} is in. ${failedImages} image${failedImages === 1 ? '' : 's'} could not be imported; add ${failedImages === 1 ? 'it' : 'them'} by hand.`
            : `${file.name} replaced the content. Save to keep it.`,
      });
    } catch {
      notify.error('Could not import', 'Make sure the file is a .docx document.');
    } finally {
      setImportingDocx(false);
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
      notify.error('Could not add the category', error);
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

  return {
    access,
    reviewers: data.reviewers,
    authors: data.authors,
    tags: data.tags,
    revisions: data.revisions,
    values,
    saved,
    meta,
    categories,
    bodyKey,
    dirty,
    busy,
    working: busy !== null,
    isLive: meta.status === 'published',
    /** SEO and read-only access can't change the content. */
    contentLocked: access === 'seo' || access === 'readonly',
    importingDocx,
    saveState: dirty
      ? 'Unsaved changes'
      : lastSavedAt
        ? `Saved ${formatRelative(lastSavedAt)}`
        : 'Not saved yet',
    blocker,
    update,
    setTitle,
    setSlug,
    save: () => persist('save'),
    publish: () => persist('publish'),
    schedule,
    unschedule,
    preview,
    discard,
    unpublish,
    restore,
    trash,
    duplicate,
    submitForReview,
    saveSeo,
    loadRevision,
    importDocx,
    addCategory,
  };
}
