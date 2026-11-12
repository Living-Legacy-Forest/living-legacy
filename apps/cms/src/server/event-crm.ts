import { HUBSPOT_EVENT_PROPERTIES, hubspotBookingProperties, latestPerEmail } from '@ll/content';
import { type Db, createDb } from '@ll/db';
import { eventBookings, events, locations } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';

// HubSpot sends every guest email (confirmation, reminder, cancellation) from
// workflows on the contact properties in @ll/content (event-crm.ts). The CMS
// keeps them current: a booking is unsynced (crm_synced_at null) when it is
// made or cancelled, and when its event's time, place or title changes or the
// event is cancelled. Dormant until HUBSPOT_ACCESS_TOKEN is set (a private
// app with crm.objects.contacts.write and crm.schemas.contacts.write).

const API = 'https://api.hubapi.com';
/** HubSpot's batch limit. */
const BATCH = 100;

async function hubspot(token: string, path: string, body: unknown) {
  return fetch(`${API}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

let propertiesReady = false;

/** Creates the event properties on contacts; one that already exists answers 409. */
async function ensureProperties(token: string) {
  if (propertiesReady) return;
  for (const property of HUBSPOT_EVENT_PROPERTIES) {
    const res = await hubspot(token, '/crm/v3/properties/contacts', {
      ...property,
      groupName: 'contactinformation',
    });
    if (!res.ok && res.status !== 409) {
      throw new Error(`creating ${property.name}: HubSpot ${res.status} ${await res.text()}`);
    }
  }
  propertiesReady = true;
}

async function pendingBookings(db: Db) {
  const rows = await db
    .select({
      booking: eventBookings,
      event: events,
      locationName: locations.name,
      address: locations.address,
    })
    .from(eventBookings)
    .innerJoin(events, eq(eventBookings.eventId, events.id))
    .leftJoin(locations, eq(events.locationId, locations.id))
    .where(and(isNull(eventBookings.crmSyncedAt), isNotNull(eventBookings.email)))
    .orderBy(asc(eventBookings.createdAt))
    .limit(BATCH * 2);
  return rows.map(({ booking: b, event: e, locationName, address }) => ({
    id: b.id,
    email: b.email!,
    firstName: b.firstName,
    lastName: b.lastName,
    phone: b.phone,
    partySize: b.partySize,
    reference: b.reference,
    status: b.status,
    createdAt: b.createdAt.getTime(),
    cancelledAt: b.cancelledAt?.getTime() ?? null,
    event: {
      title: e.title,
      startsAt: e.startsAt.getTime(),
      endsAt: e.endsAt.getTime(),
      venue: e.venue || address || '',
      locationName: locationName ?? '',
      status: e.status,
      timeZone: e.timeZone,
    },
  }));
}

/** Sends unsynced bookings to HubSpot, up to one batch a run (the 5-minute cron). */
export async function syncPending(d1: D1Database): Promise<void> {
  const token = env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return;
  const db = createDb(d1);
  const pending = await pendingBookings(db);
  if (pending.length === 0) return;

  // A contact holds one booking; older unsynced ones for the same address are
  // superseded, so they are marked synced along with the one that is sent.
  const sent = latestPerEmail(pending).slice(0, BATCH);
  // The ticket links in the emails point back at this CMS.
  const origin = new URL(env.BETTER_AUTH_URL).origin;
  const byEmail = new Map(sent.map((b) => [b.email.toLowerCase(), b]));
  const now = new Date();

  try {
    await ensureProperties(token);
    const res = await hubspot(token, '/crm/v3/objects/contacts/batch/upsert', {
      inputs: sent.map((b) => ({
        idProperty: 'email',
        id: b.email.toLowerCase(),
        properties: hubspotBookingProperties(b, origin),
      })),
    });
    if (!res.ok) throw new Error(`HubSpot ${res.status} ${await res.text()}`);
    const { results } = (await res.json()) as {
      results: { id: string; properties: { email?: string } }[];
    };
    const contactIds = new Map(
      results.map((r) => [(r.properties.email ?? '').toLowerCase(), r.id])
    );
    for (const email of byEmail.keys()) {
      const ids = pending.filter((p) => p.email.toLowerCase() === email).map((p) => p.id);
      await db
        .update(eventBookings)
        .set({ crmSyncedAt: now, crmContactId: contactIds.get(email) ?? null, crmError: null })
        .where(inArray(eventBookings.id, ids));
    }
  } catch (error) {
    // Left unsynced, so the next run tries again; the reason is kept for staff.
    const message = String(error).slice(0, 500);
    console.error('[events] HubSpot sync failed', message);
    await db
      .update(eventBookings)
      .set({ crmError: message })
      .where(
        inArray(
          eventBookings.id,
          sent.map((b) => b.id)
        )
      );
    // Still retried next run; thrown so the cron runner reports the failure.
    throw error;
  }
}
