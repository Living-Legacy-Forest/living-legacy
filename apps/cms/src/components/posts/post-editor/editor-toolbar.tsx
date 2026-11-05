import { useRef } from 'react';
import {
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  MoreHorizontalIcon,
  PanelRightIcon,
  SendIcon,
  Trash2Icon,
  Undo2Icon,
  UploadIcon,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { PostStatusBadge } from '../post-status-badge';
import { ReviewerPopover } from '../reviewer-popover';
import { SchedulePopover } from './schedule-popover';
import type { PostEditorState } from './use-post-editor';

/**
 * The bar above the post: status, save state, and the actions this person's
 * access allows. Publishers get Save / Publish / Schedule and a menu; authors
 * save and send for review; SEO access saves the search listing.
 */
export function EditorToolbar({
  editor,
  showProperties,
  onToggleProperties,
}: {
  editor: PostEditorState;
  showProperties: boolean;
  onToggleProperties: () => void;
}) {
  const { access, meta, dirty, working } = editor;
  const docxInputRef = useRef<HTMLInputElement>(null);
  const chooseDocx = () => docxInputRef.current?.click();
  const canDiscard = meta.hasDraft && !dirty && meta.id !== null;

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3 max-md:h-auto max-md:min-h-12 max-md:flex-wrap max-md:gap-y-1.5 max-md:py-2">
      <PostStatusBadge
        status={meta.status}
        hasDraft={meta.hasDraft}
        inReview={meta.reviewRequestedAt !== null}
        scheduledAt={meta.scheduledAt}
        showDate
        className="text-foreground text-[13px]"
      />
      <span className="text-muted-foreground text-xs" aria-live="polite">
        {editor.saveState}
      </span>
      <div className="ml-auto flex items-center gap-1 max-md:flex-wrap max-md:justify-end">
        {access === 'full' && (
          <PublisherActions editor={editor} canDiscard={canDiscard} onImport={chooseDocx} />
        )}
        {access === 'author' && (
          <AuthorActions editor={editor} canDiscard={canDiscard} onImport={chooseDocx} />
        )}
        {access === 'seo' && (
          <>
            <PreviewButton editor={editor} />
            <Button size="sm" disabled={working || !dirty || !meta.id} onClick={editor.saveSeo}>
              <Busy when={editor.busy === 'save'} label="Saving…">
                Save search listing
              </Busy>
            </Button>
          </>
        )}
        {access === 'readonly' && (
          <>
            <span className="text-muted-foreground px-2 text-xs">Read only</span>
            <PreviewButton editor={editor} />
          </>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={showProperties ? 'Hide properties panel' : 'Show properties panel'}
          onClick={onToggleProperties}
        >
          <PanelRightIcon aria-hidden />
        </Button>
      </div>
      <input
        ref={docxInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void editor.importDocx(file);
        }}
      />
    </header>
  );
}

type ActionsProps = { editor: PostEditorState; canDiscard: boolean; onImport: () => void };

function PublisherActions({ editor, canDiscard, onImport }: ActionsProps) {
  const { meta, dirty, working, isLive } = editor;
  return (
    <>
      {canDiscard && <DiscardButton editor={editor} />}
      <SaveButton editor={editor} label={isLive ? 'Save changes' : 'Save draft'} />
      <div className="flex">
        <Button
          size="sm"
          disabled={working || (isLive && !dirty && !meta.hasDraft)}
          onClick={editor.publish}
          className={cn(!isLive && 'rounded-r-none')}
        >
          {editor.busy === 'publish' ? (
            <>
              <Spinner data-icon="inline-start" />
              Publishing…
            </>
          ) : (
            <>
              <SendIcon aria-hidden data-icon="inline-start" />
              {isLive ? 'Update' : meta.scheduledAt ? 'Publish now' : 'Publish'}
            </>
          )}
        </Button>
        {!isLive && (
          <SchedulePopover
            scheduledAt={meta.scheduledAt}
            disabled={working}
            onSchedule={editor.schedule}
            onUnschedule={editor.unschedule}
          />
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}
        >
          <MoreHorizontalIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem disabled={working} onClick={editor.preview}>
            <EyeIcon aria-hidden />
            Preview
          </DropdownMenuItem>
          <DropdownMenuItem disabled={working || editor.importingDocx} onClick={onImport}>
            {editor.importingDocx ? <Spinner /> : <UploadIcon aria-hidden />}
            Import Word doc
          </DropdownMenuItem>
          {meta.id && (
            <DropdownMenuItem disabled={working} onClick={editor.duplicate}>
              <CopyIcon aria-hidden />
              Duplicate
            </DropdownMenuItem>
          )}
          {isLive && (
            <DropdownMenuItem disabled={working} onClick={editor.unpublish}>
              <EyeOffIcon aria-hidden />
              Unpublish
            </DropdownMenuItem>
          )}
          {meta.id && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={working} onClick={editor.trash}>
                <Trash2Icon aria-hidden />
                Move to trash
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function AuthorActions({ editor, canDiscard, onImport }: ActionsProps) {
  const { meta, dirty, working } = editor;
  return (
    <>
      {canDiscard && <DiscardButton editor={editor} />}
      <PreviewButton editor={editor} />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Import Word doc"
        disabled={working || editor.importingDocx}
        onClick={onImport}
      >
        {editor.importingDocx ? <Spinner /> : <UploadIcon aria-hidden />}
      </Button>
      {meta.id && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Duplicate"
          disabled={working}
          onClick={editor.duplicate}
        >
          <CopyIcon aria-hidden />
        </Button>
      )}
      <SaveButton editor={editor} label="Save draft" />
      {meta.reviewRequestedAt !== null && !dirty ? (
        <Button size="sm" disabled>
          <SendIcon aria-hidden data-icon="inline-start" />
          Submitted for review
        </Button>
      ) : (
        <ReviewerPopover
          reviewers={editor.reviewers}
          disabled={working}
          onSubmit={editor.submitForReview}
        />
      )}
    </>
  );
}

function DiscardButton({ editor }: { editor: PostEditorState }) {
  return (
    <Button variant="ghost" size="sm" disabled={editor.working} onClick={editor.discard}>
      <Undo2Icon aria-hidden data-icon="inline-start" />
      <span className="max-md:sr-only">Discard changes</span>
    </Button>
  );
}

function SaveButton({ editor, label }: { editor: PostEditorState; label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={editor.working || (!editor.dirty && editor.meta.id !== null)}
      onClick={editor.save}
    >
      <Busy when={editor.busy === 'save'} label="Saving…">
        {label}
      </Busy>
    </Button>
  );
}

function PreviewButton({ editor }: { editor: PostEditorState }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Preview"
      disabled={editor.working || !editor.meta.id}
      onClick={editor.preview}
    >
      <EyeIcon aria-hidden />
    </Button>
  );
}

/** A button's label, swapped for a spinner and `label` while its action runs. */
function Busy({
  when,
  label,
  children,
}: {
  when: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (!when) return children;
  return (
    <>
      <Spinner data-icon="inline-start" />
      {label}
    </>
  );
}
