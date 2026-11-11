// Import document: a Word file dropped or chosen here replaces the post's body.
import { type RichTextDoc, richTextPlainText } from '@ll/content';
import { useRef } from 'react';
import { UploadIcon } from '@/components/icons';
import { useImageDrop } from '@/components/media/image-drop-zone';
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
import type { PostEditorState } from './use-post-editor';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const isDocx = (file: File) => file.type === DOCX_MIME || /\.docx$/i.test(file.name);

// The first Word document dropped or chosen; anything else gets a toast.
function firstDocx(list: FileList | null): File[] {
  const files = [...(list ?? [])];
  const doc = files.find(isDocx);
  if (!doc && files.length) {
    notify.error(
      'Not a Word document',
      'Only .docx files can be imported. Save it as .docx first.'
    );
  }
  return doc ? [doc] : [];
}

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
  const input = useRef<HTMLInputElement>(null);

  async function take([file]: File[]) {
    if (!file || busy) return;
    if (await editor.importDocx(file)) onOpenChange(false);
  }
  const { over, dropProps } = useImageDrop(take, busy, firstDocx);
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

        <input
          ref={input}
          type="file"
          accept={`.docx,${DOCX_MIME}`}
          className="hidden"
          onChange={(e) => {
            const files = firstDocx(e.target.files);
            e.target.value = '';
            void take(files);
          }}
        />
        <Empty
          {...dropProps}
          className={cn(
            'min-h-80 gap-3 rounded-lg border border-dashed p-10 transition-colors max-md:min-h-56 max-md:p-6',
            over ? 'border-ring bg-accent/50' : 'hover:bg-muted/40'
          )}
        >
          <EmptyHeader className="gap-1">
            <EmptyMedia variant="icon" className="mb-1">
              {busy ? <Spinner /> : <UploadIcon aria-hidden />}
            </EmptyMedia>
            <EmptyTitle className="text-sm">
              {busy ? 'Importing…' : over ? 'Drop to import' : 'Drop a Word document here'}
            </EmptyTitle>
            <EmptyDescription className="text-xs">.docx files only.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="touch:min-h-11"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              Choose a file
            </Button>
          </EmptyContent>
        </Empty>

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
