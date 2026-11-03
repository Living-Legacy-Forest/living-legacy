/**
 * The announcement bar, managed in the CMS (Announcements page) and stored in
 * the shared D1 database. Which one is live, if any, is decided by
 * currentAnnouncement from @ll/content — the same rule the CMS uses to show
 * status and flag clashes, so the site and the admin never disagree.
 */
import {
  type AnnouncementBackground,
  type AnnouncementWindow,
  currentAnnouncement,
} from '@ll/content';
import { env } from 'cloudflare:workers';

/** The slice of the D1 binding used here, so the site needs no Workers type package. */
interface D1 {
  prepare(query: string): {
    all<T>(): Promise<{ results: T[] }>;
  };
}

const db = (env as { DB?: D1 }).DB;

export type Announcement = AnnouncementWindow & {
  message: string;
  messageTablet: string;
  messageDesktop: string;
  ctaLabel: string;
  ctaUrl: string;
  background: AnnouncementBackground;
};

type Row = {
  id: string;
  enabled: number;
  message: string;
  message_tablet: string | null;
  message_desktop: string | null;
  cta_label: string | null;
  cta_url: string | null;
  background: AnnouncementBackground;
  starts_at: number | null;
  ends_at: number | null;
  hide_paths: string;
};

/** How long an isolate reuses the list before reading it again. */
const CACHE_MS = 60_000;
let cache: { rows: Announcement[]; expires: number } | undefined;

async function loadAnnouncements(): Promise<Announcement[]> {
  if (!db) return [];
  if (cache && cache.expires > Date.now()) return cache.rows;

  try {
    const { results } = await db
      .prepare(
        `SELECT id, enabled, message, message_tablet, message_desktop, cta_label, cta_url,
                background, starts_at, ends_at, hide_paths
         FROM announcements`
      )
      .all<Row>();
    const rows = results.map((r): Announcement => ({
      id: r.id,
      enabled: r.enabled === 1,
      message: r.message,
      messageTablet: r.message_tablet ?? '',
      messageDesktop: r.message_desktop ?? '',
      ctaLabel: r.cta_label ?? '',
      ctaUrl: r.cta_url ?? '',
      background: r.background,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      hidePaths: JSON.parse(r.hide_paths) as string[],
    }));
    cache = { rows, expires: Date.now() + CACHE_MS };
    return rows;
  } catch (error) {
    // A database hiccup must not take the site down; serve the last known
    // list, or none, and try again on the next request.
    console.error('[announcements] could not load list', error);
    return cache?.rows ?? [];
  }
}

/** The announcement to show on this page right now, or null for none. */
export async function activeAnnouncement(pathname: string): Promise<Announcement | null> {
  const rows = await loadAnnouncements();
  return currentAnnouncement(rows, Date.now(), pathname);
}
