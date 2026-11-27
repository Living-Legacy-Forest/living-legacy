import type { RichTextDoc } from '@ll/content';
import { Placeholder } from '@tiptap/extension-placeholder';
import { useEditor, useEditorState } from '@tiptap/react';
import { RichTextEditor } from '@/components/editor';
import { postContentExtensions } from '@/components/posts/post-extensions';
import { Toolbar } from '@/components/templates/simple-document-editor/toolbar';
import { readState } from '@/components/templates/simple-document-editor/utils';
import { cn } from '@/lib/utils';

/**
 * A rich text box for forms (an event's description, say): the post editor's
 * toolbar and formatting over a bordered writing area, stored the same way as
 * a post's body. `value` is read once on mount; remount with a new `key` to
 * replace it.
 */
export function RichTextField({
  id,
  labelId,
  value,
  onChange,
  placeholder,
  contentClassName,
}: {
  id: string;
  /** The visible label's id; the editor is not a native field, so it is named this way. */
  labelId: string;
  value: RichTextDoc | null;
  onChange: (value: RichTextDoc | null) => void;
  placeholder?: string;
  /** For the writing area, e.g. a taller minimum height: `[&_.ProseMirror]:min-h-80!`. */
  contentClassName?: string;
}) {
  const editor = useEditor({
    content: value ?? '',
    extensions: [
      ...postContentExtensions,
      Placeholder.configure({ placeholder: placeholder ?? 'Write here…' }),
    ],
    editorProps: {
      attributes: { id, 'aria-labelledby': labelId, 'aria-multiline': 'true', role: 'textbox' },
    },
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? null : (e.getJSON() as RichTextDoc)),
  });
  const state =
    useEditorState({
      editor,
      selector: ({ editor: e }) => (e && !e.isDestroyed ? readState(e) : null),
    }) ?? (editor ? readState(editor) : null);

  return (
    <div className="group focus-within:bg-background focus-within:ring-ring/15 overflow-clip rounded-lg bg-(--field) transition-colors [--field:color-mix(in_oklab,var(--muted)_60%,var(--card))] focus-within:ring-1 dark:[--field:color-mix(in_oklab,var(--foreground)_6%,var(--card))]">
      {/* One fill (--field), like the text inputs, shared by the bar and the writing area so they read as one box. */}
      <RichTextEditor
        editor={editor}
        variant="subtle"
        className="rounded-none! border-0! bg-transparent! shadow-none!"
      >
        <Toolbar
          editor={editor}
          state={state}
          // The event form scrolls in a box with p-6, and a sticky element stops short of that
          // padding, letting text show above it. -top-6 cancels it so the toolbar meets the edge.
          // The box uses overflow-clip, not hidden: it rounds the corners without becoming a
          // scroll container, which would stop the toolbar sticking to the form.
          // The box above is the surface, so the bar drops the floating pill the post editor uses:
          // no outline or shadow, left aligned, a softly rounded strip lifted a shade off the same fill
          // (the fill itself is solid, so text scrolls under it).
          className="group-focus-within:bg-background! sm:[&>div]:bg-foreground/5! -top-6 bg-(--field)! sm:px-1.5! sm:pt-1.5! sm:pb-1.5! [&>div]:mx-0! [&>div]:border-0! [&>div]:shadow-none! sm:[&>div]:w-full sm:[&>div]:rounded-lg"
        />
        <RichTextEditor.Content
          className={cn(
            '[&_.ProseMirror]:min-h-40! [&_.ProseMirror]:px-3! [&_.ProseMirror]:py-2.5! [&_.ProseMirror]:text-base md:[&_.ProseMirror]:text-sm',
            contentClassName
          )}
        />
      </RichTextEditor>
    </div>
  );
}
