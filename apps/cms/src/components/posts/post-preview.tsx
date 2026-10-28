import type { RichTextDoc } from '@llf/content';
import { FileTextIcon } from 'lucide-react';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { StaticRenderer } from '@/components/static-renderer';
import { postContentExtensions } from './post-extensions';

/** Read-only rendering of a post body with the same extensions as the editor. */
export function PostPreviewBody({ body }: { body: RichTextDoc | null }) {
  if (!body) {
    return (
      <Empty className="border py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileTextIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>No content yet</EmptyTitle>
          <EmptyDescription>Open the post in the editor to start writing.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return <StaticRenderer content={body} extensions={postContentExtensions} />;
}
