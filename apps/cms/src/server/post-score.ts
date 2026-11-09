import {
  type ContentTargets,
  type RichTextDoc,
  SCORE_BANDS,
  type ScoreInput,
  analysePost,
  contentTargetsFrom,
  guidelinesFromSettings,
  parseSiteSettings,
} from '@ll/content';
import { type Db, createDb } from '@ll/db';
import { posts, siteSettings } from '@ll/db/schema';
import { and, asc, count, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';

// The stored content score: posts.content_score describes the post's columns
// (its live version once published). Set on every column write and rescored
// nightly, so a change to the targets in Settings reaches every post by morning.

type ScoredColumns = Pick<
  typeof posts.$inferSelect,
  | 'title'
  | 'seoTitle'
  | 'seoDescription'
  | 'excerpt'
  | 'slug'
  | 'body'
  | 'featuredMediaId'
  | 'noindex'
  | 'focusKeyword'
  | 'relatedTerms'
>;

export async function loadContentTargets(db: Db): Promise<ContentTargets> {
  const row = await db.query.siteSettings.findFirst({ where: eq(siteSettings.id, 'site') });
  return contentTargetsFrom(parseSiteSettings(row?.data));
}

export function scorePost(input: ScoreInput, targets: ContentTargets): number {
  return analysePost(input, guidelinesFromSettings(targets, input)).score;
}

/** The score inputs as stored in a post's columns. */
export function scoreInputFromColumns(row: ScoredColumns): ScoreInput {
  return {
    title: row.title,
    seoTitle: row.seoTitle ?? '',
    seoDescription: row.seoDescription ?? '',
    excerpt: row.excerpt ?? '',
    slug: row.slug,
    body: (row.body as RichTextDoc | null) ?? null,
    featuredMediaId: row.featuredMediaId,
    noindex: row.noindex,
    focusKeyword: row.focusKeyword ?? '',
    relatedTerms: row.relatedTerms ?? [],
  };
}

const CHUNK = 50;

/** The daily rescore: every post outside the trash, writing only scores that changed. */
export async function rescorePosts(d1: D1Database) {
  const db = createDb(d1);
  const targets = await loadContentTargets(db);
  const rows = await db.query.posts.findMany({ where: isNull(posts.deletedAt) });
  const changed = rows
    .map((row) => ({
      id: row.id,
      before: row.contentScore,
      after: scorePost(scoreInputFromColumns(row), targets),
    }))
    .filter((r) => r.before !== r.after);

  for (let i = 0; i < changed.length; i += CHUNK) {
    const [first, ...rest] = changed
      .slice(i, i + CHUNK)
      .map((r) => db.update(posts).set({ contentScore: r.after }).where(eq(posts.id, r.id)));
    await db.batch([first!, ...rest]);
  }
  return { rescored: changed.length };
}

const LOWEST = 5;

/** Published posts by score band, their average, and the lowest scorers to fix first. */
export async function loadScoreSummary(db: Db) {
  const live = and(eq(posts.status, 'published'), isNull(posts.deletedAt));
  const score = posts.contentScore;
  const [totals, lowest] = await db.batch([
    db
      .select({
        low: sql<number>`coalesce(sum(${score} < ${SCORE_BANDS.good}), 0)`,
        mid: sql<number>`coalesce(sum(${score} >= ${SCORE_BANDS.good} and ${score} < ${SCORE_BANDS.strong}), 0)`,
        high: sql<number>`coalesce(sum(${score} >= ${SCORE_BANDS.strong}), 0)`,
        scored: count(score),
        unscored: sql<number>`coalesce(sum(${score} is null), 0)`,
        average: sql<number | null>`avg(${score})`,
      })
      .from(posts)
      .where(live),
    db
      .select({ id: posts.id, title: posts.title, score: sql<number>`${score}` })
      .from(posts)
      .where(and(live, isNotNull(score)))
      .orderBy(asc(score), desc(posts.updatedAt))
      .limit(LOWEST),
  ]);
  const t = totals[0];
  return {
    bands: { low: Number(t?.low ?? 0), mid: Number(t?.mid ?? 0), high: Number(t?.high ?? 0) },
    scored: Number(t?.scored ?? 0),
    unscored: Number(t?.unscored ?? 0),
    average: t?.average === null || t?.average === undefined ? null : Math.round(Number(t.average)),
    lowest,
  };
}

export type ScoreSummary = Awaited<ReturnType<typeof loadScoreSummary>>;
