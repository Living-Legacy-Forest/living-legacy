// What's new in the CMS, for the banner and the What's new dialog. Written for
// editors, not developers: a sentence or two on what they can now do and where.
// Add an entry, newest first, in the PR that ships something worth knowing
// about; fixes and polish nobody would notice do not need one.

export type WhatsNewItem = {
  title: string;
  body: string;
  /** Where to try it. */
  link?: { label: string; to: '/settings' | '/media'; hash?: string };
};

export type WhatsNewEntry = {
  /** The day it shipped, YYYY-MM-DD. Also what "seen" is measured against. */
  id: string;
  title: string;
  items: WhatsNewItem[];
};

export const whatsNew: WhatsNewEntry[] = [
  {
    id: '2026-11-10',
    title: 'Legal pages, replacing images and a site icon',
    items: [
      {
        title: 'Legal pages',
        body: 'Edit the privacy policy and terms in Settings › Legal. Admins publish changes, and every published version is kept.',
        link: { label: 'Open Settings › Legal', to: '/settings', hash: 'legal' },
      },
      {
        title: 'Replace an image',
        body: 'In Media, open an image and choose Replace file. Everything using it shows the new file, with the same alt text and caption.',
        link: { label: 'Open Media', to: '/media' },
      },
      {
        title: 'Site icon',
        body: 'Choose the icon for browser tabs and phone home screens in Settings › General.',
        link: { label: 'Open Settings', to: '/settings', hash: 'general' },
      },
    ],
  },
];

/** Midnight in Melbourne on the entry's day. */
const shippedAt = (entry: WhatsNewEntry) => Date.parse(`${entry.id}T00:00:00+11:00`);

/**
 * The entries this person has not seen, newest first. Before they have
 * dismissed anything, that is everything shipped since their account was
 * made, so someone joining later is not greeted with old news.
 */
export function unseenEntries(
  entries: WhatsNewEntry[],
  lastSeenId: string | null,
  joinedAt: number
): WhatsNewEntry[] {
  return entries.filter((entry) =>
    lastSeenId === null ? shippedAt(entry) >= joinedAt : entry.id > lastSeenId
  );
}
