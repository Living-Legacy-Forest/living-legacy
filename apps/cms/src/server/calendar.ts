import {
  type CalendarMonth,
  can,
  monthKey,
  monthWindow,
  parseMonthKey,
  toZoned,
} from '@ll/content';
import { events, posts } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { and, asc, eq, gte, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { authMiddleware } from '@/lib/session';
import { readSiteSettings } from '@/lib/site-settings';

// The content calendar: posts and events on one month, from dates they already have. Nothing is
// stored for it. A post sits on the day it goes live (scheduled) or went live (published); an
// event on the day it starts, and a draft event that is set to go live also on that day.

export type CalendarEntry = {
  /** Unique across kinds, since an event can appear twice (when it starts, when it goes live). */
  key: string;
  kind: 'post' | 'event' | 'event-live';
  /** Opens the post or event. */
  id: string;
  title: string;
  at: number;
  /** An event's own zone; posts are placed in the site's. */
  timeZone: string | null;
  state: 'scheduled' | 'published' | 'draft' | 'cancelled';
};

type Db = ReturnType<typeof getDb>;

/** Everything the month shows. Events only for people who manage them. */
export async function loadCalendar(
  db: Db,
  month: CalendarMonth,
  { includeEvents }: { includeEvents: boolean }
): Promise<CalendarEntry[]> {
  const { from, to } = monthWindow(month);
  const start = new Date(from);
  const end = new Date(to);
  const live = isNull(posts.deletedAt);

  const [postRows, eventRows] = await Promise.all([
    db
      .select({
        id: posts.id,
        title: posts.title,
        status: posts.status,
        scheduledAt: posts.scheduledAt,
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .where(
        and(
          live,
          or(
            // Going live on its own.
            and(
              eq(posts.status, 'draft'),
              isNotNull(posts.scheduledAt),
              gte(posts.scheduledAt, start),
              lt(posts.scheduledAt, end)
            ),
            // Already live.
            and(
              eq(posts.status, 'published'),
              isNotNull(posts.publishedAt),
              gte(posts.publishedAt, start),
              lt(posts.publishedAt, end)
            )
          )
        )
      )
      .orderBy(asc(posts.scheduledAt), asc(posts.publishedAt)),
    includeEvents
      ? db
          .select({
            id: events.id,
            title: events.title,
            timeZone: events.timeZone,
            status: events.status,
            startsAt: events.startsAt,
            publishAt: events.publishAt,
          })
          .from(events)
          .where(
            or(
              and(gte(events.startsAt, start), lt(events.startsAt, end)),
              and(
                eq(events.status, 'draft'),
                isNotNull(events.publishAt),
                gte(events.publishAt, start),
                lt(events.publishAt, end)
              )
            )
          )
          .orderBy(asc(events.startsAt))
      : Promise.resolve([]),
  ]);

  const entries: CalendarEntry[] = [];
  for (const p of postRows) {
    // The query keeps only the date that matches the status, so one of these is set.
    const at = p.status === 'published' ? p.publishedAt : p.scheduledAt;
    if (!at) continue;
    entries.push({
      key: `post-${p.id}`,
      kind: 'post',
      id: p.id,
      title: p.title,
      at: at.getTime(),
      timeZone: null,
      state: p.status === 'published' ? 'published' : 'scheduled',
    });
  }
  const inWindow = (t: number) => t >= from && t < to;
  for (const e of eventRows) {
    if (inWindow(e.startsAt.getTime())) {
      entries.push({
        key: `event-${e.id}`,
        kind: 'event',
        id: e.id,
        title: e.title,
        at: e.startsAt.getTime(),
        timeZone: e.timeZone,
        state: e.status,
      });
    }
    if (e.status === 'draft' && e.publishAt && inWindow(e.publishAt.getTime())) {
      entries.push({
        key: `event-live-${e.id}`,
        kind: 'event-live',
        id: e.id,
        title: e.title,
        at: e.publishAt.getTime(),
        timeZone: null,
        state: 'scheduled',
      });
    }
  }
  return entries;
}

export const calendarSearch = z.object({
  /** "2026-11"; blank is this month. */
  month: z
    .string()
    .refine((value) => parseMonthKey(value) !== null)
    .optional()
    .catch(undefined),
});

export const getCalendar = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(calendarSearch)
  .handler(async ({ data, context }) => {
    const { timeZone } = await readSiteSettings();
    // "This month" is the site's, which at a month's edge differs from the server's.
    const now = toZoned(Date.now(), timeZone);
    const month = parseMonthKey(data.month) ?? { year: now.year, month: now.month };
    const includeEvents = can(context.user.role, 'events:manage');
    return {
      month: monthKey(month),
      includeEvents,
      entries: await loadCalendar(getDb(), month, { includeEvents }),
    };
  });

export type CalendarData = Awaited<ReturnType<typeof getCalendar>>;
