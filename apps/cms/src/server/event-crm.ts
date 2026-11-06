import { env } from 'cloudflare:workers';

/**
 * HubSpot, once it is connected. Every booking has crm_synced_at (null until
 * sent), crm_contact_id and crm_error, so turning this on later sends every
 * booking made so far and then each new one, with no schema change.
 *
 * To build it: select bookings where crm_synced_at is null and email is not
 * null; upsert the HubSpot contact by email; record the event (a property or
 * a note); set crm_synced_at and crm_contact_id, or crm_error on failure.
 */
export async function syncPending(_d1: D1Database): Promise<void> {
  if (!env.HUBSPOT_ACCESS_TOKEN) return;
  console.warn('[events] HUBSPOT_ACCESS_TOKEN is set, but HubSpot sync is not built yet.');
}
