import { env } from 'cloudflare:workers';

/**
 * HubSpot, once it is connected: it sends every guest email (confirmation,
 * reminder, cancellation), so the CMS only has to keep it up to date.
 *
 * Every booking has crm_synced_at (null until sent), crm_contact_id and
 * crm_error. A booking is unsynced when it is made, when it is cancelled, and
 * when its event's time, place or title changes or the event is cancelled, so
 * turning this on later sends everything so far and then each change.
 *
 * To build it: select bookings where crm_synced_at is null and email is not
 * null, with their event; upsert the HubSpot contact by email; record the
 * booking (event, date, venue, party size, reference, status) in the way the
 * HubSpot workflows expect; set crm_synced_at and crm_contact_id, or crm_error
 * on failure.
 */
export async function syncPending(_d1: D1Database): Promise<void> {
  if (!env.HUBSPOT_ACCESS_TOKEN) return;
  console.warn('[events] HUBSPOT_ACCESS_TOKEN is set, but HubSpot sync is not built yet.');
}
