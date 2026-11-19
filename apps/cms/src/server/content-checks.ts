import { type BrandScanPart, type RichTextDoc, can, scanBrand } from '@ll/content';
import { events, faqs, legalPages, locations, media, posts } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { and, asc, eq, gte, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { authMiddleware } from '@/lib/session';
import { loadContentTargets } from './post-score';

/** More than this many of one problem is a list nobody works through; the count says the rest. */
const SHOWN = 100;

const blank = (column: unknown) => sql`coalesce(trim(${column}), '') = ''`;

/**
 * What visitors and search engines miss, found from the live content:
 * - published posts with nothing to describe them in search results (no SEO
 *   description and no excerpt, which the website falls back to);
 * - published posts with no image when shared (no share image and no
 *   featured image, the fallback);
 * - images in use with no alt text (images placed in rich text carry their
 *   own alt text, so these are the image fields);
 * - upcoming published events with no cover photo or no summary;
 * - published content that uses a word the brand language guide rules out (posts, FAQs,
 *   upcoming events, locations and the legal pages).
 */
export const getContentChecks = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { role } = context.user;
    if (!can(role, 'posts:publish') && !can(role, 'seo:write')) {
      throw new Error('Content checks are for people who publish or look after SEO.');
    }
    return loadContentChecks(getDb());
  });

export type ContentChecks = Awaited<ReturnType<typeof getContentChecks>>;

/** The checks themselves, for the page and for the dashboard's count. */
export async function loadContentChecks(
  db: ReturnType<typeof getDb>,
  /** The dashboard passes false: it makes do with an answer up to five minutes old. */
  { fresh = true }: { fresh?: boolean } = {}
) {
  const livePost = and(eq(posts.status, 'published'), isNull(posts.deletedAt));

  const [noDescription, noImage, noAlt, eventRows] = await db.batch([
    db
      .select({ id: posts.id, title: posts.title })
      .from(posts)
      .where(and(livePost, blank(posts.seoDescription), blank(posts.excerpt)))
      .orderBy(asc(posts.title)),
    db
      .select({ id: posts.id, title: posts.title })
      .from(posts)
      .where(and(livePost, isNull(posts.ogMediaId), isNull(posts.featuredMediaId)))
      .orderBy(asc(posts.title)),
    // Every image field that points at the library. Deleted rows (in the
    // trash, or soft-deleted) no longer show anywhere, so they do not count.
    db
      .select({ id: media.id, filename: media.filename })
      .from(media)
      .where(
        and(
          blank(media.alt),
          // One EXISTS per table: D1 refuses a UNION chain this long.
          sql`(
            exists (select 1 from posts p where p.deleted_at is null
              and ${media.id} in (p.featured_media_id, p.og_media_id))
            or exists (select 1 from team_members t where t.deleted_at is null
              and t.photo_media_id = ${media.id})
            or exists (select 1 from testimonials t where t.deleted_at is null
              and t.photo_media_id = ${media.id})
            or exists (select 1 from media_coverage c where c.image_media_id = ${media.id})
            or exists (select 1 from locations l where l.deleted_at is null
              and l.hero_media_id = ${media.id})
            or exists (select 1 from events e where e.status != 'cancelled'
              and (e.hero_media_id = ${media.id}
                or exists (select 1 from json_each(e.gallery_media_ids) g where g.value = ${media.id})))
          )`
        )
      )
      .orderBy(asc(media.filename)),
    db
      .select({
        id: events.id,
        seriesId: events.seriesId,
        title: events.title,
        startsAt: events.startsAt,
        noCover: sql<number>`${events.heroMediaId} is null`,
        noSummary: sql<number>`${blank(events.summary)}`,
      })
      .from(events)
      .where(
        and(
          eq(events.status, 'published'),
          gte(events.endsAt, new Date()),
          sql`(${events.heroMediaId} is null or ${blank(events.summary)})`
        )
      )
      .orderBy(asc(events.startsAt)),
  ]);

  // A repeating event is one row per date: list it once, at its next date.
  const seen = new Set<string>();
  const eventsMissing = eventRows
    .filter((e) => {
      const key = e.seriesId ?? e.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt.getTime(),
      noCover: Boolean(e.noCover),
      noSummary: Boolean(e.noSummary),
    }));

  const capped = <T>(rows: T[]) => ({ total: rows.length, rows: rows.slice(0, SHOWN) });
  return {
    noDescription: capped(noDescription),
    noImage: capped(noImage),
    noAlt: capped(noAlt),
    events: capped(eventsMissing),
    brand: capped(await brandBreaches(db, fresh)),
  };
}

