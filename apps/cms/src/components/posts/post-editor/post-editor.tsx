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
import { useIsDesktop } from '@/components/editor-page/use-is-desktop';
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
import { PANE_GAP_MOTION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { PostEditorData } from '@/server/posts';
import { DocumentEditorSkeleton } from './document-editor-skeleton';
import { EditorToolbar } from './editor-toolbar';
import type { PostAccess } from './post-access';
import { PresenceNotice, usePostPresence } from './post-presence';
import { PropertiesPanel } from './properties-panel';
import { RecoveryNotice } from './recovery-notice';
import {
  ResizablePanel,
  ResizablePanels,
} from '@/components/arc/resizable-panels/resizable-panels';
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
  reveal = false,
  onReload,
}: {
  data: PostEditorData;
  /** A sidebar section to open and scroll to on arrival. */
  focus?: 'seo' | 'image';
  access: PostAccess;
  /** Plays the page's arrival animation; the route turns it off once it has played. */
  reveal?: boolean;
  onReload: () => Promise<void>;
}) {
  const editor = usePostEditor({ data, access, onReload });
  const presence = usePostPresence(editor.meta.id, editor.meta.updatedAt);
  const [showProperties, setShowProperties] = useState(true);
  const desktop = useIsDesktop();
  const { values, update } = editor;

  if (editor.meta.trashed && editor.meta.id) return <TrashedPost editor={editor} />;

  return (
    <div
      data-slot="post-editor"
      data-revealing={reveal || undefined}
      className="flex flex-1 flex-col"
    >
      <ResizablePanels
        label="Editor and properties"
        className={cn(
          'flex-1',
          // Below lg the panel sits under the editor, as before: the group stacks and its
          // divider goes. From lg, hiding the panel also hides the divider.
          'max-lg:block! max-lg:[&>*+*]:mt-6 max-lg:[&>[role=separator]]:hidden',
          // The panel slides shut on its own, so the divider and its restore tab have no job
          // once it has: the toolbar button brings it back.
          !showProperties && '[&>[role=separator]]:hidden'
        )}
      >
        <ResizablePanel
          id="post-editor-main"
          label="Editor"
          defaultSize={76}
          minSize={420}
          className="max-lg:max-w-none!"
        >
          <div
            data-slot="post-editor-main"
            className={cn(
              'bg-muted/50 flex min-w-0 flex-col overflow-hidden rounded-lg lg:h-[calc(100svh-7.5rem)]',
              // The gap closes with the panel, on the same curve, so the card does not jump.
              PANE_GAP_MOTION,
              showProperties && 'lg:mr-6'
            )}
          >
            <PresenceNotice
              presence={presence}
              dirty={editor.dirty}
              onReload={() => void onReload()}
            />
            <RecoveryNotice recovery={editor.recovery} />
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
        </ResizablePanel>

        <ResizablePanel
          id="post-properties-pane"
          label="Properties"
          defaultSize={24}
          minSize={240}
          maxSize={560}
          // Slides shut and open with the toolbar button, only on lg and up: below that the panel
          // sits under the editor and has no toggle. Dragging it shut keeps the button in step.
          collapsible
          collapsed={!showProperties && desktop}
          onCollapsedChange={(collapsed) => setShowProperties(!collapsed)}
          className="max-lg:max-w-none!"
        >
          <aside
            id="post-properties"
            className={cn(
              // From lg it matches the editor's height and scrolls on its own, so a long
              // panel never drags the editor with it. No visible bar, like the app sidebar.
              'text-ui lg:no-scrollbar min-w-0 space-y-6 lg:h-[calc(100svh-7.5rem)] lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain lg:pb-6 lg:pl-6'
            )}
          >
            <PropertiesPanel editor={editor} focus={focus} />
          </aside>
        </ResizablePanel>
      </ResizablePanels>

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
            <AlertDialogAction variant="destructive" onClick={editor.leave}>
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
