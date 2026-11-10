import { can } from '@ll/content';
import { eventBookings, events, posts } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { and, desc, eq, gte, isNotNull, isNull, or } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { authMiddleware } from '@/lib/session';
import { listLegalReviewRequests } from './legal-page-store';

const BOOKING_DAYS = 14;

/**
 * The bell: only what is for this person to act on. Team history (who
 * published what) lives on the Activity page instead.
 * - posts waiting for their review (asked of them, or of anyone who publishes);
 * - legal pages waiting for an admin to publish them;
 * - bookings made on the website, for people who run events.
 */
export const getNotifications = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { id: userId, role } = context.user;
    const db = getDb();

    const [reviews, bookings, legalReviews] = await Promise.all([
      can(role, 'posts:publish')
        ? db
            .select({ id: posts.id, title: posts.title, at: posts.reviewRequestedAt })
            .from(posts)
            .where(
              and(
                isNull(posts.deletedAt),
                isNotNull(posts.reviewRequestedAt),
                or(isNull(posts.reviewerId), eq(posts.reviewerId, userId))
              )
            )
            .orderBy(desc(posts.reviewRequestedAt))
            .limit(10)
        : [],
      can(role, 'events:manage')
        ? db
            .select({
              id: eventBookings.id,
              eventId: events.id,
              event: events.title,
              partySize: eventBookings.partySize,
              at: eventBookings.createdAt,
            })
            .from(eventBookings)
            .innerJoin(events, eq(events.id, eventBookings.eventId))
            .where(
              and(
                eq(eventBookings.status, 'confirmed'),
                eq(eventBookings.source, 'website'),
                gte(eventBookings.createdAt, new Date(Date.now() - BOOKING_DAYS * 86_400_000))
              )
            )
            .orderBy(desc(eventBookings.createdAt))
            .limit(10)
        : [],
      can(role, 'legal:publish') ? listLegalReviewRequests(db) : [],
    ]);

    return [
      ...reviews.map((r) => ({
        id: `review:${r.id}`,
        kind: 'review' as const,
        postId: r.id,
        title: r.title || 'Untitled',
        at: r.at?.getTime() ?? 0,
      })),
      ...legalReviews.map((r) => ({
        id: `legal-review:${r.slug}`,
        kind: 'legal_review' as const,
        slug: r.slug,
        title: r.title,
        at: r.at,
      })),
      ...bookings.map((b) => ({
        id: `booking:${b.id}`,
        kind: 'booking' as const,
        eventId: b.eventId,
        title: b.event,
        partySize: b.partySize,
        at: b.at.getTime(),
      })),
    ].sort((a, b) => b.at - a.at);
  });

export type Notification = Awaited<ReturnType<typeof getNotifications>>[number];
