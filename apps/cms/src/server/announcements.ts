import { announcementBackgrounds } from '@llf/content';
import { schema } from '@llf/db';
import { createServerFn } from '@tanstack/react-start';
import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';

const { announcements } = schema;

export const listAnnouncements = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const rows = await getDb()
      .select()
      .from(announcements)
      .orderBy(desc(announcements.startsAt), desc(announcements.createdAt));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      enabled: r.enabled,
      message: r.message,
      messageTablet: r.messageTablet ?? '',
      messageDesktop: r.messageDesktop ?? '',
      ctaLabel: r.ctaLabel ?? '',
      ctaUrl: r.ctaUrl ?? '',
      background: r.background,
      startsAt: r.startsAt?.getTime() ?? null,
      endsAt: r.endsAt?.getTime() ?? null,
      hidePaths: r.hidePaths,
    }));
  });

export type AnnouncementsData = Awaited<ReturnType<typeof listAnnouncements>>;
export type Announcement = AnnouncementsData[number];

const announcementSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(1).max(80),
    enabled: z.boolean(),
    message: z.string().trim().min(1).max(160),
    messageTablet: z.string().trim().max(160),
    messageDesktop: z.string().trim().max(200),
    ctaLabel: z.string().trim().max(30),
    ctaUrl: z
      .string()
      .trim()
      .max(300)
      .refine(
        (v) => !v || /^(\/\S*|https?:\/\/\S+)$/.test(v),
        'The button link must be a path like /offers or a full URL.'
      ),
    background: z.enum(announcementBackgrounds),
    startsAt: z.number().nullable(),
    endsAt: z.number().nullable(),
    hidePaths: z
      .array(
        z
          .string()
          .trim()
          .regex(/^\/\S*$/, 'Hidden pages must be paths like /about.')
      )
      .max(50),
  })
  .refine((a) => a.startsAt === null || a.endsAt === null || a.endsAt > a.startsAt, {
    path: ['endsAt'],
    message: 'The expiry must be after the go-live time.',
  })
  .refine((a) => !a.ctaUrl === !a.ctaLabel, {
    path: ['ctaLabel'],
    message: 'A button needs both its label and its link.',
  });

export const saveAnnouncement = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(announcementSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const values = {
      title: data.title,
      enabled: data.enabled,
      message: data.message,
      messageTablet: data.messageTablet || null,
      messageDesktop: data.messageDesktop || null,
      ctaLabel: data.ctaLabel || null,
      ctaUrl: data.ctaUrl || null,
      background: data.background,
      startsAt: data.startsAt === null ? null : new Date(data.startsAt),
      endsAt: data.endsAt === null ? null : new Date(data.endsAt),
      hidePaths: [...new Set(data.hidePaths)],
      updatedBy: context.user.id,
    };

    if (!data.id) {
      const [row] = await db
        .insert(announcements)
        .values(values)
        .returning({ id: announcements.id });
      return { id: row!.id };
    }
    await db
      .update(announcements)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(announcements.id, data.id));
    return { id: data.id };
  });

export const deleteAnnouncements = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(z.object({ ids: z.array(z.string()).min(1).max(200) }))
  .handler(async ({ data }) => {
    await getDb().delete(announcements).where(inArray(announcements.id, data.ids));
    return { removed: data.ids.length };
  });
