import type { RichTextDoc } from '@ll/content';
import { Placeholder } from '@tiptap/extension-placeholder';
import { type Editor, useEditor, useEditorState } from '@tiptap/react';
import { useRef } from 'react';
import { RichTextEditor } from '@/components/editor';
import { TableHoverOverlay } from '@/components/extensions/table/table-hover-overlay';
import { CANVAS, SCROLLBAR } from '@/components/templates/simple-document-editor/constants';
import { ShortcutsPopover } from '@/components/templates/simple-document-editor/shortcuts';
import { Toolbar } from '@/components/templates/simple-document-editor/toolbar';
import { readState } from '@/components/templates/simple-document-editor/utils';
import { notify } from '@/lib/notify';
import { uploadMedia } from '@/lib/upload-media';
import { cn } from '@/lib/utils';
import { postContentExtensions } from '../post-extensions';

const imageFiles = (files: FileList | null | undefined) =>
  Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));

/** Uploads pasted or dropped images to Media, then puts them in the body. */
async function insertUploads(editor: Editor, files: File[], at?: number) {
  const one = files.length === 1;
  const id = notify.loading({
    title: one ? 'Uploading image' : `Uploading ${files.length} images`,
    description: `${one ? 'It is' : 'They are'} resized and added to the media library first.`,
  });
  try {
    for (const file of files) {
      const item = await uploadMedia(file);
      const pos = at ?? editor.state.selection.from;
      editor
        .chain()
        .focus()
        .insertContentAt(pos, { type: 'image', attrs: { src: item.url, alt: item.alt } })
        .run();
    }
    notify.success({
      id,
      title: one ? 'Image added' : 'Images added',
      description: `${one ? 'It is' : 'They are'} in the post and the media library.`,
    });
  } catch (error) {
    notify.error('Could not upload', error, { id });
  }
}

type Props = {
  title: string;
  onTitleChange: (title: string) => void;
  /** Read once on mount; remount with a new `key` to replace it. */
  body: RichTextDoc | null;
  onBodyChange: (body: RichTextDoc | null) => void;
  /** Show the post without letting it be changed (no toolbar, nothing editable). */
  readOnly?: boolean;
  /**
   * Grow with the text and let the page scroll, keeping the toolbar under the
   * header (legal pages). By default the editor fills its box and scrolls inside.
   */
  pageScroll?: boolean;
};

/**
 * Document-style post editor (editorcn toolbar editor): a floating toolbar
 * over a page that holds the title and body, with counts below. The summary
 * is edited in the side panel (Properties).
 */
export function DocumentEditor({
  title,
  onTitleChange,
  body,
  onBodyChange,
  readOnly = false,
  pageScroll = false,
}: Props) {
  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor({
    content: body ?? '',
    editable: !readOnly,
    editorProps: {
      handlePaste: (view, event) => {
        const files = imageFiles(event.clipboardData?.files);
        if (!view.editable || !files.length || !editorRef.current) return false;
        void insertUploads(editorRef.current, files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = imageFiles(event.dataTransfer?.files);
        if (moved || !view.editable || !files.length || !editorRef.current) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertUploads(editorRef.current, files, at);
        return true;
      },
    },
    extensions: [
      ...postContentExtensions,
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor: e }) => onBodyChange(e.isEmpty ? null : (e.getJSON() as RichTextDoc)),
  });
  editorRef.current = editor;

  const state =
    useEditorState({
      editor,
      selector: ({ editor: e }) => (e && !e.isDestroyed ? readState(e) : null),
    }) ?? (editor ? readState(editor) : null);
  const words = state?.words ?? 0;

  return (
    // No border of its own: it sits inside the editor page's bordered card.
    <div
      className={cn(
        'bg-background flex min-h-[24rem] flex-col md:min-h-[32rem]',
        !pageScroll && 'h-full overflow-hidden'
      )}
    >
      <RichTextEditor
        editor={editor}
        variant="subtle"
        // A column, so the page below the toolbar can grow to fill the editor.
        className={cn(
          'flex min-h-0 flex-1 flex-col rounded-none! border-0! shadow-none!',
          // A scroll box of its own would hold the toolbar inside it, so with page scrolling it has none.
          !pageScroll && 'overflow-y-auto',
          CANVAS,
          SCROLLBAR
        )}
      >
        {!readOnly && (
          <Toolbar
            editor={editor}
            state={state}
            underHeader={pageScroll}
            // Under the app header: 2.75rem (iOS's 44pt bar) plus the notch on phones, and 4rem (it sits 0.5rem down) above.
            className={
              pageScroll ? 'top-[calc(2.75rem+env(safe-area-inset-top))] md:top-16' : undefined
            }
          />
        )}
        {/* The page fills the editor's height, and the writing area fills the
            page, so clicking anywhere below the text lands in it. */}
        <article className="bg-background flex flex-1 flex-col px-4 py-5 sm:mx-auto sm:mt-4 sm:mb-6 sm:w-full sm:max-w-3xl sm:rounded-md sm:px-14 sm:py-12 sm:shadow-xs [&>.relative]:flex [&>.relative]:flex-1 [&>.relative]:flex-col">
          <textarea
            aria-label="Title"
            rows={1}
            value={title}
            readOnly={readOnly}
            onChange={(e) => onTitleChange(e.target.value.replace(/\n/g, ' '))}
            placeholder="Post title"
            className="placeholder:text-muted-foreground/60 mb-6 field-sizing-content w-full resize-none bg-transparent text-2xl font-bold tracking-tight outline-none sm:text-3xl"
          />
          <RichTextEditor.Content className="flex flex-1 flex-col [&_.ProseMirror]:min-h-64! [&_.ProseMirror]:flex-1 [&_.ProseMirror]:p-0! [&_mark]:rounded-sm [&_mark]:px-0.5 [&_mark]:text-inherit [&_mark:not([style])]:bg-yellow-400/40" />
        </article>
      </RichTextEditor>
      <TableHoverOverlay editor={editor} />

      <footer className="text-muted-foreground flex h-9 shrink-0 items-center gap-3 px-3 text-xs tabular-nums">
        <span>{words.toLocaleString('en-AU')} words</span>
        <span>{(state?.characters ?? 0).toLocaleString('en-AU')} characters</span>
        <span>{Math.max(1, Math.ceil(words / 200))} min read</span>
        {/* Keyboard shortcuts mean nothing on a phone. */}
        <div className="ml-auto max-md:hidden">
          <ShortcutsPopover />
        </div>
      </footer>
    </div>
  );
}
