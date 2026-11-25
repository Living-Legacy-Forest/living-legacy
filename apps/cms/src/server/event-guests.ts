import {
  bookingProblem,
  guestInputSchema,
  normaliseEmail,
  promoteProblem,
  seatsTaken,
  waitlistProblem,
} from '@ll/content';
import { eventBookings, events } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';
import { readSiteSettings } from '@/lib/site-settings';
import { logActivity } from './activity-log';
import {
  bookable,
  insertBooking,
  insertWaitlisted,
  promoteBooking,
  updateBookingDetails,
} from './booking-store';
import { checkInByCode } from './tickets';

export const getGuests = createServerFn({ method: 'GET' })
  .middleware([requirePermission('events:manage')])
  .validator(z.object({ eventId: z.string() }))
  .handler(async ({ data }) => {
    const [rows, settings] = await Promise.all([
      getDb()
        .select()
        .from(eventBookings)
        .where(eq(eventBookings.eventId, data.eventId))
        .orderBy(asc(eventBookings.firstName), asc(eventBookings.lastName)),
      readSiteSettings(),
    ]);
    const guests = rows.map((r) => ({
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
      confirmationSentAt: r.confirmationSentAt?.getTime() ?? null,
      createdAt: r.createdAt.getTime(),
    }));
    // Only the one setting leaves the server: the list flags unsent confirmations while the CMS sends them.
    return { guests, sendsConfirmations: settings.sendBookingConfirmations };
  });

export type Guest = Awaited<ReturnType<typeof getGuests>>['guests'][number];

/**
 * Books a guest in, or, with `waitlist`, puts them on the waiting list because the event has no
 * room for them. The waiting list holds no place; staff move people in by hand when places free
 * up, as HubSpot (not the CMS) is what emails guests.
 */
export const addGuest = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(guestInputSchema.extend({ waitlist: z.boolean().default(false) }))
  .handler(async ({ data, context }) => {
    const db = getDb();
    const event = await db.query.events.findFirst({ where: eq(events.id, data.eventId) });
    if (!event) throw new Error('That event no longer exists.');
    const bookings = await db
      .select({ status: eventBookings.status, partySize: eventBookings.partySize })
      .from(eventBookings)
      .where(eq(eventBookings.eventId, event.id));
    const taken = seatsTaken(bookings);
    const now = Date.now();
    const details = {
      eventId: event.id,
      firstName: data.firstName,
      lastName: data.lastName || null,
      email: data.email ? normaliseEmail(data.email) : null,
      phone: data.phone || null,
      partySize: data.partySize,
      note: data.note || null,
    };

    if (data.waitlist) {
      const problem = waitlistProblem(bookable(event), data.partySize, taken, now);
      if (problem) throw new Error(problem);
      const entry = await insertWaitlisted(db, details);
      await logActivity(db, {
        actorId: context.user.id,
        actorName: context.user.name,
        action: 'event.guest_waitlisted',
        summary: `Put ${data.firstName} (${data.partySize}) on the waiting list for ${event.title}`,
      });
      return { reference: entry.reference, waitlisted: true as const };
    }

    // When room is the only thing in the way, say there is somewhere else for them to go.
    const toWait = (message: string) =>
      event.capacity !== null &&
      bookingProblem(
        { ...bookable(event), capacity: null },
        data.partySize,
        taken,
        now,
        'staff'
      ) === null
        ? `${message} You can put them on the waiting list instead.`
        : message;
    const problem = bookingProblem(bookable(event), data.partySize, taken, now, 'staff');
    if (problem) throw new Error(toWait(problem));

    const booking = await insertBooking(
      db,
      { ...details, source: 'staff', consentAt: null },
      event.capacity
    );
    if (!booking) throw new Error(toWait('This event is fully booked.'));

    await logActivity(db, {
      actorId: context.user.id,
      actorName: context.user.name,
      action: 'event.guest_added',
      summary: `Added ${data.firstName} (${data.partySize}) to ${event.title}`,
    });
    // New bookings start unsynced; the HubSpot sync picks them up.
    return { reference: booking.reference, waitlisted: false as const };
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

    if (booking.status === 'waitlisted') {
      // They hold no place, so there is no room to check, and HubSpot has not heard of them.
      await db.batch([
        db
          .update(eventBookings)
          .set({
            firstName: data.firstName,
            lastName: data.lastName || null,
            email: data.email ? normaliseEmail(data.email) : null,
            phone: data.phone || null,
            partySize: data.partySize,
            note: data.note || null,
          })
          .where(and(eq(eventBookings.id, booking.id), eq(eventBookings.status, 'waitlisted'))),
        logActivity(db, {
          actorId: context.user.id,
          actorName: context.user.name,
          action: 'event.guest_updated',
          summary: `Updated the waiting list entry ${booking.reference}`,
        }),
      ]);
      return;
    }

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
    if (booking.status === 'waitlisted')
      throw new Error('Remove them from the waiting list instead.');
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

/** Moves a waiting party into the event, if its places are still there. */
export const promoteGuest = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const db = getDb();
    const booking = await db.query.eventBookings.findFirst({
      where: eq(eventBookings.id, data.id),
    });
    if (!booking || booking.status !== 'waitlisted') {
      throw new Error('They are no longer on the waiting list.');
    }
    const event = await db.query.events.findFirst({ where: eq(events.id, booking.eventId) });
    if (!event) throw new Error('That event no longer exists.');
    // Everything but room: a party can be moved in only to an event that can still be booked.
    const closed = bookingProblem(
      { ...bookable(event), capacity: null },
      booking.partySize,
      0,
      Date.now(),
      'staff'
    );
    if (closed) throw new Error(closed);

    const moved = await promoteBooking(db, booking.id, event.id, booking.partySize, event.capacity);
    if (!moved) {
      const rows = await db
        .select({ status: eventBookings.status, partySize: eventBookings.partySize })
        .from(eventBookings)
        .where(eq(eventBookings.eventId, event.id));
      throw new Error(
        promoteProblem(event.capacity, seatsTaken(rows), booking.partySize) ??
          'They are no longer on the waiting list.'
      );
    }
    await logActivity(db, {
      actorId: context.user.id,
      actorName: context.user.name,
      action: 'event.guest_promoted',
      summary: `Moved ${booking.firstName} (${booking.partySize}) from the waiting list into ${event.title}`,
    });
    return { reference: booking.reference };
  });

/** Takes a party off the waiting list. They were never booked, so nothing is kept of them. */
export const removeFromWaitlist = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const db = getDb();
    const booking = await db.query.eventBookings.findFirst({
      where: eq(eventBookings.id, data.id),
    });
    if (!booking || booking.status !== 'waitlisted') return;
    await db.batch([
      db
        .delete(eventBookings)
        .where(and(eq(eventBookings.id, booking.id), eq(eventBookings.status, 'waitlisted'))),
      logActivity(db, {
        actorId: context.user.id,
        actorName: context.user.name,
        action: 'event.waitlist_removed',
        summary: `Took ${booking.firstName} (${booking.partySize}) off the waiting list`,
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
