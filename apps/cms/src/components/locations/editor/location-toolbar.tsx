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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import type { LocationItem } from '@/server/locations';
import type { LocationEditorState } from './use-location-editor';

/** The bar above the location: where it stands, then Publish and Save; Delete sits in the menu. */
export function LocationToolbar({
  editor,
  item,
  showSide,
  onToggleSide,
  onDelete,
}: {
  editor: LocationEditorState;
  item: LocationItem | null;
  showSide: boolean;
  onToggleSide: () => void;
  onDelete: () => void;
}) {
  const { pending, values } = editor;
  const SubmitIcon = item ? SaveIcon : PlusIcon;
  return (
    <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-1.5">
      {/* Phones have ‹ Locations in the app's own top bar. */}
      <Button
        variant="ghost"
        size="sm"
        className="max-md:hidden"
        render={<Link to="/locations" />}
        nativeButton={false}
      >
        <ChevronLeftIcon aria-hidden data-icon="inline-start" />
        Locations
      </Button>
      <Badge variant="outline">
        {item ? (item.status === 'published' ? 'Published' : 'Draft') : 'New'}
      </Badge>
      {editor.dirty && (
        <span className="text-muted-foreground text-xs" aria-live="polite">
          Unsaved changes
        </span>
      )}
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
        {item && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}
            >
              <MoreHorizontalIcon aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2Icon aria-hidden />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!values.published && (
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
              {item ? 'Save' : 'Add location'}
            </>
          )}
        </Button>
      </div>
    </header>
  );
}
