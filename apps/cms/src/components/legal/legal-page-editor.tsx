import { type LegalValues, SEO_DESCRIPTION_LIMIT } from '@ll/content';
import { ClientOnly } from '@tanstack/react-router';
import { Suspense, lazy, useEffect, useState } from 'react';
import { DocumentEditorSkeleton } from '@/components/posts/post-editor/document-editor-skeleton';
import { CountedField, SITE_HOST } from '@/components/posts/post-editor/seo-fields';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAction } from '@/lib/use-action';
import {
  type LegalPageEditorData,
  discardLegalPageDraft,
  publishLegalPage,
  requestLegalPageReview,
  restoreLegalVersion,
  saveLegalPage,
} from '@/server/legal-pages';
import { LegalHistory } from './legal-history';
import { LegalStatus } from './legal-status';

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
        success: (r) =>
          r.reviewWithdrawn
            ? {
                title: 'Changes saved',
                description:
                  'The page changed, so the review request was withdrawn. Ask again when it is ready.',
              }
            : quiet
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
    await run(
      () => discardLegalPageDraft({ data: { slug: data.slug, expectedUpdatedAt: version } }),
      {
        success: {
          title: 'Changes discarded',
          description: 'The page is back to the published version.',
        },
        error: 'Could not discard the changes',
      }
    );
  }

  const hasChanges = data.hasDraft || dirty;

  async function restore(revisionId: string) {
    const result = await run(
      () =>
        restoreLegalVersion({
          data: { slug: data.slug, revisionId, expectedUpdatedAt: version },
        }),
      {
        success: {
          title: 'Version restored',
          description: 'It is now the draft. Check it, then publish it to make it live.',
        },
        error: 'Could not restore that version',
      }
    );
    if (result === undefined) return false;
    // The page reloads with the restored draft, so these edits are gone on purpose.
    setDirty(false);
    return true;
  }

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
        {/* Clip, not hidden: hidden would make a scroll box and stop the toolbar sticking. */}
        <div className="bg-background min-h-[32rem] overflow-clip rounded-lg border">
          <ClientOnly fallback={<DocumentEditorSkeleton />}>
            <Suspense fallback={<DocumentEditorSkeleton />}>
              <DocumentEditor
                title={values.title}
                onTitleChange={(title) => update({ title })}
                body={values.body}
                onBodyChange={(body) => update({ body })}
                pageScroll
              />
            </Suspense>
          </ClientOnly>
        </div>
      </div>

      <aside className="text-ui min-w-0 space-y-6">
        <LegalStatus data={data} dirty={dirty} />
        <section className="space-y-3" aria-labelledby="legal-search">
          <h2 id="legal-search" className="font-medium">
            In search results
          </h2>
          <div className="space-y-0.5 rounded-md border p-3">
            <p className="text-muted-foreground truncate text-xs">
              {SITE_HOST} › {data.slug}
            </p>
            <p className="line-clamp-2 font-medium">{values.title || 'Page title'}</p>
            <p className="text-muted-foreground line-clamp-2 text-xs">
              {values.seoDescription ||
                'Without a description, search engines pick text from the page.'}
            </p>
          </div>
          <CountedField
            id="legal-seo"
            label="Description"
            value={values.seoDescription}
            limit={SEO_DESCRIPTION_LIMIT}
            placeholder="What the page covers, in a sentence or two."
            multiline
            onChange={(seoDescription) => update({ seoDescription })}
          />
        </section>
        <LegalHistory
          history={data.history}
          restoreReplacesEdits={hasChanges}
          onRestore={restore}
        />
      </aside>
    </div>
  );
}
