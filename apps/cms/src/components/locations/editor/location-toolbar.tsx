import { Link } from '@tanstack/react-router';
import {
  ChevronLeftIcon,
  CopyIcon,
  ExternalLinkIcon,
  EyeOffIcon,
  MapPinIcon,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { UnsavedLabel } from '@/components/unsaved-label';
import { copyLink, openInNewTab, siteUrl } from '@/lib/site';
import type { LocationItem } from '@/server/locations';
import type { LocationEditorState } from './use-location-editor';

/** The bar above the location: where it stands, then Publish and Save; Delete sits in the menu. */
export function LocationToolbar({
  editor,
  item,
  showMap,
  onToggleMap,
  onDelete,
}: {
  editor: LocationEditorState;
  item: LocationItem | null;
  showMap: boolean;
  onToggleMap: () => void;
  onDelete: () => void;
}) {
  const { pending, values } = editor;
  const SubmitIcon = item ? SaveIcon : PlusIcon;
  // Its page on the website exists once it is live and published.
  const pageUrl =
    item && item.status === 'published' && item.stage === 'live'
      ? siteUrl(`/locations/${item.slug}/`)
      : null;
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
      <UnsavedLabel show={editor.dirty} gap={12} className="text-muted-foreground text-xs" />
      <div className="ml-auto flex items-center gap-1 max-md:w-full max-md:flex-wrap max-md:justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={showMap ? 'Hide the map' : 'Show the map'}
          aria-pressed={showMap}
          onClick={onToggleMap}
          // Below lg the map sits under the form, where hiding it helps no one.
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
            <DropdownMenuContent align="end" className="w-48">
              {pageUrl && (
                <>
                  <DropdownMenuItem onClick={() => openInNewTab(pageUrl)}>
                    <ExternalLinkIcon aria-hidden />
                    View on website
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void copyLink(pageUrl)}>
                    <CopyIcon aria-hidden />
                    Copy link
                  </DropdownMenuItem>
                </>
              )}
              {values.pin && (
                <DropdownMenuItem
                  onClick={() =>
                    openInNewTab(
                      `https://www.google.com/maps/search/?api=1&query=${values.pin!.latitude},${values.pin!.longitude}`
                    )
                  }
                >
                  <MapPinIcon aria-hidden />
                  Open in Maps
                </DropdownMenuItem>
              )}
              <DropdownMenuItem disabled={pending} onClick={() => void editor.duplicate()}>
                <CopyIcon aria-hidden />
                Duplicate
              </DropdownMenuItem>
              {item.status === 'published' && (
                <DropdownMenuItem disabled={pending} onClick={editor.unpublish}>
                  <EyeOffIcon aria-hidden />
                  Unpublish
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={pending} onClick={onDelete}>
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
