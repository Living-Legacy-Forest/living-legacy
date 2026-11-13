// Import document: a Word file dropped, pasted or chosen here replaces the post's body.
import { type RichTextDoc, richTextPlainText } from '@ll/content';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DropTarget } from '@/components/ui/file-dropzone';
import type { PostEditorState } from './use-post-editor';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Whether the body holds anything an import would replace: words, or an image or table. */
function hasContent(body: RichTextDoc | null) {
  if (!body) return false;
  if (richTextPlainText(body).trim()) return true;
  const nodes = (body.content ?? []) as { type: string }[];
  return nodes.some((n) => n.type !== 'paragraph');
}

export function ImportDocumentDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: PostEditorState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const busy = editor.importingDocx;

  async function take([file]: File[]) {
    if (!file || busy) return;
    if (await editor.importDocx(file)) onOpenChange(false);
  }
  const replaces = hasContent(editor.values.body);

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import a document</DialogTitle>
          <DialogDescription>
            Bring in a Word document. Its headings, lists, links and images become the post's
            content.
          </DialogDescription>
        </DialogHeader>

        <DropTarget
          accept={`.docx,${DOCX_MIME}`}
          busy={busy}
          busyLabel="Importing"
          label="Add a Word document"
          description="Drop it here or choose one."
          note=".docx files only"
          dropLabel="Drop to import"
          refusal="Only .docx files can be imported. Save it as .docx first."
          onFiles={(files) => void take(files)}
          className="min-h-80 max-md:min-h-56"
        />

        {replaces && (
          <p className="text-muted-foreground text-sm">
            This replaces what is in the post now. If you change your mind, leave without saving.
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={busy} />}>
            Cancel
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
