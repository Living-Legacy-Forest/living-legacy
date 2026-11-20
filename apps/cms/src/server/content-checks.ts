import {
  type BrandScanPart,
  type BrokenLink,
  type RichTextDoc,
  brokenLinks,
  can,
  liveSitePaths,
  outlineRichText,
  scanBrand,
  storedToRichText,
} from '@ll/content';
import {
  announcements,
  events,
  faqs,
  legalPages,
  locations,
  media,
  posts,
  redirects,
} from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { and, asc, eq, gt, gte, isNull, or, sql } from 'drizzle-orm';
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
 *   upcoming events, locations, the legal pages and announcement bars).
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
  const scanned = await scanPublished(db, fresh);
  return {
    noDescription: capped(noDescription),
    noImage: capped(noImage),
    noAlt: capped(noAlt),
    events: capped(eventsMissing),
    brand: capped(scanned.brand),
    links: capped(scanned.links),
  };
}

export type ItemKind = 'post' | 'faq' | 'event' | 'location' | 'legal' | 'announcement';
export type BrandBreach = {
  id: string;
  kind: ItemKind;
  title: string;
  /** A legal page is opened by its slug. */
  slug?: string;
  /** What must be fixed: how it was written, how often, and what to write instead. */
  never: { found: string; count: number; instead: string; sentence: string }[];
  /** Words that are only usually wrong; counted, not listed. */
  avoid: number;
};
export type LinkBreach = {
  id: string;
  kind: ItemKind;
  title: string;
  slug?: string;
  /** Links to this site that lead nowhere. */
  broken: BrokenLink[];
};

// The scan reads every published body, so the dashboard reuses a recent answer.
const SCAN_TTL_MS = 5 * 60 * 1000;
let scanMemo: { at: number; brand: BrandBreach[]; links: LinkBreach[] } | null = null;

/**
 * One pass over everything published: what breaks the brand language guide, and which links to
 * this site lead nowhere. Both read the same bodies, so they share the read.
 */
async function scanPublished(db: ReturnType<typeof getDb>, fresh: boolean) {
  if (!fresh && scanMemo && Date.now() - scanMemo.at < SCAN_TTL_MS) return scanMemo;

  const [
    targets,
    [postRows, faqRows, eventRows, locationRows, legalRows, announcementRows, ruleRows],
  ] = await Promise.all([
    loadContentTargets(db),
    db.batch([
      db
        .select({
          id: posts.id,
          slug: posts.slug,
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
          slug: locations.slug,
          stage: locations.stage,
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
          seoDescription: legalPages.seoDescription,
          body: legalPages.body,
        })
        .from(legalPages)
        .where(and(eq(legalPages.status, 'published'), isNull(legalPages.deletedAt))),
      // What visitors can see: switched on and not yet over. One still to start is read too,
      // so a mistake is caught before the bar goes up.
      db
        .select({
          id: announcements.id,
          title: announcements.title,
          message: announcements.message,
          messageTablet: announcements.messageTablet,
          messageDesktop: announcements.messageDesktop,
          ctaLabel: announcements.ctaLabel,
          ctaUrl: announcements.ctaUrl,
        })
        .from(announcements)
        .where(
          and(
            eq(announcements.enabled, true),
            or(isNull(announcements.endsAt), gt(announcements.endsAt, new Date()))
          )
        ),
      db
        .select({
          id: redirects.id,
          fromPath: redirects.fromPath,
          toPath: redirects.toPath,
          statusCode: redirects.statusCode,
          keepQuery: redirects.keepQuery,
        })
        .from(redirects)
        .where(eq(redirects.enabled, true)),
    ]),
  ]);

  const rules = targets.brandRules;
  // The pages the new site serves, to tell a link that works from one that leads nowhere.
  const live = liveSitePaths({
    postSlugs: postRows.map((p) => p.slug),
    // A forest that has moved to its own site has no page here.
    locationSlugs: locationRows.filter((l) => l.stage !== 'external').map((l) => l.slug),
  });
  const brand: BrandBreach[] = [];
  const links: LinkBreach[] = [];
  const doc = (value: unknown) => (value as RichTextDoc | null) ?? null;

  const check = (
    kind: ItemKind,
    id: string,
    title: string,
    parts: BrandScanPart[],
    documents: (RichTextDoc | null)[],
    slug?: string,
    /** Links that are not inside a document, such as a button's address. */
    otherLinks: { href: string; text: string }[] = []
  ) => {
    const result = scanBrand(parts, rules);
    if (result) {
      brand.push({
        id,
        kind,
        title,
        slug,
        never: result.never.map(({ found, count, instead, sentence }) => ({
          found,
          count,
          instead,
          sentence,
        })),
        avoid: result.avoid,
      });
    }
    const broken = brokenLinks(
      [...documents.flatMap((d) => (d ? outlineRichText(d).links : [])), ...otherLinks],
      ruleRows,
      live
    );
    if (broken.length > 0) links.push({ id, kind, title, slug, broken });
  };

  for (const p of postRows) {
    const body = doc(p.body);
    check(
      'post',
      p.id,
      p.title,
      [p.title, p.seoTitle, p.seoDescription, p.excerpt, p.socialTitle, p.socialDescription, body],
      [body]
    );
  }
  for (const f of faqRows) {
    const answer = doc(f.answer);
    check('faq', f.id, f.question, [f.question, answer], [answer]);
  }
  // A repeating event is one row per date, usually with the same wording: check each wording once.
  // A date edited on its own can differ from the rest, so it is not skipped for being in a series.
  const seen = new Set<string>();
  for (const e of eventRows) {
    const key = `${e.seriesId ?? e.id}|${JSON.stringify([e.title, e.summary, e.description, e.venue])}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const description = doc(e.description);
    check('event', e.id, e.title, [e.title, e.summary, description, e.venue], [description]);
  }
  for (const l of locationRows) {
    // Stored as a rich text document, or as Markdown in older rows.
    const about = storedToRichText(l.about);
    check('location', l.id, l.name, [l.name, l.intro, about], [about]);
  }
  for (const g of legalRows) {
    const body = doc(g.body);
    check('legal', g.id, g.title, [g.title, g.seoDescription, body], [body], g.slug);
  }
  for (const a of announcementRows) {
    // The title is only for editors, so it is not read; the wording on the bar is.
    check(
      'announcement',
      a.id,
      a.title,
      [a.message, a.messageTablet, a.messageDesktop, a.ctaLabel],
      [],
      undefined,
      a.ctaUrl ? [{ href: a.ctaUrl, text: a.ctaLabel ?? '' }] : []
    );
  }

  const worstBrand = (b: BrandBreach) => b.never.reduce((sum, f) => sum + f.count, 0);
  brand.sort((a, b) => worstBrand(b) - worstBrand(a) || a.title.localeCompare(b.title));
  links.sort((a, b) => b.broken.length - a.broken.length || a.title.localeCompare(b.title));
  scanMemo = { at: Date.now(), brand, links };
  return scanMemo;
}
