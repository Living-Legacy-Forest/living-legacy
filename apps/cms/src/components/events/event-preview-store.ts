// A preview shows the event form as it is, unsaved changes included: saving a
// published event changes it on the website at once, so previewing must not
// save. The form's values go to the new tab through localStorage, which tabs
// on the same site share, under a key the preview's address names.

import type { RichTextDoc } from '@ll/content';
import { notify } from '@/lib/notify';

export type EventPreviewDraft = {
  /** The saved event's id and series, if it has been saved. */
  id: string | null;
  seriesId: string | null;
  status: 'draft' | 'published' | 'cancelled';
  title: string;
  summary: string;
  description: RichTextDoc | null;
  locationId: string | null;
  venue: string;
  timeZone: string;
  startsAt: number | null;
  endsAt: number | null;
  heroMediaId: string | null;
  galleryMediaIds: string[];
  capacity: number | null;
  maxPartySize: number;
  /** Optional, so previews saved before it existed still open. */
  bookingsOpenAt?: number | null;
  bookingsCloseAt: number | null;
  /** Places already booked. */
  booked: number;
  /** For a new repeating event, the dates it will create after the first. */
  moreDates: { startsAt: number; endsAt: number }[];
};

const PREFIX = 'll:event-preview:';
/** Long enough to reload a preview tab; old ones are cleared on the next preview. */
const KEEP_MS = 24 * 60 * 60 * 1000;

/** Stores the draft and returns the key for the preview's address. */
export function stashEventPreview(draft: EventPreviewDraft): string | null {
  try {
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as { at?: number } | null;
      if (!saved?.at || now - saved.at > KEEP_MS) localStorage.removeItem(key);
    }
    const key = crypto.randomUUID();
    localStorage.setItem(PREFIX + key, JSON.stringify({ at: now, draft }));
    return key;
  } catch {
    // Storage full, or turned off in a private window.
    return null;
  }
}

export function readEventPreview(key: string): EventPreviewDraft | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFIX + key) ?? 'null') as {
      draft?: EventPreviewDraft;
    } | null;
    return saved?.draft ?? null;
  } catch {
    return null;
  }
}

/** Opens the preview in a new tab. Called from a click, so it is not a blocked pop-up. */
export function openEventPreview(draft: EventPreviewDraft) {
  const key = stashEventPreview(draft);
  if (!key) {
    notify.error(
      'Could not open the preview',
      'This browser is not letting the CMS keep it. Try again outside a private window.'
    );
    return;
  }
  const tab = window.open(`/preview/events/${key}`, '_blank');
  if (tab) tab.opener = null;
  else notify.error('Preview blocked', 'Allow pop-ups for this site to open the preview.');
}
