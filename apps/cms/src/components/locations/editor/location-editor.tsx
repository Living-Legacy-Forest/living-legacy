/**
 * The location page, split by job:
 *
 *   use-location-editor.ts    state, saving and the warning before leaving
 *   location-values.ts        the rules behind the form, tested on their own
 *   location-toolbar.tsx      status and the actions above the page
 *   location-main.tsx         photo, name, intro, About, address and map pin
 *   location-details.tsx      publishing, listing, place, visiting, slug, the rest
 *   location-map-panel.tsx    the map pin, beside the form
 */
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  ResizablePanel,
  ResizablePanels,
} from '@/components/arc/resizable-panels/resizable-panels';
import { LeaveDialog } from '@/components/editor-page/leave-dialog';
import { useIsDesktop } from '@/components/editor-page/use-is-desktop';
import { TOUCH_FIELDS } from '@/components/form-steps';
import { removedNotice } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import { type LocationItem, deleteLocations } from '@/server/locations';
import { DeleteLocationDialog } from '../delete-location';
import { LocationMain } from './location-main';
import { LocationMapPanel } from './location-map-panel';
import { LocationToolbar } from './location-toolbar';
import { useLocationEditor } from './use-location-editor';

/** Add and edit page for a location. Remount it (change its `key`) to reload from the server. */
export function LocationEditor({
  item,
  nextOrder,
  reveal = false,
}: {
  /** Null on /locations/new. */
  item: LocationItem | null;
  nextOrder: number;
  /** Plays the page's arrival animation; the route turns it off once it has played. */
  reveal?: boolean;
}) {
  const navigate = useNavigate();
  const { run } = useAction();
  const editor = useLocationEditor({
    item,
    nextOrder,
    // A saved location stays as it is; only a new one has somewhere to go.
    onSaved: (id) => {
      if (!item) {
        void navigate({ to: '/locations/$locationId', params: { locationId: id }, replace: true });
      }
    },
  });
  const [showMap, setShowMap] = useState(true);
  const desktop = useIsDesktop();
  const [deleting, setDeleting] = useState(false);

  /** Removes it and goes to the list before the data refreshes, so nothing flashes "gone". */
  async function remove() {
    if (!item) return;
    await run(() => deleteLocations({ data: { ids: [item.id] } }), {
      success: removedNotice(1, ['location', 'locations']),
      error: 'Could not remove the location',
      afterAction: () => {
        editor.skipBlock();
        return navigate({ to: '/locations' });
      },
    });
  }

  return (
    <>
      <h1 className="sr-only">{item?.name || 'Add location'}</h1>
      <form
        noValidate
        onSubmit={editor.submit}
        data-slot="location-editor"
        data-revealing={reveal || undefined}
        className={cn('flex flex-1 flex-col', TOUCH_FIELDS)}
      >
        <ResizablePanels
          label="Location and details"
          className={cn(
            'flex-1',
            // Below lg the panel sits under the form and its divider goes.
            'max-lg:block! max-lg:[&>*+*]:mt-6 max-lg:[&>[role=separator]]:hidden'
          )}
        >
          <ResizablePanel
            id="location-editor-main"
            label="Location"
            defaultSize={58}
            minSize={420}
            className="max-lg:max-w-none!"
          >
            <div
              data-slot="location-editor-main"
              className={cn(
                'bg-background flex min-w-0 flex-col overflow-hidden rounded-lg border lg:h-[calc(100svh-7.5rem)]',
                // The gap closes with the panel, on the same curve, so the card does not jump.
                'motion-reduce:transition-none lg:transition-[margin-right] lg:duration-300 lg:ease-[cubic-bezier(0.32,0.72,0,1)]',
                showMap && 'lg:mr-6'
              )}
            >
              <LocationToolbar
                editor={editor}
                item={item}
                showMap={showMap}
                onToggleMap={() => setShowMap((v) => !v)}
                onDelete={() => setDeleting(true)}
              />
              <div className="min-h-[24rem] flex-1 overflow-y-auto p-6 max-md:px-0 lg:min-h-0">
                <LocationMain editor={editor} />
              </div>
            </div>
          </ResizablePanel>

          <ResizablePanel
            id="location-map-panel"
            label="Map"
            defaultSize={42}
            minSize={300}
            maxSize={720}
            // Hiding glides shut and the content fades, the way dragging the divider does. Only
            // from lg: below that the panel sits under the form and has no toggle.
            collapsible
            collapsed={!showMap && desktop}
            onCollapsedChange={(hidden) => setShowMap(!hidden)}
            className="max-lg:max-w-none!"
          >
            <aside
              id="location-map"
              className="text-ui lg:no-scrollbar min-w-0 lg:h-[calc(100svh-7.5rem)] lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain lg:pb-6 lg:pl-6"
            >
              <LocationMapPanel editor={editor} />
            </aside>
          </ResizablePanel>
        </ResizablePanels>
      </form>

      {item && (
        <DeleteLocationDialog
          item={item}
          open={deleting}
          onOpenChange={setDeleting}
          onConfirm={remove}
        />
      )}
      <LeaveDialog blocker={editor.blocker} what="location" />
    </>
  );
}
