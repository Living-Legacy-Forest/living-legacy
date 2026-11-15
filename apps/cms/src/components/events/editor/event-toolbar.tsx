import { Link } from '@tanstack/react-router';
import {
  ChevronLeftIcon,
  MoreHorizontalIcon,
  PanelRightIcon,
  Trash2Icon,
} from '@/components/icons';
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
import { dateStatus } from '../series-date-picker';
import { PreviewButton } from './event-actions';
import type { EventEditorState } from './use-event-editor';

/**
 * The bar above the event: where it stands, then Preview, Publish and Save.
 * Cancel event and Delete sit in the menu, away from the buttons used most.
 */
export function EventToolbar({
  editor,
  event,
  showSide,
  onToggleSide,
  onCancelEvent,
  onDelete,
  children,
}: {
  editor: EventEditorState;
  event: EventRow | null;
  showSide: boolean;
  onToggleSide: () => void;
  onCancelEvent: () => void;
  onDelete: () => void;
  /** Tabs and the date picker, between the status and the buttons. */
  children?: React.ReactNode;
}) {
  const { pending, values } = editor;
  const busy = (label: string, text: string) =>
    pending ? (
      <>
        <Spinner />
        {label}
      </>
    ) : (
      text
    );
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
      <Badge variant="outline">{event ? dateStatus(event) : 'New'}</Badge>
      {editor.dirty && (
        <span className="text-muted-foreground text-xs" aria-live="polite">
          Unsaved changes
        </span>
      )}
      {children}
      <div className="ml-auto flex items-center gap-1 max-md:w-full max-md:flex-wrap max-md:justify-end">
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
            Publish
          </Button>
        )}
        <Button type="submit" size="sm" disabled={pending}>
          {busy('Saving…', event ? 'Save' : 'Create event')}
        </Button>
      </div>
    </header>
  );
}
