/**
 * The post editor, split by job:
 *
 *   use-post-editor.ts    state and every action (save, publish, schedule, …)
 *   editor-toolbar.tsx    the bar above the post, by access level
 *   document-editor.tsx   title, summary and body (Tiptap), browser only
 *   properties-panel.tsx  author, categories, tags, URL, image, SEO, revisions
 *   post-access.ts        who may do what
 */
import { ClientOnly, Link } from '@tanstack/react-router';
import { Suspense, lazy, useState } from 'react';
import { Trash2Icon } from '@/components/icons';
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import type { PostEditorData } from '@/server/posts';
import { DocumentEditorSkeleton } from './document-editor-skeleton';
import { EditorToolbar } from './editor-toolbar';
import type { PostAccess } from './post-access';
import { PresenceNotice, usePostPresence } from './post-presence';
import { PropertiesPanel } from './properties-panel';
import { type PostEditorState, usePostEditor } from './use-post-editor';

// Browser only: the editor has nothing to server-render, and keeping
// ProseMirror out of the server bundle avoids loading it twice in dev.
const DocumentEditor = lazy(() =>
  import('./document-editor').then((m) => ({ default: m.DocumentEditor }))
);

/**
 * Create and edit form for a post. Remount it (change its `key`) to reload
 * from the server, for example after discarding changes.
 */
export function PostEditor({
  data,
  focus,
  access,
  onReload,
}: {
  data: PostEditorData;
  /** A sidebar section to open and scroll to on arrival. */
  focus?: 'seo' | 'image';
  access: PostAccess;
  onReload: () => Promise<void>;
}) {
  const editor = usePostEditor({ data, access, onReload });
  const presence = usePostPresence(editor.meta.id, editor.meta.updatedAt);
  const [showProperties, setShowProperties] = useState(true);
  const { values, update } = editor;

  if (editor.meta.trashed && editor.meta.id) return <TrashedPost editor={editor} />;

  return (
    <div
      className={cn(
        'grid flex-1 gap-6 lg:gap-0 lg:transition-[grid-template-columns] lg:duration-200 lg:ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:lg:transition-none',
        showProperties ? 'lg:grid-cols-[minmax(0,1fr)_17rem]' : 'lg:grid-cols-[minmax(0,1fr)_0rem]'
      )}
    >
      <div
        className={cn(
          'bg-background flex min-w-0 flex-col overflow-hidden rounded-lg border lg:h-[calc(100svh-7.5rem)] lg:transition-[margin-right] lg:duration-200 motion-reduce:lg:transition-none',
          showProperties && 'lg:mr-6'
        )}
      >
        <PresenceNotice presence={presence} dirty={editor.dirty} onReload={() => void onReload()} />
        <EditorToolbar
          editor={editor}
          showProperties={showProperties}
          onToggleProperties={() => setShowProperties((v) => !v)}
        />
        <div className="min-h-[24rem] flex-1 md:min-h-[32rem] lg:min-h-0">
          <ClientOnly fallback={<DocumentEditorSkeleton />}>
            <Suspense fallback={<DocumentEditorSkeleton />}>
              <DocumentEditor
                key={editor.bodyKey}
                title={values.title}
                onTitleChange={editor.setTitle}
                body={values.body}
                onBodyChange={(body) => update({ body })}
                readOnly={editor.contentLocked}
              />
            </Suspense>
          </ClientOnly>
        </div>
      </div>

      <aside
        id="post-properties"
        className={cn(
          // From lg it matches the editor's height and scrolls on its own, so a long
          // panel never drags the editor with it. No visible bar, like the app sidebar.
          'text-ui lg:no-scrollbar min-w-0 space-y-6 lg:sticky lg:top-6 lg:h-[calc(100svh-7.5rem)] lg:self-start lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain lg:pb-6 lg:transition-[padding] lg:duration-150 motion-reduce:lg:transition-none',
          // Hidden only on lg and up: below that the panel sits under the editor
          // and has no toggle.
          showProperties ? 'lg:border-l lg:pl-6' : 'lg:hidden'
        )}
      >
        <PropertiesPanel editor={editor} focus={focus} />
      </aside>

      <AlertDialog open={editor.blocker.status === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              Your unsaved changes to this post will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => editor.blocker.reset?.()}>
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => editor.blocker.proceed?.()}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Shown instead of the editor when the post is in the trash. */
function TrashedPost({ editor }: { editor: PostEditorState }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Trash2Icon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{editor.values.title || 'Untitled'} is in the trash</EmptyTitle>
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
        <Button size="sm" disabled={editor.working} onClick={editor.restore}>
          Restore
        </Button>
      </EmptyContent>
    </Empty>
  );
}
