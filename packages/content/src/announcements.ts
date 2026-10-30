// Announcement bars are prepared ahead, each with an optional window. These
// rules decide which one shows, shared by the CMS (status, clashes) and the
// website (what to render).
import { normalizePath } from './redirects';

export const announcementBackgrounds = ['moss', 'ink', 'sun', 'paper'] as const;
export type AnnouncementBackground = (typeof announcementBackgrounds)[number];

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
