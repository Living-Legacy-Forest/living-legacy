import { BOOKING_RETENTION_DAYS } from '@ll/content';
import { createDb } from '@ll/db';
import { eventBookings, events } from '@ll/db/schema';
import { and, eq, gt, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import { emailReminder, mailDetails } from './event-mail';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Reminds guests about 24 hours ahead. Each event is claimed by setting
 * reminder_sent_at only where it is still null, so a second run of the cron
 * finds nothing to send.
 */
export async function sendDueReminders(d1: D1Database, now: Date) {
  const db = createDb(d1);
  const due = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.status, 'published'),
        isNull(events.reminderSentAt),
        gt(events.startsAt, now),
        lte(events.startsAt, new Date(now.getTime() + DAY_MS))
      )
    );
  for (const { id } of due) {
    const claimed = await db
      .update(events)
      .set({ reminderSentAt: now })
      .where(and(eq(events.id, id), isNull(events.reminderSentAt)))
      .returning({ id: events.id });
    if (claimed.length === 0) continue;
    const details = await mailDetails(db, id);
    const guests = await db
      .select()
      .from(eventBookings)
      .where(
        and(
          eq(eventBookings.eventId, id),
          eq(eventBookings.status, 'confirmed'),
          isNotNull(eventBookings.email)
        )
      );
    for (const g of guests) await emailReminder(db, g, details);
  }
}

/** Guest details go a year after the event ends; the event row stays. */
export async function purgeOldBookings(d1: D1Database, now: Date) {
  const db = createDb(d1);
  const cutoff = new Date(now.getTime() - BOOKING_RETENTION_DAYS * DAY_MS);
  const old = db.select({ id: events.id }).from(events).where(lte(events.endsAt, cutoff));
  await db.delete(eventBookings).where(inArray(eventBookings.eventId, old));
}
