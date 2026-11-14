// Announcement bars are prepared ahead, each with an optional window. These
// rules decide which one shows, shared by the CMS (status, clashes) and the
// website (what to render).
import { normalizePath } from './redirects';

/** The website's palette, which every announcement used before colours could be picked freely. */
export const announcementBackgrounds = ['moss', 'ink', 'sun', 'paper'] as const;
export type AnnouncementPalette = (typeof announcementBackgrounds)[number];

/**
 * An announcement's background: one of the palette names above (older announcements), or a hex
 * colour such as #2c4633 picked in the CMS.
 */
export type AnnouncementBackground = AnnouncementPalette | `#${string}`;

const HEX_BACKGROUND = /^#[0-9a-f]{6}$/i;

export function isAnnouncementBackground(value: string): value is AnnouncementBackground {
  return (
    (announcementBackgrounds as readonly string[]).includes(value) || HEX_BACKGROUND.test(value)
  );
}

/** Text colours the bar can use: the website's ink and paper. */
const INK = '#17231c';
const PAPER = '#f6f2e9';

/** The palette as colours, matching the website's global.css. */
const paletteColours: Record<AnnouncementPalette, { bg: string; fg: string }> = {
  moss: { bg: '#2c4633', fg: PAPER },
  ink: { bg: '#17231c', fg: PAPER },
  sun: { bg: '#d8c493', fg: INK },
  paper: { bg: '#ece5d6', fg: INK },
};

function luminance(hex: string) {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrastOf(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The bar's background and a text colour readable on it (ink or paper, whichever contrasts more).
 * Anything unrecognised falls back to moss, so a bad value never leaves the bar unreadable.
 */
export function announcementColours(background: string): { bg: string; fg: string } {
  if ((announcementBackgrounds as readonly string[]).includes(background)) {
    return paletteColours[background as AnnouncementPalette];
  }
  if (!HEX_BACKGROUND.test(background)) return paletteColours.moss;
  const bg = background.toLowerCase();
  return { bg, fg: contrastOf(bg, INK) >= contrastOf(bg, PAPER) ? INK : PAPER };
}

/** The WCAG contrast between the bar's text and its background. */
export function announcementContrast(background: string): number {
  const { bg, fg } = announcementColours(background);
  return contrastOf(bg, fg);
}

/** Past this length the default message wraps onto two lines on a phone. */
export const ANNOUNCEMENT_MOBILE_LENGTH = 50;

export type AnnouncementWindow = {
  id: string;
  enabled: boolean;
  /** Blank shows it as soon as it is enabled. */
  startsAt: number | null;
  /** Blank never expires. */
  endsAt: number | null;
  hidePaths: string[];
};

export type AnnouncementStatus = 'off' | 'scheduled' | 'live' | 'ended';

export function announcementStatus(a: AnnouncementWindow, now: number): AnnouncementStatus {
  if (!a.enabled) return 'off';
  if (a.startsAt !== null && now < a.startsAt) return 'scheduled';
  if (a.endsAt !== null && now >= a.endsAt) return 'ended';
  return 'live';
}

/** Whether the bar is hidden on this page. A trailing * hides a whole section. */
export function hiddenOn(a: AnnouncementWindow, pathname: string): boolean {
  const path = normalizePath(pathname);
  return a.hidePaths.some((hide) =>
    hide.endsWith('*')
      ? path.startsWith(hide.slice(0, -1).toLowerCase())
      : normalizePath(hide) === path
  );
}

/**
 * The announcement to show now, or null. When windows overlap, the one that
 * started most recently wins, so a short promotion sits on top of a standing one.
 */
export function currentAnnouncement<T extends AnnouncementWindow>(
  list: T[],
  now: number,
  pathname?: string
): T | null {
  const live = list.filter(
    (a) => announcementStatus(a, now) === 'live' && !(pathname && hiddenOn(a, pathname))
  );
  live.sort((a, b) => (b.startsAt ?? -Infinity) - (a.startsAt ?? -Infinity));
  return live[0] ?? null;
}

const start = (a: AnnouncementWindow) => a.startsAt ?? -Infinity;
const end = (a: AnnouncementWindow) => a.endsAt ?? Infinity;

/** For each enabled, unfinished announcement, the others whose windows overlap it. */
export function announcementClashes<T extends AnnouncementWindow>(
  list: T[],
  now: number
): Map<string, T[]> {
  const active = list.filter((a) => a.enabled && end(a) > now);
  return new Map(
    active.map((a) => [
      a.id,
      active.filter((b) => b.id !== a.id && start(a) < end(b) && start(b) < end(a)),
    ])
  );
}
