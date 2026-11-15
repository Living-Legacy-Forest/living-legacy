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
    to:
      | '/settings'
      | '/media'
      | '/profile'
      | '/events'
      | '/events/overview'
      | '/locations'
      | '/search-replace'
      | '/system'
      | '/analytics'
      | '/analytics/visitors'
      | '/analytics/enquiries'
      | '/analytics/traffic'
      | '/analytics/audience'
      | '/activity';
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
    id: '2026-11-16-2',
    title: 'Shortcuts you can change',
    items: [
      {
        title: 'A theme button in the sidebar',
        body: 'The light and dark switch has moved from your account menu to the bottom of the sidebar: one press flips between them. Match my device is still on your Profile.',
        link: { label: 'Open Profile', to: '/profile' },
      },
      {
        title: 'Set your own keys',
        body: 'Keyboard shortcuts now has its own button at the bottom of the sidebar. It lets you change the keys for search, the sidebar and saving a post, and search the whole list. Hold a key such as Option or Ctrl and it lights up in every row. Your changes stay in the browser you made them in.',
      },
    ],
  },
  {
    id: '2026-11-16',
    title: 'A fresher sign-in page',
    items: [
      {
        title: 'Sign in, with a little more help',
        body: 'The sign-in page has a new look. After you ask for a link it moves on to a Check your inbox step, where you can send the link again after a minute or switch to a different email. It also suggests a fix if an address looks mistyped, like gmial.com.',
      },
    ],
  },
  {
    id: '2026-11-15-8',
    title: 'Locations have their own page',
    items: [
      {
        title: 'More room for a location',
        body: 'Adding or editing a location now takes you to its own page, with the form on the left, the map on the right, and publishing, listing and visiting details under the form. Hide the map with the button at the top when you do not need it. The Locations page itself is now the map: click a pin to open its quick view, and use the list button at the top to bring the list back for searching, filters and removing several at once.',
        link: { label: 'Open Locations', to: '/locations' },
      },
    ],
  },
  {
    id: '2026-11-15-7',
    title: 'Events have their own page',
    items: [
      {
        title: 'More room for an event',
        body: 'Opening an event, or making a new one, now takes you to its own page, like a post: the description in the middle, and bookings, places and dates at the side. Guests and the dashboard are tabs at the top.',
        link: { label: 'Open Events', to: '/events' },
      },
    ],
  },
  {
    id: '2026-11-15-5',
    title: 'A calendar of activity',
    items: [
      {
        title: 'A year of changes at a glance',
        body: 'Activity, under Admin, now opens with a calendar of the past year: a square a day, darker the busier it was. Pick a person to see their year, or click a day to list only its changes.',
        link: { label: 'Open Activity', to: '/activity' },
      },
      {
        title: 'Your own activity on your profile',
        body: 'Your profile shows the same calendar for the changes you have made.',
        link: { label: 'Open your profile', to: '/profile' },
      },
    ],
  },
  {
    id: '2026-11-15-4',
    title: 'A new sidebar',
    items: [
      {
        title: 'Sections and their pages, side by side',
        body: "The sidebar now has two columns: the sections (Dashboard, Content, Places, About, Analytics and Admin) down the left, and the pages of the one you are in beside them. Each column can show names or only icons: use the button at its top, or press ⌘B to show or hide the page names. The CMS remembers your choice. Search and What's new are at the foot of the sections.",
      },
    ],
  },
  {
    id: '2026-11-15-3',
    title: 'A map of where visitors are',
    items: [
      {
        title: 'Audience now has a map',
        body: "Audience shows a map with a bubble for each busy city, sized by its visits, beside the countries or cities ranked. Hover a bubble for the city and its visits. No IP addresses are kept: places come from the visitor's network.",
        link: { label: 'Open Audience', to: '/analytics/audience' },
      },
    ],
  },
  {
    id: '2026-11-15-2',
    title: 'Visits over time, by channel and device',
    items: [
      {
        title: 'Streams on Traffic and Audience',
        body: 'Traffic now shows how visits from search, direct, social, other websites and email change day by day, and Audience does the same for desktop, mobile and tablet. Hover a stream to see that day, or a layer to follow it.',
        link: { label: 'Open Traffic', to: '/analytics/traffic' },
      },
    ],
  },
  {
    id: '2026-11-15',
    title: 'Analytics for the website',
    items: [
      {
        title: 'An Analytics section',
        body: 'A new Analytics group in the sidebar shows how the website is doing over 7, 30 or 90 days. Overview has visitors, page views, bounce rate and visit length against the period before. Pages lists every page with its views and time on page, Traffic shows where visits come from, and Audience shows countries, cities, devices and browsers.',
        link: { label: 'Open Analytics', to: '/analytics' },
      },
      {
        title: 'Enquiries, counted here',
        body: 'Enquiries shows the forms sent through the website: which form, which location it was about, and the page each visit started on. It counts from today, so it fills up over the coming days.',
        link: { label: 'Open Enquiries', to: '/analytics/enquiries' },
      },
      {
        title: 'Visitors has moved',
        body: 'Visitors is now under Analytics. Old links still open it.',
        link: { label: 'Open Visitors', to: '/analytics/visitors' },
      },
    ],
  },
  {
    id: '2026-11-14-7',
    title: 'See who visits the website',
    items: [
      {
        title: 'A Visitors page',
        body: 'Visitors, under Analytics, lists recent visits to the website, newest first: where each visitor was, the device and browser they used, where they came from (a search engine, social media, another site or directly), the first and last page they read, and how many pages they viewed. Pick 7, 30 or 90 days. No IP addresses are shown.',
        link: { label: 'Open Visitors', to: '/analytics/visitors' },
      },
    ],
  },
  {
    id: '2026-11-14-6',
    title: 'A clearer Settings page',
    items: [
      {
        title: 'Settings in two columns, with tabs to jump around',
        body: 'Each part of Settings now has its title and what it is for on the left and the settings beside it, and a row of tabs along the top takes you to any part. It is still one page with one Save. The theme is now picked from three small pictures: light, dark or system.',
        link: { label: 'Open Settings', to: '/settings' },
      },
    ],
  },
  {
    id: '2026-11-14-5',
    title: 'Pick any colour for an announcement',
    items: [
      {
        title: 'A colour picker for the announcement bar',
        body: 'Announcements are no longer limited to four colours. Open an announcement, then Background colour, and drag to pick a colour, type a hex code, or tap one of the four website colours saved in the panel. The text on the bar switches between dark and light to stay readable, and the panel shows how readable it is.',
      },
    ],
  },
  {
    id: '2026-11-14-4',
    title: 'Resize the post panel',
    items: [
      {
        title: 'Make the properties panel wider or narrower',
        body: 'When you edit a post on a large screen, drag the line between the writing area and the panel on the right to give either one more room. Double-click the line to put it back, or focus it and use the arrow keys. The button above the editor still hides the panel.',
      },
    ],
  },
  {
    id: '2026-11-14-3',
    title: 'Media storage on the dashboard',
    items: [
      {
        title: 'See what the media library takes up',
        body: 'The Media files card now shows how much of the 10 GB of storage included each month the library uses, as a bar split into images, videos, PDFs and other files (point at it to see each), and how much was added in the last 7, 30 or 90 days. The System page lists the breakdown, has a meter for the database beside it, and estimates how long the allowance will last at the current pace.',
        link: { label: 'Open System', to: '/system' },
      },
    ],
  },
  {
    id: '2026-11-14-2',
    title: 'Dashboard cards use 7, 30 or 90 days',
    items: [
      {
        title: 'Pick the span for each card',
        body: 'The Blog views, Events and Media files cards now have a menu for 7, 30 or 90 days, instead of weeks and months. The big number and the change underneath cover the span you pick, so "+120 vs previous 30 days" compares the same stretch of time as the figure above it.',
      },
    ],
  },
  {
    id: '2026-11-14',
    title: 'Blog views on the dashboard',
    items: [
      {
        title: 'See how often the blog is read',
        body: 'The Posts card on the dashboard now shows views of the blog, from the website, over the last 12 weeks or 12 months. Use the menu in its corner to switch. It still links to the posts list, and says so on the card if the website analytics are not connected or cannot be reached.',
      },
    ],
  },
  {
    id: '2026-11-13-6',
    title: 'Dashboard cards show weeks or months',
    items: [
      {
        title: 'Switch the cards between 12 weeks and 12 months',
        body: 'The Posts, Events and Media files cards on the dashboard now have a menu in the corner. Choose 12 months to see each month instead of each week, and the change underneath follows it. The charts are line charts you can hover over or drag along to read any point.',
      },
      {
        title: 'The trend chart is now about website traffic',
        body: 'It shows unique visitors, each counted once for the whole period, or page views, over the last 7, 30 or 90 days. It no longer shows posts published or people booked, which the cards above cover. Needs attention now sits beside Locations.',
      },
    ],
  },
  {
    id: '2026-11-13-5',
    title: 'A trend chart on the dashboard',
    items: [
      {
        title: 'See how things are going over time',
        body: 'The dashboard now has a chart of people booked or posts published over the last 7, 30 or 90 days, with the same span before it as a dashed line and the change between them. When website analytics are connected it can show visits and page views too. Pick what it shows from the menu at the top of the chart.',
      },
      {
        title: 'More detail on the System page',
        body: 'Admins can now see how full the database is, what the media library holds, how many times each job ran in the last two weeks and how long they took.',
        link: { label: 'Open System', to: '/system' },
      },
    ],
  },
  {
    id: '2026-11-13-4',
    title: 'Uploads show each file as it goes',
    items: [
      {
        title: 'See every image upload on its own',
        body: 'Upload on the Media page now lists each image with its own progress bar and a tick when it is in. If one fails, it says why and offers Retry, while the rest carry on. Dropping images anywhere on the page opens the same list.',
        link: { label: 'Open Media', to: '/media' },
      },
      {
        title: 'Paste a picture straight in',
        body: 'Copy an image or screenshot, point at any upload box (Media, a featured image, a gallery) and paste. Word imports and CSV imports take a dropped or pasted file the same way.',
      },
    ],
  },
  {
    id: '2026-11-13-3',
    title: 'Light or dark from your account menu',
    items: [
      {
        title: 'Change the theme in one click',
        body: 'Open the menu behind your photo, top right, and pick light, dark or match my device. On a phone it is at the bottom of More. The choice is yours alone, the same one as Appearance on your profile.',
        link: { label: 'Open your profile', to: '/profile', hash: 'appearance' },
      },
    ],
  },
  {
    id: '2026-11-13-2',
    title: 'Filters and a grid view on every list',
    items: [
      {
        title: 'Filter by more than one thing',
        body: 'Posts, events, team, FAQs, redirects, testimonials, media coverage, announcements, locations, categories and tags each have a Filter button beside the search. Tick as many options as you like, such as two categories and one author, and the list shows what matches. Clear all puts everything back.',
      },
      {
        title: 'Switch between a list and a grid',
        body: 'The pair of buttons beside Filter shows each item as a row or as a card with its picture. Each page remembers the view you left it in.',
      },
    ],
  },
  {
    id: '2026-11-13',
    title: 'Notifications you can sort through',
    items: [
      {
        title: 'Read, unread and dismiss',
        body: 'The bell, top right, now counts what you have not read yet. Opening something marks it read. Each notification has buttons to mark it read or unread, or dismiss it. Switch to Unread to see only what is left, use Mark all read to catch up, and Clear read to tidy the list.',
      },
    ],
  },
  {
    id: '2026-11-12-3',
    title: 'Report a problem',
    items: [
      {
        title: 'Tell us when something goes wrong',
        body: 'Open your account menu (your picture, top right) and choose Report a problem. Say what you were doing and what happened, and add a screenshot if it helps. It reaches the developers with what they need to look into it.',
      },
    ],
  },
  {
    id: '2026-11-12-3',
    title: 'A System page for admins',
    items: [
      {
        title: 'See that everything is working',
        body: 'Admins can now check the website, database, file storage, HubSpot and email in one place, and see the jobs the CMS runs on its own, such as publishing scheduled posts: when each last ran and any that failed. A coloured dot beside the bell shows how things are at a glance, and anything that needs a look also shows in Needs attention on the dashboard.',
        link: { label: 'Open System', to: '/system' },
      },
    ],
  },
  {
    id: '2026-11-12-2',
    title: 'Search and replace, and who else is editing',
    items: [
      {
        title: 'See who else is editing a post',
        body: 'When someone else has the same post open, a note above the editor says so. If they save while you are working, it tells you, with a Reload button, before you save over their changes.',
      },
      {
        title: 'Change a phrase everywhere at once',
        body: 'Admins can now find a word or phrase in posts, legal pages, events, FAQs, locations and the rest of the CMS, see every match, and replace it in one go. Published pages keep their previous version in their history.',
        link: { label: 'Open Search & replace', to: '/search-replace' },
      },
    ],
  },
  {
    id: '2026-11-12',
    title: 'Scan tickets at the door',
    items: [
      {
        title: 'Check guests in with the camera',
        body: 'In an event’s Guests tab, Scan tickets opens the camera. Point it at the QR code on a guest’s ticket and they are checked in straight away. It also tells you when a ticket is for another date, was cancelled or has already been scanned, and you can type a reference instead.',
        link: { label: 'Open Events', to: '/events/overview' },
      },
      {
        title: 'Edit a booking',
        body: 'In the Guests tab, the … menu on a guest now has Edit booking: change their name, contact details, number of people or note. A bigger party still has to fit in the event.',
      },
      {
        title: 'Choose when bookings open',
        body: 'Under Date & time, Bookings open sets when online bookings start, next to when they close. New events also allow up to 10 people per booking.',
      },
    ],
  },
  {
    id: '2026-11-11-7',
    title: 'More control over search and sharing',
    items: [
      {
        title: 'Social sharing for posts',
        body: 'Posts have a Social sharing section with a preview of the card, and a title and description of its own for when the post is shared. Left empty, they use the search listing.',
      },
      {
        title: 'Advanced search settings',
        body: 'Under Search listing, Advanced sets a canonical URL for a post that first appeared elsewhere, and can ask search engines not to follow its links, show a text snippet or index its images.',
      },
      {
        title: 'Two more redirect types',
        body: 'Redirects can now be 307 or 308: like 302 and 301, but a form sent to the old address is sent on to the new one too.',
      },
    ],
  },
  {
    id: '2026-11-11-6',
    title: 'Choose the CMS colour and font',
    items: [
      {
        title: 'A colour for the CMS',
        body: 'Settings, Language & appearance now has Colour: tint buttons, highlights and the sidebar in Stone, Forest, Ocean or Clay, or keep the plain Neutral. It works in light and dark, and changes the CMS for everyone.',
        link: { label: 'Open Settings', to: '/settings', hash: 'appearance' },
      },
      {
        title: 'A font for the CMS',
        body: 'Settings, Language & appearance now has Font: pick Inter, Geist, IBM Plex Sans, Atkinson Hyperlegible or your device’s own font. It changes the CMS for everyone, not the website.',
        link: { label: 'Open Settings', to: '/settings', hash: 'appearance' },
      },
    ],
  },
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
