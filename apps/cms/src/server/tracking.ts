import { type TrackingIds, parseGaIds, pickTrackingIds, trackingIdsProblem } from '@ll/content';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';
import { readSiteSettings, writeSiteSettings } from '@/lib/site-settings';
import { logActivity } from './activity-log';

/**
 * The ids of the third-party tags the website loads (Integrations, Website tracking). They live in
 * the same settings row the website already reads, but are edited here, apart from Settings, and
 * saving Settings leaves them alone.
 */
const text = (max: number) => z.string().trim().max(max).default('');

const trackingSchema = z
  .object({
    gtmId: text(30).transform((v) => v.toUpperCase()),
    metaPixelId: text(30),
    gaMeasurementIds: text(300).transform((v) => parseGaIds(v).join(', ')),
    posthogKey: text(100),
  })
  .superRefine((value, ctx) => {
    const problem = trackingIdsProblem(value);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

export const getTrackingIds = createServerFn({ method: 'GET' })
  .middleware([requirePermission('settings:write')])
  .handler(async (): Promise<TrackingIds> => pickTrackingIds(await readSiteSettings()));

export const saveTrackingIds = createServerFn({ method: 'POST' })
  .middleware([requirePermission('settings:write')])
  .validator(trackingSchema)
  .handler(async ({ data, context }): Promise<TrackingIds> => {
    const db = getDb();
    await writeSiteSettings(db, { ...(await readSiteSettings()), ...data }, context.user.id);
    await logActivity(db, {
      actorId: context.user.id,
      actorName: context.user.name,
      action: 'settings.updated',
      summary: 'Updated the website tracking ids',
    });
    return data;
  });
