import type { RichTextDoc } from '@llf/content';
import { Placeholder } from '@tiptap/extension-placeholder';
import { type Editor, useEditor, useEditorState } from '@tiptap/react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { RichTextEditor } from '@/components/editor';
import { TableHoverOverlay } from '@/components/extensions/table/table-hover-overlay';
import { CANVAS, SCROLLBAR } from '@/components/templates/simple-document-editor/constants';
import { ShortcutsPopover } from '@/components/templates/simple-document-editor/shortcuts';
import { Toolbar } from '@/components/templates/simple-document-editor/toolbar';
import { readState } from '@/components/templates/simple-document-editor/utils';
import { readableError } from '@/lib/errors';
import { uploadMedia } from '@/lib/upload-media';
import { cn } from '@/lib/utils';
import { postContentExtensions } from './post-extensions';

const imageFiles = (files: FileList | null | undefined) =>
  Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));

/** Uploads pasted or dropped images to Media, then puts them in the body. */
async function insertUploads(editor: Editor, files: File[], at?: number) {
  const id = toast.loading(files.length === 1 ? 'Uploading image…' : 'Uploading images…');
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
    toast.success(files.length === 1 ? 'Image added.' : 'Images added.', { id });
  } catch (error) {
    toast.error(readableError(error), { id });
  }
}

type Props = {
  title: string;
  onTitleChange: (title: string) => void;
  excerpt: string;
  onExcerptChange: (excerpt: string) => void;
  /** Read once on mount; remount with a new `key` to replace it. */
  body: RichTextDoc | null;
  onBodyChange: (body: RichTextDoc | null) => void;
  /** Show the post without letting it be changed (no toolbar, nothing editable). */
  readOnly?: boolean;
};

/**
 * Document-style post editor (editorcn toolbar editor): a floating toolbar
 * over a page that holds the title, summary and body, with counts below.
 */
export function DocumentEditor({
  title,
  onTitleChange,
  excerpt,
  onExcerptChange,
  body,
  onBodyChange,
  readOnly = false,
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
    <div className="bg-background flex h-full min-h-[32rem] flex-col overflow-hidden rounded-lg border">
      <RichTextEditor
        editor={editor}
        variant="subtle"
        className={cn(
          'min-h-0 flex-1 overflow-y-auto rounded-none! border-0! shadow-none!',
          CANVAS,
          SCROLLBAR
        )}
      >
        {!readOnly && <Toolbar editor={editor} state={state} />}
        <article className="bg-background px-4 py-5 sm:mx-auto sm:mt-4 sm:mb-6 sm:max-w-3xl sm:rounded-md sm:border sm:px-14 sm:py-12 sm:shadow-xs">
          <textarea
            aria-label="Title"
            rows={1}
            value={title}
            readOnly={readOnly}
            onChange={(e) => onTitleChange(e.target.value.replace(/\n/g, ' '))}
            placeholder="Post title"
            className="placeholder:text-muted-foreground/60 field-sizing-content w-full resize-none bg-transparent text-2xl font-bold tracking-tight outline-none sm:text-3xl"
          />
          <textarea
            aria-label="Summary"
            rows={1}
            value={excerpt}
            readOnly={readOnly}
            onChange={(e) => onExcerptChange(e.target.value)}
            placeholder="Add a short summary…"
            className="text-muted-foreground placeholder:text-muted-foreground/50 mt-1 mb-6 field-sizing-content w-full resize-none bg-transparent text-base leading-relaxed outline-none"
          />
          <RichTextEditor.Content className="[&_.ProseMirror]:min-h-64! [&_.ProseMirror]:p-0! [&_mark]:rounded-sm [&_mark]:px-0.5 [&_mark]:text-inherit [&_mark:not([style])]:bg-yellow-400/40" />
        </article>
      </RichTextEditor>
      <TableHoverOverlay editor={editor} />

      <footer className="text-muted-foreground flex h-9 shrink-0 items-center gap-3 border-t px-3 text-xs tabular-nums">
        <span>{words.toLocaleString('en-AU')} words</span>
        <span>{(state?.characters ?? 0).toLocaleString('en-AU')} characters</span>
        <span className="hidden sm:inline">{Math.max(1, Math.ceil(words / 200))} min read</span>
        <div className="ml-auto">
          <ShortcutsPopover />
        </div>
      </footer>
    </div>
  );
}
