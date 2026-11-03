// Images in a post body. Each one is a Media library file (src is its
// /api/media/… path), with its own alt text and an optional caption, stored
// as the image's `title` (the website renders it as a <figcaption>).
// Selecting an image in the editor shows fields to edit both.
import { Image } from '@tiptap/extension-image';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function PostImageView({ node, selected, editor, updateAttributes }: NodeViewProps) {
  const { src, alt, title } = node.attrs as {
    src: string;
    alt: string | null;
    title: string | null;
  };
  const editing = selected && editor.isEditable;

  return (
    <NodeViewWrapper as="figure" className="my-6" data-drag-handle>
      <img
        src={src}
        alt={alt ?? ''}
        className={cn(
          'mx-auto max-h-[32rem] rounded-md',
          editing && 'ring-ring ring-2 ring-offset-2'
        )}
      />
      {editing ? (
        <div contentEditable={false} className="mt-3 grid gap-2 sm:grid-cols-2">
          <Input
            aria-label="Alt text"
            maxLength={300}
            value={alt ?? ''}
            onChange={(e) => updateAttributes({ alt: e.target.value })}
            placeholder="Alt text: describe the image"
            className="text-[13px]"
          />
          <Input
            aria-label="Caption"
            maxLength={300}
            value={title ?? ''}
            onChange={(e) => updateAttributes({ title: e.target.value || null })}
            placeholder="Caption (optional)"
            className="text-[13px]"
          />
        </div>
      ) : title ? (
        <figcaption className="text-muted-foreground mt-2 text-center text-sm">{title}</figcaption>
      ) : editor.isEditable && !alt ? (
        <p contentEditable={false} className="text-muted-foreground mt-2 text-center text-xs">
          No alt text yet. Select the image to add it.
        </p>
      ) : null}
    </NodeViewWrapper>
  );
}

export const PostImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(PostImageView);
  },
}).configure({ allowBase64: false });
