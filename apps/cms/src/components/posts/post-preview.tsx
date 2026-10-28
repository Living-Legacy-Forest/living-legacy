import type { RichTextDoc } from '@llf/content';
import { StaticRenderer } from '@/components/static-renderer';
import { postContentExtensions } from './post-extensions';

/** Read-only rendering of a post body with the same extensions as the editor. */
export function PostPreviewBody({ body }: { body: RichTextDoc | null }) {
  if (!body) return <p className="text-muted-foreground">This post has no content yet.</p>;
  return <StaticRenderer content={body} extensions={postContentExtensions} />;
}
