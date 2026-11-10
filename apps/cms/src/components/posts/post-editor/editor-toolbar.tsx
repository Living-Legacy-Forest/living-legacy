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
import { type PageMenuItem, PageActions } from '@/components/shell/page-actions';
import { Spinner } from '@/components/ui/spinner';
import { useIsMobile } from '@/hooks/use-mobile';
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
  const isPhone = useIsMobile();

  // Phones: the app's top bar holds ‹ Posts, the title and the main action, with
  // the rest in its … menu; this bar keeps the status and, for a publisher, Schedule.
  if (isPhone) {
    return (
      <header className="flex min-h-11 shrink-0 items-center gap-3 border-b px-3 py-1.5">
        <PostStatusBadge
          status={meta.status}
          hasDraft={meta.hasDraft}
          inReview={meta.reviewRequestedAt !== null}
          scheduledAt={meta.scheduledAt}
          showDate
          className="text-foreground text-ui"
        />
        <span className="text-muted-foreground text-xs" aria-live="polite">
          {editor.saveState}
        </span>
        {access === 'full' && !editor.isLive && (
          <div className="ml-auto">
            <SchedulePopover
              labelled
              scheduledAt={meta.scheduledAt}
              disabled={working}
              onSchedule={editor.schedule}
              onUnschedule={editor.unschedule}
            />
          </div>
        )}
        <PhoneBar editor={editor} canDiscard={canDiscard} onImport={chooseDocx} />
        <DocxInput inputRef={docxInputRef} editor={editor} />
      </header>
    );
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3 max-md:h-auto max-md:min-h-12 max-md:flex-wrap max-md:gap-y-1.5 max-md:py-2">
      <PostStatusBadge
        status={meta.status}
        hasDraft={meta.hasDraft}
        inReview={meta.reviewRequestedAt !== null}
        scheduledAt={meta.scheduledAt}
        showDate
        className="text-foreground text-ui"
      />
      <span className="text-muted-foreground text-xs" aria-live="polite">
        {editor.saveState}
      </span>
      {/* On phones the actions take a row of their own, with Save and Publish sharing it. */}
      <div className="ml-auto flex items-center gap-1 max-md:w-full max-md:flex-wrap max-md:justify-end">
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
          // Below lg the properties sit under the editor, where hiding them helps no one.
          className="max-lg:hidden"
        >
          <PanelRightIcon aria-hidden />
        </Button>
      </div>
      <DocxInput inputRef={docxInputRef} editor={editor} />
    </header>
  );
}

function DocxInput({
  inputRef,
  editor,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  editor: PostEditorState;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) void editor.importDocx(file);
      }}
    />
  );
}

/** The phone top bar's part: the title, the main action and the … menu. */
function PhoneBar({ editor, canDiscard, onImport }: ActionsProps) {
  const { access, meta, dirty, working, isLive } = editor;
  const items: PageMenuItem[] = [];
  const add = (item: PageMenuItem | false) => item && items.push(item);

  if (access === 'full' || access === 'author') {
    add({
      label: 'Save draft',
      onClick: editor.save,
      disabled: working || (!dirty && meta.id !== null),
    });
  }
  if (access === 'seo') {
    add({
      label: 'Save search listing',
      onClick: editor.saveSeo,
      disabled: working || !dirty || !meta.id,
    });
  }
  add({ label: 'Preview', onClick: editor.preview, disabled: working || !meta.id });
  add(canDiscard && { label: 'Discard changes', onClick: editor.discard, disabled: working });
  if (access === 'full' || access === 'author') {
    add({ label: 'Import Word doc', onClick: onImport, disabled: working || editor.importingDocx });
    add(!!meta.id && { label: 'Duplicate', onClick: editor.duplicate, disabled: working });
  }
  add({
    label: 'Properties',
    onClick: () =>
      document.getElementById('post-properties')?.scrollIntoView({ behavior: 'smooth' }),
  });
  if (access === 'full') {
    add(isLive && { label: 'Unpublish', onClick: editor.unpublish, disabled: working });
    add(
      !!meta.id && {
        label: 'Move to trash',
        onClick: editor.trash,
        destructive: true,
        disabled: working,
      }
    );
  }

  let primary: React.ReactNode = null;
  if (access === 'full') {
    primary = (
      <button
        type="button"
        disabled={working || (isLive && !dirty && !meta.hasDraft)}
        onClick={editor.publish}
      >
        {editor.busy === 'publish'
          ? 'Publishing…'
          : isLive
            ? 'Publish changes'
            : meta.scheduledAt
              ? 'Publish now'
              : 'Publish'}
      </button>
    );
  } else if (access === 'author') {
    primary =
      meta.reviewRequestedAt !== null && !dirty ? (
        <button type="button" disabled>
          Submitted
        </button>
      ) : (
        <ReviewerPopover
          reviewers={editor.reviewers}
          disabled={working}
          label="Submit"
          onSubmit={editor.submitForReview}
        />
      );
  }

  return <PageActions title={editor.values.title || 'Untitled'} more={items} primary={primary} />;
}

type ActionsProps = { editor: PostEditorState; canDiscard: boolean; onImport: () => void };

function PublisherActions({ editor, canDiscard, onImport }: ActionsProps) {
  const { meta, dirty, working, isLive } = editor;
  return (
    <>
      {canDiscard && <DiscardButton editor={editor} />}
      <SaveButton
        editor={editor}
        label={'Save draft'}
        // A plain text button reads as a label on a phone; outline it there.
        className="max-md:bg-background max-md:flex-1 max-md:border max-md:shadow-xs"
      />
      <div className="flex max-md:flex-1">
        <Button
          size="sm"
          disabled={working || (isLive && !dirty && !meta.hasDraft)}
          onClick={editor.publish}
          className={cn('max-md:flex-1', !isLive && 'rounded-r-none border-r-0')}
        >
          {editor.busy === 'publish' ? (
            <>
              <Spinner data-icon="inline-start" />
              Publishing…
            </>
          ) : (
            <>
              <SendIcon aria-hidden data-icon="inline-start" />
              {isLive ? 'Publish changes' : meta.scheduledAt ? 'Publish now' : 'Publish'}
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

function SaveButton({
  editor,
  label,
  className,
}: {
  editor: PostEditorState;
  label: string;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
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
