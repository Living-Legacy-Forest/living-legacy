import type { LegalValues } from '@ll/content';
import { ClientOnly } from '@tanstack/react-router';
import { Suspense, lazy, useEffect, useState } from 'react';
import { DocumentEditorSkeleton } from '@/components/posts/post-editor/document-editor-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/format';
import { useAction } from '@/lib/use-action';
import { useTimeZone } from '@/lib/use-time-zone';
import {
  type LegalPageEditorData,
  discardLegalPageDraft,
  publishLegalPage,
  requestLegalPageReview,
  saveLegalPage,
} from '@/server/legal-pages';
import { LegalHistory } from './legal-history';

const DocumentEditor = lazy(() =>
  import('@/components/posts/post-editor/document-editor').then((m) => ({
    default: m.DocumentEditor,
  }))
);

export function LegalPageEditor({
  data,
  canPublish,
}: {
  data: LegalPageEditorData;
  canPublish: boolean;
}) {
  const timeZone = useTimeZone();
  const { run, pending } = useAction();
  const [values, setValues] = useState<LegalValues>(data.values);
  const [version, setVersion] = useState(data.updatedAt);
  const [dirty, setDirty] = useState(false);
  const update = (patch: Partial<LegalValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setDirty(true);
  };

  // Leaving with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // `quiet` when saving on the way to publishing or a review request, which
  // show their own message.
  async function save(quiet = false): Promise<number | undefined> {
    const result = await run(
      () => saveLegalPage({ data: { slug: data.slug, values, expectedUpdatedAt: version } }),
      {
        success: quiet
          ? undefined
          : {
              title: 'Changes saved',
              description: canPublish
                ? 'Publish them when they are ready to go live.'
                : 'They go live when an admin publishes them.',
            },
        error: 'Could not save the changes',
      }
    );
    if (result === undefined) return undefined;
    setVersion(result.updatedAt);
    setDirty(false);
    return result.updatedAt;
  }

  // Publishes what is on screen: unsaved edits are saved first.
  async function publish() {
    const current = dirty ? await save(true) : version;
    if (current === undefined) return;
    await run(() => publishLegalPage({ data: { slug: data.slug, expectedUpdatedAt: current } }), {
      success: { title: 'Published', description: 'The website shows this version now.' },
      error: 'Could not publish',
    });
  }

  async function askForReview() {
    if (dirty && (await save(true)) === undefined) return;
    await run(() => requestLegalPageReview({ data: { slug: data.slug } }), {
      success: {
        title: 'Review requested',
        description: 'Admins can see it in their notifications.',
      },
      error: 'Could not ask for a review',
    });
  }

  async function discard() {
    await run(() => discardLegalPageDraft({ data: { slug: data.slug } }), {
      success: {
        title: 'Changes discarded',
        description: 'The page is back to the published version.',
      },
      error: 'Could not discard the changes',
    });
  }

  const hasChanges = data.hasDraft || dirty;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 data-slot="page-title" className="mr-auto text-xl font-semibold">
            {data.values.title}
          </h1>
          <Button
            variant="outline"
            size="sm"
            render={<a href={`/preview/legal/${data.slug}`} target="_blank" rel="noreferrer" />}
          >
            Preview
          </Button>
          <Button variant="outline" size="sm" disabled={pending || !dirty} onClick={() => save()}>
            Save
          </Button>
          {canPublish ? (
            <>
              {data.hasDraft && (
                <Button variant="ghost" size="sm" disabled={pending} onClick={discard}>
                  Discard changes
                </Button>
              )}
              <Button size="sm" disabled={pending || !hasChanges} onClick={publish}>
                {pending ? <Spinner /> : null}
                Publish
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              disabled={pending || !hasChanges || data.reviewRequestedAt !== null}
              onClick={askForReview}
            >
              {pending ? <Spinner /> : null}
              {data.reviewRequestedAt ? 'Review requested' : 'Ask for review'}
            </Button>
          )}
        </div>
        <div className="bg-background min-h-[32rem] overflow-hidden rounded-lg border">
          <ClientOnly fallback={<DocumentEditorSkeleton />}>
            <Suspense fallback={<DocumentEditorSkeleton />}>
              <DocumentEditor
                title={values.title}
                onTitleChange={(title) => update({ title })}
                body={values.body}
                onBodyChange={(body) => update({ body })}
              />
            </Suspense>
          </ClientOnly>
        </div>
      </div>

      <aside className="text-ui min-w-0 space-y-6">
        <div className="space-y-1">
          {data.reviewRequestedAt ? (
            <Badge variant="secondary">Review requested</Badge>
          ) : hasChanges ? (
            <Badge variant="outline">Unpublished changes</Badge>
          ) : (
            <Badge variant="outline">Published</Badge>
          )}
          <p className="text-muted-foreground text-xs">
            {data.lastPublishedAt
              ? `Last updated ${formatDate(data.lastPublishedAt, timeZone)}`
              : 'Not published yet'}
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="legal-seo">Search description</Label>
          <Textarea
            id="legal-seo"
            rows={3}
            maxLength={300}
            value={values.seoDescription}
            onChange={(e) => update({ seoDescription: e.target.value })}
          />
        </div>
        <LegalHistory history={data.history} />
      </aside>
    </div>
  );
}
