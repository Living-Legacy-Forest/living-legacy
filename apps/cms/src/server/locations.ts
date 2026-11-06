import {
  australianStates,
  locationStages,
  richTextPlainText,
  richTextSchema,
  richTextToStored,
  slugify,
  storedToRichText,
} from '@ll/content';
import { eventBookings, events, locations } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { and, asc, eq, gt, inArray, isNull, ne } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';

export const listLocations = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const rows = await getDb()
      .select({
        id: locations.id,
        name: locations.name,
        slug: locations.slug,
        state: locations.state,
        region: locations.region,
        stage: locations.stage,
        externalUrl: locations.externalUrl,
        heroMediaId: locations.heroMediaId,
        intro: locations.intro,
        about: locations.about,
        address: locations.address,
        latitude: locations.latitude,
        longitude: locations.longitude,
        mapUrl: locations.mapUrl,
        hours: locations.hours,
        phone: locations.phone,
        email: locations.email,
        hubspotFormId: locations.hubspotFormId,
        sortOrder: locations.sortOrder,
        status: locations.status,
      })
      .from(locations)
      .where(isNull(locations.deletedAt))
      // The order the directory shows them in.
      .orderBy(asc(locations.sortOrder), asc(locations.name));
    return rows.map((row) => ({ ...row, about: storedToRichText(row.about) }));
  });

export type LocationsData = Awaited<ReturnType<typeof listLocations>>;
export type LocationItem = LocationsData[number];

const webLink = z
  .string()
  .trim()
  .refine((u) => u === '' || /^https?:\/\/\S+$/.test(u), 'Use a web link starting with https://');

/** Where the map pin goes: both coordinates, or neither. */
const pinSchema = z
  .object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })
  .nullable();

const locationSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  /** Blank is made from the name. */
  slug: z.string().trim().max(80),
  state: z.enum(australianStates),
  region: z.string().trim().max(80),
  stage: z.enum(locationStages),
  externalUrl: webLink,
  heroMediaId: z.string().nullable(),
  intro: z.string().trim().max(400),
  about: richTextSchema
    .nullable()
    .refine((doc) => !doc || richTextPlainText(doc).length <= 10000, 'About is too long.'),
  address: z.string().trim().max(200),
  pin: pinSchema,
  mapUrl: webLink,
  hours: z.string().trim().max(400),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(''), z.string().trim().email().max(120)]),
  hubspotFormId: z.union([
    z.literal(''),
    z
      .string()
      .trim()
      .regex(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i, 'Paste the form ID from HubSpot.'),
  ]),
  sortOrder: z.number().int().min(0).max(9999),
  status: z.enum(['draft', 'published']),
});

/** Appends -2, -3, ... until no other location uses the slug. */
async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || 'location';
  const taken = new Set(
    (
      await getDb()
        .select({ slug: locations.slug })
        .from(locations)
        .where(
          and(isNull(locations.deletedAt), excludeId ? ne(locations.id, excludeId) : undefined)
        )
    ).map((r) => r.slug)
  );
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error('Could not find a free slug. Try a different one.');
}

export const saveLocation = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(locationSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const now = new Date();
    const values = {
      name: data.name,
      slug: await uniqueSlug(data.slug || data.name, data.id),
      state: data.state,
      region: data.region || null,
      stage: data.stage,
      externalUrl: data.externalUrl || null,
      heroMediaId: data.heroMediaId,
      intro: data.intro || null,
      about: richTextToStored(data.about),
      address: data.address || null,
      latitude: data.pin?.latitude ?? null,
      longitude: data.pin?.longitude ?? null,
      mapUrl: data.mapUrl || null,
      hours: data.hours || null,
      phone: data.phone || null,
      email: data.email || null,
      hubspotFormId: data.hubspotFormId || null,
      sortOrder: data.sortOrder,
      status: data.status,
    };

    if (!data.id) {
      const [row] = await db
        .insert(locations)
        .values({
          ...values,
          publishedAt: data.status === 'published' ? now : null,
          createdBy: context.user.id,
          updatedBy: context.user.id,
        })
        .returning({ id: locations.id });
      return { id: row!.id };
    }

    const existing = await db.query.locations.findFirst({ where: eq(locations.id, data.id) });
    if (!existing) throw new Error('This location no longer exists.');
    // HubSpot tells event guests the location's name and address, so a change
    // to either sends the bookings for its upcoming events again.
    const moved =
      existing.name !== values.name || (existing.address ?? '') !== (values.address ?? '');
    await db.batch([
      db
        .update(locations)
        .set({
          ...values,
          publishedAt: data.status === 'published' ? (existing.publishedAt ?? now) : null,
          updatedAt: now,
          updatedBy: context.user.id,
        })
        .where(eq(locations.id, data.id)),
      ...(moved
        ? [
            db
              .update(eventBookings)
              .set({ crmSyncedAt: null })
              .where(
                inArray(
                  eventBookings.eventId,
                  db
                    .select({ id: events.id })
                    .from(events)
                    .where(and(eq(events.locationId, data.id), gt(events.endsAt, now)))
                )
              ),
          ]
        : []),
    ]);
    return { id: data.id };
  });

export const deleteLocations = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(z.object({ ids: z.array(z.string()).min(1).max(500) }))
  .handler(async ({ data }) => {
    await getDb().delete(locations).where(inArray(locations.id, data.ids));
    return { removed: data.ids.length };
  });
