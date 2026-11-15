/** An event's tabs; the first is the default and is left out of the address. */
type EventView = 'details' | 'guests' | 'dashboard';

/**
 * Events used to open in a pane, from `/events?open=<id>&view=…`. That address is
 * in bookmarks and old notifications; it now leads to the event's own page.
 * Null means the address is just the list.
 */
export function legacyEventRedirect(search: { open?: string; view?: EventView }) {
  if (!search.open) return null;
  return {
    to: '/events/$eventId' as const,
    params: { eventId: search.open },
    search: search.view ? { view: search.view } : {},
  };
}
