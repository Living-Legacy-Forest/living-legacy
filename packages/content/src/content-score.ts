// The content score: editorial checks on a blog post, grouped and weighted
// into a score out of 100. Advice only. It does not predict search rankings
// and never blocks saving or publishing. Pure, so the editor and the server
// can both run it.
import { type BrandFinding, findBrandProblems } from './brand-language';
import { type PostInput, slugify } from './posts';
import { countPhrase, outlineRichText, splitWords } from './rich-text-outline';
import type { ContentTargets } from './settings';

export type Range = { min: number; max: number | null };
export type TermTarget = { term: string; min: number; kind: 'focus' | 'related' };

/** What a post is measured against. Settings fill it today; top-ranking pages could later. */
export interface ContentGuidelines {
  source: 'settings' | 'competitors';
  words: Range;
  headings: Range;
  paragraphs: Range;
  images: Range;
  terms: TermTarget[];
}

export type ScoreInput = Pick<
  PostInput,
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

export type CheckStatus = 'pass' | 'warning' | 'critical' | 'skipped';
export type ScoreCategory = 'basic' | 'content' | 'technical' | 'images' | 'links' | 'brand';

export interface ScoreCheck {
  id: string;
  category: ScoreCategory;
  status: CheckStatus;
  message: string;
  why: string;
}

export type RangeState = 'below' | 'within' | 'above';

export interface StructureCount {
  key: 'words' | 'headings' | 'paragraphs' | 'images';
  label: string;
  value: number;
  target: Range;
  state: RangeState;
}

export type TermState = 'met' | 'partial' | 'unused';

export interface TermUse {
  term: string;
  kind: 'focus' | 'related';
  count: number;
  min: number;
  state: TermState;
}

export interface ContentScore {
  score: number;
  categories: Record<ScoreCategory, number>;
  checks: ScoreCheck[];
  structure: StructureCount[];
  terms: TermUse[];
  brand: BrandFinding[];
  source: ContentGuidelines['source'];
}

/** Weights total 100. */
export const SCORE_CATEGORIES: readonly { id: ScoreCategory; label: string; weight: number }[] = [
  { id: 'basic', label: 'Basic SEO', weight: 25 },
  { id: 'content', label: 'Content quality', weight: 25 },
  { id: 'technical', label: 'Technical', weight: 10 },
  { id: 'images', label: 'Images', weight: 15 },
  { id: 'links', label: 'Links', weight: 10 },
  { id: 'brand', label: 'Brand language', weight: 15 },
];

