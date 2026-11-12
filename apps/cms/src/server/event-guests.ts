import { bookingProblem, guestInputSchema, normaliseEmail, seatsTaken } from '@ll/content';
import { eventBookings, events } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';
import { logActivity } from './activity-log';
import { insertBooking, updateBookingDetails } from './booking-store';
import { checkInByCode } from './tickets';

export const getGuests = createServerFn({ method: 'GET' })
  .middleware([requirePermission('events:manage')])
  .validator(z.object({ eventId: z.string() }))
  .handler(async ({ data }) => {
    const rows = await getDb()
      .select()
      .from(eventBookings)
      .where(eq(eventBookings.eventId, data.eventId))
      .orderBy(asc(eventBookings.firstName), asc(eventBookings.lastName));
    return rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      firstName: r.firstName,
      lastName: r.lastName ?? '',
      email: r.email ?? '',
      phone: r.phone ?? '',
      partySize: r.partySize,
      note: r.note ?? '',
      status: r.status,
      source: r.source,
      checkedInAt: r.checkedInAt?.getTime() ?? null,
      createdAt: r.createdAt.getTime(),
    }));
  });

export type Guest = Awaited<ReturnType<typeof getGuests>>[number];

export const addGuest = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(guestInputSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const event = await db.query.events.findFirst({ where: eq(events.id, data.eventId) });
    if (!event) throw new Error('That event no longer exists.');
    const bookings = await db
      .select({ status: eventBookings.status, partySize: eventBookings.partySize })
      .from(eventBookings)
      .where(eq(eventBookings.eventId, event.id));
    const problem = bookingProblem(
      {
        status: event.status,
        startsAt: event.startsAt.getTime(),
        endsAt: event.endsAt.getTime(),
        bookingsOpenAt: event.bookingsOpenAt?.getTime() ?? null,
        bookingsCloseAt: event.bookingsCloseAt?.getTime() ?? null,
        capacity: event.capacity,
        maxPartySize: event.maxPartySize,
      },
      data.partySize,
      seatsTaken(bookings),
      Date.now(),
      'staff'
    );
    if (problem) throw new Error(problem);

    const booking = await insertBooking(
      db,
      {
        eventId: event.id,
        firstName: data.firstName,
        lastName: data.lastName || null,
        email: data.email ? normaliseEmail(data.email) : null,
        phone: data.phone || null,
        partySize: data.partySize,
        note: data.note || null,
        source: 'staff',
        consentAt: null,
      },
      event.capacity
    );
    if (!booking) throw new Error('This event is fully booked.');

    await logActivity(db, {
      actorId: context.user.id,
      actorName: context.user.name,
      action: 'event.guest_added',
      summary: `Added ${data.firstName} (${data.partySize}) to ${event.title}`,
    });
    // New bookings start unsynced; the HubSpot sync picks them up.
    return { reference: booking.reference };
  });

/** Changes a guest's details or party size; the event must still have room for them. */
export const updateGuest = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(guestInputSchema.extend({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const db = getDb();
    const booking = await db.query.eventBookings.findFirst({
      where: eq(eventBookings.id, data.id),
    });
    if (!booking) throw new Error('That booking no longer exists.');
    if (booking.status === 'cancelled') throw new Error('A cancelled booking cannot be changed.');
    const event = await db.query.events.findFirst({ where: eq(events.id, booking.eventId) });
    if (!event) throw new Error('That event no longer exists.');
    if (event.status === 'cancelled') throw new Error('This event has been cancelled.');

    const updated = await updateBookingDetails(
      db,
      booking.id,
      event.id,
      {
        firstName: data.firstName,
        lastName: data.lastName || null,
        email: data.email ? normaliseEmail(data.email) : null,
        phone: data.phone || null,
        partySize: data.partySize,
        note: data.note || null,
      },
      event.capacity
    );
    if (!updated) {
      const left = (event.capacity ?? 0) - (await peopleBookedExcept(event.id, booking.id));
      throw new Error(
        left <= 0
          ? 'This event is fully booked, so the party cannot grow.'
          : `Only ${left} ${left === 1 ? 'place is' : 'places are'} left for this booking.`
      );
    }
    await logActivity(db, {
      actorId: context.user.id,
      actorName: context.user.name,
      action: 'event.guest_updated',
      summary: `Updated the booking ${booking.reference}`,
    });
  });

/** People in this event's confirmed bookings, leaving one booking out. */
async function peopleBookedExcept(eventId: string, bookingId: string) {
  const rows = await getDb()
    .select({
      id: eventBookings.id,
      status: eventBookings.status,
      partySize: eventBookings.partySize,
    })
    .from(eventBookings)
    .where(eq(eventBookings.eventId, eventId));
  return seatsTaken(rows.filter((r) => r.id !== bookingId));
}

export const cancelGuest = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const db = getDb();
    const booking = await db.query.eventBookings.findFirst({
      where: eq(eventBookings.id, data.id),
    });
    if (!booking || booking.status === 'cancelled') return;
    await db.batch([
      db
        .update(eventBookings)
        // Unsynced again, so HubSpot hears about the cancellation.
        .set({ status: 'cancelled', cancelledAt: new Date(), crmSyncedAt: null })
        .where(eq(eventBookings.id, booking.id)),
      logActivity(db, {
        actorId: context.user.id,
        actorName: context.user.name,
        action: 'event.guest_cancelled',
        summary: `Cancelled the booking ${booking.reference}`,
      }),
    ]);
  });

export const setCheckedIn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(z.object({ id: z.string(), checkedIn: z.boolean() }))
  .handler(async ({ data, context }) => {
    const at = data.checkedIn ? new Date() : null;
    await getDb()
      .update(eventBookings)
      .set({ checkedInAt: at, checkedInBy: data.checkedIn ? context.user.id : null })
      .where(eq(eventBookings.id, data.id));
    return { checkedInAt: at?.getTime() ?? null };
  });

/** Checks in the guest whose ticket was scanned (or whose reference was typed) at this event. */
export const scanTicket = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(z.object({ eventId: z.string(), code: z.string().max(500) }))
  .handler(({ data, context }) => checkInByCode(getDb(), data.eventId, data.code, context.user.id));
