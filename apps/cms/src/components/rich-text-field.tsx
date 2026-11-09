import type { RichTextDoc } from '@ll/content';
import { Placeholder } from '@tiptap/extension-placeholder';
import { useEditor, useEditorState } from '@tiptap/react';
import { RichTextEditor } from '@/components/editor';
import { postContentExtensions } from '@/components/posts/post-extensions';
import { Toolbar } from '@/components/templates/simple-document-editor/toolbar';
import { readState } from '@/components/templates/simple-document-editor/utils';

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
}: {
  id: string;
  /** The visible label's id; the editor is not a native field, so it is named this way. */
  labelId: string;
  value: RichTextDoc | null;
  onChange: (value: RichTextDoc | null) => void;
  placeholder?: string;
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
    <div className="focus-within:border-ring overflow-hidden rounded-lg border transition-colors">
      <RichTextEditor
        editor={editor}
        variant="subtle"
        className="rounded-none! border-0! shadow-none!"
      >
        <Toolbar editor={editor} state={state} />
        <RichTextEditor.Content className="[&_.ProseMirror]:min-h-40! [&_.ProseMirror]:px-3! [&_.ProseMirror]:py-2.5! [&_.ProseMirror]:text-base md:[&_.ProseMirror]:text-sm" />
      </RichTextEditor>
    </div>
  );
}
