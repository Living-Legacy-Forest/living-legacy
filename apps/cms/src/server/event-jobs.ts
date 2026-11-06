import { BOOKING_RETENTION_DAYS } from '@ll/content';
import { createDb } from '@ll/db';
import { eventBookings, events } from '@ll/db/schema';
import { inArray, lte } from 'drizzle-orm';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Guest details go a year after the event ends; the event row stays. */
export async function purgeOldBookings(d1: D1Database, now: Date) {
  const db = createDb(d1);
  const cutoff = new Date(now.getTime() - BOOKING_RETENTION_DAYS * DAY_MS);
  const old = db.select({ id: events.id }).from(events).where(lte(events.endsAt, cutoff));
  await db.delete(eventBookings).where(inArray(eventBookings.eventId, old));
}
