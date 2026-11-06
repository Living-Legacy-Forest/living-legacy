import { eventIcs } from '@ll/content';
import type { Db } from '@ll/db';
import { eventBookings, events, locations } from '@ll/db/schema';
import { and, eq, isNotNull } from 'drizzle-orm';
import { sendBookingConfirmation, sendEventCancelled, sendEventReminder } from '@/lib/email';
import { formatDateTime, zoneName } from '@/lib/format';
import { readSiteSettings } from '@/lib/site-settings';

type BookingRow = typeof eventBookings.$inferSelect;

/** What every guest email needs about the event, formatted in the site time zone. */
export async function mailDetails(db: Db, eventId: string) {
  const [row] = await db
    .select({ event: events, location: locations })
    .from(events)
    .leftJoin(locations, eq(events.locationId, locations.id))
    .where(eq(events.id, eventId));
  if (!row) return null;
  const settings = await readSiteSettings();
  const { event, location } = row;
  return {
    event,
    when: `${formatDateTime(event.startsAt.getTime(), settings.timeZone)} ${zoneName(settings.timeZone, event.startsAt.getTime())}`,
    venue: event.venue ?? location?.address ?? '',
    mapUrl: location?.mapUrl ?? null,
    replyTo: location?.email || settings.contactEmail,
  };
}

/** Best effort: a failed email is logged and never undoes the booking. */
export async function emailConfirmation(db: Db, booking: BookingRow): Promise<boolean> {
  if (!booking.email) return false;
  const d = await mailDetails(db, booking.eventId);
  if (!d) return false;
  try {
    await sendBookingConfirmation(booking.email, {
      firstName: booking.firstName,
      title: d.event.title,
      when: d.when,
      venue: d.venue,
      mapUrl: d.mapUrl,
      partySize: booking.partySize,
      reference: booking.reference,
      replyTo: d.replyTo,
      ics: eventIcs({
        uid: `${booking.reference}@livinglegacy.com.au`,
        title: d.event.title,
        startsAt: d.event.startsAt.getTime(),
        endsAt: d.event.endsAt.getTime(),
        location: d.venue,
        description: d.event.summary ?? '',
        now: Date.now(),
      }),
    });
    return true;
  } catch (error) {
    console.error('[events] confirmation email failed', booking.reference, error);
    return false;
  }
}

export async function emailReminder(
  db: Db,
  booking: BookingRow,
  details?: Awaited<ReturnType<typeof mailDetails>>
): Promise<boolean> {
  if (!booking.email) return false;
  const d = details ?? (await mailDetails(db, booking.eventId));
  if (!d) return false;
  try {
    await sendEventReminder(booking.email, {
      firstName: booking.firstName,
      title: d.event.title,
      when: d.when,
      venue: d.venue,
      mapUrl: d.mapUrl,
      partySize: booking.partySize,
      reference: booking.reference,
      replyTo: d.replyTo,
    });
    return true;
  } catch (error) {
    console.error('[events] reminder email failed', booking.reference, error);
    return false;
  }
}

/** Tells every confirmed guest with an email; returns how many were sent. */
export async function emailCancellation(db: Db, eventId: string): Promise<number> {
  const d = await mailDetails(db, eventId);
  if (!d) return 0;
  const guests = await db
    .select()
    .from(eventBookings)
    .where(
      and(
        eq(eventBookings.eventId, eventId),
        eq(eventBookings.status, 'confirmed'),
        isNotNull(eventBookings.email)
      )
    );
  let sent = 0;
  for (const g of guests) {
    try {
      await sendEventCancelled(g.email!, {
        firstName: g.firstName,
        title: d.event.title,
        when: d.when,
        venue: d.venue,
        mapUrl: d.mapUrl,
        replyTo: d.replyTo,
      });
      sent++;
    } catch (error) {
      console.error('[events] cancellation email failed', g.reference, error);
    }
  }
  return sent;
}
