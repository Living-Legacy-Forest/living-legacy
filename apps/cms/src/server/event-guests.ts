import { bookingProblem, guestInputSchema, normaliseEmail, seatsTaken } from '@ll/content';
import { eventBookings, events } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';
import { logActivity } from './activity-log';
import { insertBooking } from './booking-store';

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