const STATUS_VALUE = { pass: 1, warning: 0.5, critical: 0 } as const;
const VAGUE_LINK_TEXT = /^(click here|here|read more|more|this link|link)$/i;
const BARE_URL = /^(https?:\/\/|www\.)/i;
const STUFFING_SHARE = 0.03;
/** Keywords a permalink can carry without losing meaning: letters, digits, spaces, hyphens, apostrophes. */
const SLUG_SAFE = /^[\p{L}\p{N}\s'’-]+$/u;

const n = (value: number) => value.toLocaleString('en-AU');
const plural = (count: number, word: string, many = `${word}s`) =>
  `${n(count)} ${count === 1 ? word : many}`;

export function rangeState(value: number, range: Range): RangeState {
  if (value < range.min) return 'below';
  if (range.max !== null && value > range.max) return 'above';
  return 'within';
}

export function formatRange(range: Range): string {
  return range.max === null ? `at least ${n(range.min)}` : `${n(range.min)} to ${n(range.max)}`;
}

/** What to do about a structure count, short enough for one line in the panel. */
export function structureCaption({ value, target, state }: StructureCount): string {
  if (state === 'below') return `Need ${n(target.min - value)} more`;
  if (state === 'above' && target.max !== null) return `${n(value - target.max)} too many`;
  return 'In range';
}

/** How far a count is towards its minimum, from 0 to 1. In range or over is full. */
export function structureProgress({ value, target, state }: StructureCount): number {
  if (state !== 'below' || target.min <= 0) return 1;
  return Math.min(1, value / target.min);
}

/** Where the Good and Strong bands start. The dashboard counts posts with the same lines. */
export const SCORE_BANDS = { good: 50, strong: 80 } as const;

export function scoreBand(score: number): { band: 'low' | 'mid' | 'high'; label: string } {
  if (score >= SCORE_BANDS.strong) return { band: 'high', label: 'Strong' };
  if (score >= SCORE_BANDS.good) return { band: 'mid', label: 'Good' };
  return { band: 'low', label: 'Needs work' };
}

/** Targets from Settings, with the post's own focus keyword and related terms. */
export function guidelinesFromSettings(
  targets: ContentTargets,
  input: Pick<ScoreInput, 'focusKeyword' | 'relatedTerms'>
): ContentGuidelines {
  const focus = input.focusKeyword.trim();
  const seen = new Set(focus ? [focus.toLowerCase()] : []);
  const related = input.relatedTerms
    .map((term) => term.trim())
    .filter((term) => {
      const key = term.toLowerCase();
      if (!term || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return {
    source: 'settings',
    words: { min: targets.targetWordsMin, max: targets.targetWordsMax },
    headings: { min: targets.targetHeadingsMin, max: targets.targetHeadingsMax },
    paragraphs: { min: targets.targetParagraphsMin, max: null },
    images: { min: targets.targetImagesMin, max: targets.targetImagesMax },
    terms: [
      ...(focus
        ? [{ term: focus, min: targets.targetFocusKeywordUses, kind: 'focus' as const }]
        : []),
      ...related.map((term) => ({
        term,
        min: targets.targetRelatedTermUses,
        kind: 'related' as const,
      })),
    ],
  };
}

/** Category scores and the weighted total. Skipped checks do not count. */
export function scoreChecks(checks: ScoreCheck[]): Pick<ContentScore, 'score' | 'categories'> {
  const categories = {} as Record<ScoreCategory, number>;
  let total = 0;
  for (const { id, weight } of SCORE_CATEGORIES) {
    const scored = checks.filter((c) => c.category === id && c.status !== 'skipped');
    const value = scored.length
      ? scored.reduce((sum, c) => sum + STATUS_VALUE[c.status as keyof typeof STATUS_VALUE], 0) /
        scored.length
      : 1;
    categories[id] = Math.round(value * 100);
    total += value * weight;
  }
  return { score: Math.round(total), categories };
}

export function analysePost(input: ScoreInput, guidelines: ContentGuidelines): ContentScore {
  const outline = outlineRichText(input.body);
  const checks: ScoreCheck[] = [];
  const add = (
    category: ScoreCategory,
    id: string,
    status: CheckStatus,
    message: string,
    why: string
  ) => checks.push({ id, category, status, message, why });
  const passIf = (ok: boolean, otherwise: 'warning' | 'critical' = 'warning'): CheckStatus =>
    ok ? 'pass' : otherwise;

  const title = input.seoTitle.trim() || input.title.trim();
  const description = input.seoDescription.trim() || input.excerpt.trim();
  const keyword = input.focusKeyword.trim();
  const hasKeyword = (text: string) => countPhrase(text, keyword) > 0;
  const keywordCheck = (id: string, place: string, found: () => boolean, why: string) => {
    if (!keyword) return add('basic', id, 'skipped', `Add a focus keyword to check ${place}.`, why);
    const ok = found();
    add('basic', id, passIf(ok), `The focus keyword ${ok ? 'is' : 'is not'} in ${place}.`, why);
  };

  // Basic SEO
  add(
    'basic',
    'focus-keyword',
    passIf(!!keyword, 'critical'),
    keyword ? `Focus keyword: "${keyword}".` : 'No focus keyword yet. Add one in Search listing.',
    'The keyword checks measure the post against the phrase people search for.'
  );
  add(
    'basic',
    'title-length',
    passIf(title.length >= 30 && title.length <= 60),
    `The search title is ${plural(title.length, 'character')} (aim for 30 to 60).`,
    'Search results cut off long titles, and short ones waste the space.'
  );
  add(
    'basic',
    'description',
    description ? passIf(description.length >= 70 && description.length <= 160) : 'critical',
    description
      ? `The search description is ${plural(description.length, 'character')} (aim for 70 to 160).`
      : 'No search description or summary.',
    'Without one, search engines pick a snippet from the page, which is often a poor fit.'
  );
  keywordCheck(
    'keyword-in-title',
    'the search title',
    () => hasKeyword(title),
    'People scan results for the words they searched.'
  );
  keywordCheck(
    'keyword-in-description',
    'the search description',
    () => hasKeyword(description),
    'Search engines bold matching words in the snippet.'
  );
  // A permalink keeps only letters and digits, so "C++" and "C#" both become
  // "c". Judging those would pass or fail by accident, so they are skipped.
  if (keyword && !SLUG_SAFE.test(keyword)) {
    add(
      'basic',
      'keyword-in-slug',
      'skipped',
      'The focus keyword has symbols a permalink cannot hold, so the permalink is not checked.',
      'A readable address tells people what the page is before they open it.'
    );
  } else {
    keywordCheck(
      'keyword-in-slug',
      'the permalink',
      () => {
        const segment = slugify(keyword);
        return segment !== '' && `-${input.slug}-`.includes(`-${segment}-`);
      },
      'A readable address tells people what the page is before they open it.'
    );
  }
  keywordCheck(
    'keyword-in-first-paragraph',
    'the first paragraph',
    () => hasKeyword(outline.paragraphs[0] ?? ''),
    'It confirms early that the post answers what the reader searched for.'
  );
  keywordCheck(
    'keyword-in-subheading',
    'an H2 or H3',
    () => outline.headings.some((h) => (h.level === 2 || h.level === 3) && hasKeyword(h.text)),
    'Subheadings show the shape of the topic to readers and search engines.'
  );

  // Structure, used by Content quality and Images
  const counts = {
    words: outline.words.length,
    headings: outline.headings.length,
    paragraphs: outline.paragraphs.length,
    images: outline.imageAlts.length,
  };
  const labels = {
    words: 'Words',
    headings: 'Headings',
    paragraphs: 'Paragraphs',
    images: 'Images',
  } as const;
  const structure: StructureCount[] = (['words', 'headings', 'paragraphs', 'images'] as const).map(
    (key) => ({
      key,
      label: labels[key],
      value: counts[key],
      target: guidelines[key],
      state: rangeState(counts[key], guidelines[key]),
    })
  );
  const rangeCheck = (category: ScoreCategory, key: StructureCount['key'], why: string) => {
    const s = structure.find((x) => x.key === key)!;
    add(
      category,
      `${key}-count`,
      passIf(s.state === 'within'),
      `${n(s.value)} ${s.label.toLowerCase()} (target ${formatRange(s.target)}).`,
      why
    );
  };

  // Content quality
  rangeCheck('content', 'words', 'Enough depth to answer the question, without padding.');
  rangeCheck('content', 'headings', 'Subheadings let readers scan and jump to what they need.');
  rangeCheck('content', 'paragraphs', 'Short paragraphs are easier to read on a phone.');

  const terms: TermUse[] = guidelines.terms.map(({ term, kind, min }) => {
    const count = countPhrase(outline.text, term);
    return {
      term,
      kind,
      min,
      count,
      state: count >= min ? 'met' : count > 0 ? 'partial' : 'unused',
    };
  });
  const focus = terms.find((term) => term.kind === 'focus');
  add(
    'content',
    'keyword-uses',
    focus ? passIf(focus.state === 'met') : 'skipped',
    focus
      ? `The focus keyword appears ${plural(focus.count, 'time')} in the body (aim for at least ${n(focus.min)}).`
      : 'Add a focus keyword to count its uses.',
    'Using the phrase naturally tells readers and search engines what the post covers.'
  );
  const share =
    focus && counts.words ? (focus.count * splitWords(keyword).length) / counts.words : 0;
  add(
    'content',
    'keyword-stuffing',
    focus && counts.words ? passIf(share < STUFFING_SHARE) : 'skipped',
    share >= STUFFING_SHARE
      ? 'The focus keyword makes up over 3% of the words. Try other ways of saying it.'
      : 'The focus keyword is not overused.',
    'Repeating a phrase too often reads badly and can look like spam to search engines.'
  );
  const related = terms.filter((term) => term.kind === 'related');
  const short = related.filter((term) => term.state !== 'met');
  add(
    'content',
    'related-terms',
    related.length ? passIf(short.length === 0) : 'skipped',
    !related.length
      ? 'No related terms added.'
      : short.length
        ? `Not used enough yet: ${short.map((term) => term.term).join(', ')}.`
        : 'Every related term is used.',
    'Related terms help the post cover the whole topic.'
  );

  const sentenceWords = outline.sentences.map((sentence) => splitWords(sentence).length);
  const average = sentenceWords.length
    ? sentenceWords.reduce((a, b) => a + b, 0) / sentenceWords.length
    : 0;
  const longShare = sentenceWords.length
    ? sentenceWords.filter((w) => w > 25).length / sentenceWords.length
    : 0;
  add(
    'content',
    'sentence-length',
    sentenceWords.length ? passIf(average <= 20) : 'skipped',
    `Sentences average ${plural(Math.round(average), 'word')} (aim for 20 or fewer).`,
    'Shorter sentences are easier to follow, especially for readers going through a hard time.'
  );
  add(
    'content',
    'long-sentences',
    sentenceWords.length ? passIf(longShare <= 0.25) : 'skipped',
    `${Math.round(longShare * 100)}% of sentences are over 25 words (aim for 25% or fewer).`,
    'Long sentences are where readers lose the thread.'
  );
  const longParagraphs = outline.paragraphs.filter((para) => splitWords(para).length > 150).length;
  add(
    'content',
    'long-paragraphs',
    outline.paragraphs.length ? passIf(longParagraphs === 0) : 'skipped',
    longParagraphs
      ? `${plural(longParagraphs, 'paragraph')} over 150 words.`
      : 'No paragraph is over 150 words.',
    'Long blocks of text are hard to read on a phone.'
  );

  // Technical
  const levels = outline.headings.map((h) => h.level);
  const inOrder = levels.every((level, i) => (i === 0 ? level <= 2 : level <= levels[i - 1]! + 1));
  add(
    'technical',
    'heading-order',
    levels.length ? passIf(inOrder) : 'skipped',
    inOrder
      ? 'Headings go in order.'
      : 'A heading skips a level, such as an H4 straight after an H2.',
    'Screen readers and search engines use heading levels to understand the outline.'
  );
  const h1s = levels.filter((level) => level === 1).length;
  add(
    'technical',
    'no-h1',
    passIf(h1s === 0),
    h1s
      ? `${plural(h1s, 'H1')} in the body. The post title is already the H1.`
      : 'No H1 in the body.',
    'One H1 per page keeps the main topic clear.'
  );
  add(
    'technical',
    'slug-length',
    input.slug ? passIf(input.slug.length <= 60) : 'warning',
    input.slug
      ? `The permalink is ${plural(input.slug.length, 'character')} (aim for 60 or fewer).`
      : 'No permalink yet.',
    'Short addresses are easier to share and to read in results.'
  );
  add(
    'technical',
    'indexing',
    passIf(!input.noindex),
    input.noindex
      ? 'This post will not appear in search. Hide from search engines is on.'
      : 'Search engines may list this post.',
    'A hidden post gets no search traffic.'
  );

  // Images
  add(
    'images',
    'featured-image',
    passIf(!!input.featuredMediaId, 'critical'),
    input.featuredMediaId ? 'Featured image set.' : 'No featured image.',
    'It shows on blog cards and when the post is shared.'
  );
  rangeCheck('images', 'images', 'Images break up the text and show what words cannot.');
  const missingAlt = outline.imageAlts.filter((alt) => !alt).length;
  add(
    'images',
    'alt-text',
    outline.imageAlts.length ? passIf(missingAlt === 0, 'critical') : 'skipped',
    missingAlt ? `${plural(missingAlt, 'image')} without alt text.` : 'Every image has alt text.',
    'Alt text describes the image to people using screen readers, and to search engines.'
  );

  // Links
  const internal = outline.links.filter((link) => link.internal).length;
  add(
    'links',
    'internal-link',
    passIf(internal > 0),
    internal
      ? `${plural(internal, 'link')} to other pages on the site.`
      : 'No links to other pages on the site.',
    'Internal links help readers, and search engines, find related pages.'
  );
  const vague = outline.links.filter(
    (link) => VAGUE_LINK_TEXT.test(link.text) || BARE_URL.test(link.text)
  ).length;
  add(
    'links',
    'link-text',
    outline.links.length ? passIf(vague === 0) : 'skipped',
    vague
      ? `${plural(vague, 'link')} with text such as "click here" or a bare web address.`
      : 'Link text says where each link goes.',
    'Screen reader users often jump from link to link, so the text has to make sense on its own.'
  );

  // Brand language
  // Each distinct piece once: a search title that repeats the title would
  // otherwise double every count.
  const brandText = [
    ...new Set(
      [input.title, input.seoTitle, input.seoDescription, input.excerpt].map((text) => text.trim())
    ),
    outline.text,
    ...outline.imageAlts,
  ].join('\n');
  const brand = findBrandProblems(brandText);
  const never = brand.filter((f) => f.kind === 'term' && f.severity === 'critical');
  const avoid = brand.filter((f) => f.kind === 'term' && f.severity === 'warning');
  const spelling = brand.filter((f) => f.kind === 'spelling');
  const found = (list: BrandFinding[]) => list.map((f) => f.found).join(', ');
  add(
    'brand',
    'brand-never',
    passIf(!never.length, 'critical'),
    never.length ? `Words the brand never uses: ${found(never)}.` : 'None of the never-use words.',
    'The brand language guide rules these out for every customer-facing word.'
  );
  add(
    'brand',
    'brand-avoid',
    passIf(!avoid.length),
    avoid.length ? `Words to check: ${found(avoid)}.` : 'None of the words to avoid.',
    'These are usually wrong for the brand, though some are fine in context.'
  );
  add(
    'brand',
    'brand-spelling',
    passIf(!spelling.length, 'critical'),
    spelling.length
      ? `EarthSApHE written as ${found(spelling)}.`
      : 'EarthSApHE is written correctly wherever it appears.',
    'The name is a trade mark and is always written exactly EarthSApHE.'
  );
  const dashes = brandText.match(/[–—]/g)?.length ?? 0;
  const bangs = brandText.match(/!/g)?.length ?? 0;
  add(
    'brand',
    'punctuation',
    passIf(!dashes && !bangs),
    dashes || bangs
      ? `${plural(dashes, 'dash', 'dashes')} and ${plural(bangs, 'exclamation mark')}.`
      : 'No em or en dashes and no exclamation marks.',
    'House style uses neither in information copy.'
  );

  return { ...scoreChecks(checks), checks, structure, terms, brand, source: guidelines.source };
}
