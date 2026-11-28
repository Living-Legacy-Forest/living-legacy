// How the CMS marks state on things that are not fields, so a chosen tile, a card and a drop
// target read the same on every page. Class strings, so Tailwind can see them.

/** Something picked: a selected tile, card or theme. Fields mark focus their own way. */
export const SELECTED_RING = 'ring-1 ring-ring/40';

/** Keyboard focus on a tile or card: stronger than selection, so the two never look alike. */
export const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

/** A box that files are being dragged over. */
export const DROP_TARGET = 'bg-accent/40 ring-1 ring-ring/40';
