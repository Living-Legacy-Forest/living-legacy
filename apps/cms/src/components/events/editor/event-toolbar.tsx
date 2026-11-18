import { Link } from '@tanstack/react-router';
import {
  ChevronLeftIcon,
  MoreHorizontalIcon,
  PanelRightIcon,
  PlusIcon,
  SaveIcon,
  SendIcon,
  Trash2Icon,
} from '@/components/icons';
import { PageActions, type PageMenuItem } from '@/components/shell/page-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import type { EventRow } from '@/server/events';
import { openEventPreview } from '../event-preview-store';
import { dateStatus } from '../series-date-picker';
import { PreviewButton } from './event-actions';
import type { EventEditorState } from './use-event-editor';

/** The form's id, so Save in the phone's top bar (outside the form) can submit it. */
export const EVENT_FORM_ID = 'event-editor-form';

/**
 * The bar above the event: where it stands, then Preview, Publish and Save.
 * Cancel event and Delete sit in the menu, away from the buttons used most.
 * Phones move the buttons into the app's top bar: Save at the right, the rest under ….
 */
export function EventToolbar({
  editor,
  event,
  showSide,
  onToggleSide,
  onCancelEvent,
  onDelete,
  statusInPicker = false,
  children,
}: {
  editor: EventEditorState;
  event: EventRow | null;
  showSide: boolean;
  onToggleSide: () => void;
  onCancelEvent: () => void;
  onDelete: () => void;
  /** The date picker already says where it stands, so phones leave out the badge. */
  statusInPicker?: boolean;
  /** Tabs and the date picker, between the status and the buttons. */
  children?: React.ReactNode;
}) {
  const { pending, values } = editor;
  const SubmitIcon = event ? SaveIcon : PlusIcon;
  const form = () => document.getElementById(EVENT_FORM_ID) as HTMLFormElement | null;
  const phoneMenu: PageMenuItem[] = [
    { label: 'Preview', onClick: () => openEventPreview(editor.previewDraft()) },
    ...(values.status === 'draft'
      ? [
          {
            label: 'Publish',
            disabled: pending,
            onClick: () => {
              const f = form();
              if (f) editor.publish(f);
            },
          },
        ]
      : []),
    ...(event
      ? [
          { label: 'Cancel event', onClick: onCancelEvent },
          { label: 'Delete', onClick: onDelete, destructive: true },
        ]
      : []),
  ];
  return (
    <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-1.5">
      {/* Phones have ‹ Events in the app's own top bar. */}
      <Button
        variant="ghost"
        size="sm"
        className="max-md:hidden"
        render={<Link to="/events" />}
        nativeButton={false}
      >
        <ChevronLeftIcon aria-hidden data-icon="inline-start" />
        Events
      </Button>
      <PageActions
        more={phoneMenu}
        primary={
          <button type="submit" form={EVENT_FORM_ID} disabled={pending}>
            {pending ? 'Saving…' : event ? 'Save' : 'Create'}
          </button>
        }
      />
      <Badge variant="outline" className={statusInPicker ? 'max-md:hidden' : undefined}>
        {event ? dateStatus(event) : 'New'}
      </Badge>
      {editor.dirty && (
        <span className="text-muted-foreground text-xs max-md:hidden" aria-live="polite">
          Unsaved changes
        </span>
      )}
      {children}
      <div className="ml-auto flex items-center gap-1 max-md:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={showSide ? 'Hide the side panel' : 'Show the side panel'}
          aria-pressed={showSide}
          onClick={onToggleSide}
          // Below lg the panel sits under the form, where hiding it helps no one.
          className="max-lg:hidden"
        >
          <PanelRightIcon aria-hidden />
        </Button>
        {event && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}
            >
              <MoreHorizontalIcon aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onCancelEvent}>Cancel event</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2Icon aria-hidden />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <PreviewButton size="sm" draft={editor.previewDraft} />
        {values.status === 'draft' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={(e) => editor.publish(e.currentTarget.form!)}
          >
            <SendIcon aria-hidden data-icon="inline-start" />
            Publish
          </Button>
        )}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (
            <>
              <Spinner data-icon="inline-start" />
              Saving…
            </>
          ) : (
            <>
              <SubmitIcon aria-hidden data-icon="inline-start" />
              {event ? 'Save' : 'Create event'}
            </>
          )}
        </Button>
      </div>
    </header>
  );
}
