// What's new in the CMS, for the banner and the What's new dialog. Written for
// editors, not developers: a sentence or two on what they can now do and where.
// Add an entry, newest first, in the PR that ships something worth knowing
// about; fixes and polish nobody would notice do not need one.

export type WhatsNewItem = {
  title: string;
  body: string;
  /** Where to try it. */
  link?: {
    label: string;
    to: '/settings' | '/media' | '/profile' | '/events/overview';
    hash?: string;
  };
};

export type WhatsNewEntry = {
  /**
   * The day it shipped, YYYY-MM-DD, with -2, -3 for a second or third note that
   * day. Also what "seen" is measured against, so it must sort newest last.
   */
  id: string;
  title: string;
  items: WhatsNewItem[];
};

export const whatsNew: WhatsNewEntry[] = [
  {
    id: '2026-11-11-5',
    title: 'Faster media and your own brand words',
    items: [
      {
        title: 'Media loads as you scroll',
        body: 'The media library and the image picker show the newest files first and load more as you scroll. Search now looks through every file, including ones not loaded yet.',
        link: { label: 'Open Media', to: '/media' },
      },
      {
        title: 'See uploads as they happen',
        body: 'Uploading several images shows which one is going up, and each appears in the library as soon as it is done. Right-click a file, or press and hold on a phone, to open, copy its link, download or delete it.',
        link: { label: 'Open Media', to: '/media' },
      },
      {
        title: 'Edit the brand language list',
        body: 'Settings now has Brand language: the words the content score flags in posts, and what to write instead. Add, change or remove them to suit how you write.',
        link: { label: 'Open Settings', to: '/settings', hash: 'brand-language' },
      },
      {
        title: 'Import a document',
        body: 'In a post, choose Import document from the … menu and drop in a Word file, or choose one. It replaces the post’s content until you save.',
      },
    ],
  },
  {
    id: '2026-11-11-4',
    title: 'Draft posts with Claude',
    items: [
      {
        title: 'Connect an AI tool to the CMS',
        body: 'Admins can connect Claude, or another tool that speaks MCP, from Integrations. It can read posts, check wording against the brand guide and write drafts. Nothing it writes goes live until someone publishes it. Integrations explains how to connect.',
      },
    ],
  },
  {
    id: '2026-11-11-3',
    title: 'Bring back an earlier privacy or terms page',
    items: [
      {
        title: 'Restore a version',
        body: 'On the privacy policy or terms page, open a version under History and choose Restore as draft. Check it, then publish it to make it live again.',
        link: { label: 'Open Settings', to: '/settings' },
      },
    ],
  },
  {
    id: '2026-11-11-2',
    title: 'An overview of your events',
    items: [
      {
        title: 'See how events are going',
        body: 'Events now has an Overview: the next 30 days and how full each date is, then bookings, turn-up and locations over the last 30 days, 90 days or 12 months.',
        link: { label: 'Open the overview', to: '/events/overview' },
      },
      {
        title: 'A dashboard for each event',
        body: 'Open an event and choose Dashboard, beside Details and Guests, to see how it filled, how far ahead people booked, party sizes and who came. For a repeating event, look at all its dates together or one at a time.',
      },
    ],
  },
  {
    id: '2026-11-11',
    title: 'Trends on the dashboard',
    items: [
      {
        title: 'See the last 12 weeks at a glance',
        body: 'The figures at the top of the dashboard now show how posts, drafts and media have changed week by week, and how many locations are open or coming soon. Point at a chart to see a week’s count.',
      },
    ],
  },
  {
    id: '2026-11-10-3',
    title: 'Rename files in Media',
    items: [
      {
        title: 'Rename a file',
        body: 'In Media, open a file and change its name. Anything already using it keeps working, and it is easier to find by search.',
        link: { label: 'Open Media', to: '/media' },
      },
    ],
  },
  {
    id: '2026-11-10-2',
    title: 'A tidier profile, your own theme and avatars',
    items: [
      {
        title: 'Choose an avatar',
        body: 'No photo? Click your picture in your profile and choose a drawn avatar that feels like you. Team members can have one too.',
        link: { label: 'Open your profile', to: '/profile' },
      },
      {
        title: 'Your own theme',
        body: 'Choose light, dark or to match your device in your profile. It only changes the CMS for you.',
        link: { label: 'Open your profile', to: '/profile', hash: 'appearance' },
      },
      {
        title: 'Signed-in devices',
        body: 'See everywhere you are signed in, and sign out a lost or shared device from your profile.',
        link: { label: 'Open your profile', to: '/profile', hash: 'devices' },
      },
    ],
  },
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
const shippedAt = (entry: WhatsNewEntry) => Date.parse(`${entry.id.slice(0, 10)}T00:00:00+11:00`);

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
