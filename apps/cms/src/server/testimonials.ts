import { schema } from '@llf/db';
import { createServerFn } from '@tanstack/react-start';
import { desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';

const { testimonials } = schema;

export const listTestimonials = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const rows = await getDb()
      .select({
        id: testimonials.id,
        quote: testimonials.quote,
        name: testimonials.name,
        relationship: testimonials.relationship,
        location: testimonials.location,
        featured: testimonials.featured,
        status: testimonials.status,
        createdAt: testimonials.createdAt,
      })
      .from(testimonials)
      .where(isNull(testimonials.deletedAt))
      .orderBy(desc(testimonials.featured), desc(testimonials.createdAt));
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() }));
  });

export type TestimonialsData = Awaited<ReturnType<typeof listTestimonials>>;
export type Testimonial = TestimonialsData[number];

const testimonialSchema = z.object({
  id: z.string().optional(),
  quote: z.string().trim().min(1).max(1000),
  name: z.string().trim().min(1).max(80),
  relationship: z.string().trim().max(80).optional(),
  location: z.string().trim().max(80).optional(),
  featured: z.boolean(),
  status: z.enum(['draft', 'published']),
});

export const saveTestimonial = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(testimonialSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const now = new Date();
    const values = {
      quote: data.quote,
      name: data.name,
      relationship: data.relationship || null,
      location: data.location || null,
      featured: data.featured,
      status: data.status,
    };

    if (!data.id) {
      const [row] = await db
        .insert(testimonials)
        .values({
          ...values,
          publishedAt: data.status === 'published' ? now : null,
          createdBy: context.user.id,
          updatedBy: context.user.id,
        })
        .returning({ id: testimonials.id });
      return { id: row!.id };
    }

    const existing = await db.query.testimonials.findFirst({
      where: eq(testimonials.id, data.id),
    });
    await db
      .update(testimonials)
      .set({
        ...values,
        publishedAt: data.status === 'published' ? (existing?.publishedAt ?? now) : null,
        updatedAt: now,
        updatedBy: context.user.id,
      })
      .where(eq(testimonials.id, data.id));
    return { id: data.id };
  });

export const deleteTestimonial = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await getDb().delete(testimonials).where(eq(testimonials.id, data.id));
  });