export type BrandKind = 'post' | 'faq' | 'event' | 'location' | 'legal';
export type BrandBreach = {
  id: string;
  kind: BrandKind;
  title: string;
  /** A legal page is opened by its slug. */
  slug?: string;
  /** What must be fixed: how it was written, how often, and what to write instead. */
  never: { found: string; count: number; instead: string }[];
  /** Words that are only usually wrong; counted, not listed. */
  avoid: number;
};

// The scan reads every published body, so the dashboard reuses a recent answer.
const BRAND_TTL_MS = 5 * 60 * 1000;
let brandMemo: { at: number; rows: BrandBreach[] } | null = null;

/** Published content that breaks the brand language guide, the worst first. */
async function brandBreaches(db: ReturnType<typeof getDb>, fresh: boolean): Promise<BrandBreach[]> {
  if (!fresh && brandMemo && Date.now() - brandMemo.at < BRAND_TTL_MS) return brandMemo.rows;

  const [targets, [postRows, faqRows, eventRows, locationRows, legalRows]] = await Promise.all([
    loadContentTargets(db),
    db.batch([
      db
        .select({
          id: posts.id,
          title: posts.title,
          seoTitle: posts.seoTitle,
          seoDescription: posts.seoDescription,
          excerpt: posts.excerpt,
          socialTitle: posts.socialTitle,
          socialDescription: posts.socialDescription,
          body: posts.body,
        })
        .from(posts)
        .where(and(eq(posts.status, 'published'), isNull(posts.deletedAt))),
      db
        .select({ id: faqs.id, question: faqs.question, answer: faqs.answer })
        .from(faqs)
        .where(and(eq(faqs.status, 'published'), isNull(faqs.deletedAt))),
      db
        .select({
          id: events.id,
          seriesId: events.seriesId,
          title: events.title,
          summary: events.summary,
          description: events.description,
          venue: events.venue,
        })
        .from(events)
        .where(and(eq(events.status, 'published'), gte(events.endsAt, new Date())))
        .orderBy(asc(events.startsAt)),
      db
        .select({
          id: locations.id,
          name: locations.name,
          intro: locations.intro,
          about: locations.about,
        })
        .from(locations)
        .where(and(eq(locations.status, 'published'), isNull(locations.deletedAt))),
      db
        .select({
          id: legalPages.id,
          slug: legalPages.slug,
          title: legalPages.title,
          body: legalPages.body,
        })
        .from(legalPages)
        .where(and(eq(legalPages.status, 'published'), isNull(legalPages.deletedAt))),
    ]),
  ]);

  const rules = targets.brandRules;
  const rows: BrandBreach[] = [];
  const check = (
    kind: BrandKind,
    id: string,
    title: string,
    parts: BrandScanPart[],
    slug?: string
  ) => {
    const result = scanBrand(parts, rules);
    if (result) {
      rows.push({
        id,
        kind,
        title,
        slug,
        never: result.never.map(({ found, count, instead }) => ({ found, count, instead })),
        avoid: result.avoid,
      });
    }
  };
  const doc = (value: unknown) => (value as RichTextDoc | null) ?? null;

  for (const p of postRows) {
    check('post', p.id, p.title, [
      p.title,
      p.seoTitle,
      p.seoDescription,
      p.excerpt,
      p.socialTitle,
      p.socialDescription,
      doc(p.body),
    ]);
  }
  for (const f of faqRows) check('faq', f.id, f.question, [f.question, doc(f.answer)]);
  // A repeating event is one row per date, all with the same wording: check it once.
  const seen = new Set<string>();
  for (const e of eventRows) {
    const key = e.seriesId ?? e.id;
    if (seen.has(key)) continue;
    seen.add(key);
    check('event', e.id, e.title, [e.title, e.summary, doc(e.description), e.venue]);
  }
  for (const l of locationRows) check('location', l.id, l.name, [l.name, l.intro, l.about]);
  for (const g of legalRows) check('legal', g.id, g.title, [g.title, doc(g.body)], g.slug);

  const worst = (b: BrandBreach) => b.never.reduce((sum, f) => sum + f.count, 0);
  rows.sort((a, b) => worst(b) - worst(a) || a.title.localeCompare(b.title));
  brandMemo = { at: Date.now(), rows };
  return rows;
}
