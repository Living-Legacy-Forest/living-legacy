import { describe, expect, it } from 'vitest';
import {
  type ContentGuidelines,
  type ContentScore,
  type ScoreCheck,
  type ScoreInput,
  analysePost,
  SCORE_BANDS,
  SCORE_CATEGORIES,
  formatRange,
  structureCaption,
  structureProgress,
  guidelinesFromSettings,
  scoreBand,
  scoreChecks,
} from './content-score';
import type { RichTextDoc } from './posts';
import { SITE_SETTINGS_DEFAULTS, contentTargetsFrom } from './settings';

const t = (text: string, href?: string) => ({
  type: 'text',
  text,
  ...(href ? { marks: [{ type: 'link', attrs: { href } }] } : {}),
});
const p = (...content: object[]) => ({ type: 'paragraph', content });
const h = (level: number, text: string) => ({
  type: 'heading',
  attrs: { level },
  content: [t(text)],
});
const img = (alt?: string) => ({
  type: 'image',
  attrs: { src: '/media/a.jpg', ...(alt === undefined ? {} : { alt }) },
});
const doc = (...content: object[]) => ({ type: 'doc', content }) as RichTextDoc;

const contentTargets = guidelinesFromSettings(contentTargetsFrom(SITE_SETTINGS_DEFAULTS), {
  focusKeyword: 'Legacy Infusion Ceremony',
  relatedTerms: [],
});

const loose: ContentGuidelines = {
  source: 'settings',
  words: { min: 1, max: null },
  headings: { min: 1, max: null },
  paragraphs: { min: 1, max: null },
  titleLength: { min: 30, max: 60 },
  descriptionLength: { min: 70, max: 160 },
  sentenceWords: 20,
  paragraphWords: 150,
  permalinkLength: 60,
  images: { min: 1, max: null },
  terms: [
    { term: 'Legacy Infusion Ceremony', min: 2, kind: 'focus' },
    { term: 'family', min: 1, kind: 'related' },
  ],
};

const good: ScoreInput = {
  title: 'What happens at a Legacy Infusion Ceremony',
  seoTitle: '',
  seoDescription:
    'A Legacy Infusion Ceremony is where family and friends gather to place the ashes and see the tree take them up.',
  excerpt: '',
  slug: 'legacy-infusion-ceremony-guide',
  body: doc(
    h(2, 'Before the Legacy Infusion Ceremony'),
    p(
      t('The Legacy Infusion Ceremony brings family together. It is calm and unhurried. See '),
      t('our forests', '/locations/'),
      t('.')
    ),
    h(3, 'On the day'),
    p(t('Everyone gathers by the tree. The Legacy Infusion Ceremony takes about an hour.')),
    img('Family gathered around a young tree')
  ),
  featuredMediaId: 'media-1',
  noindex: false,
  focusKeyword: 'Legacy Infusion Ceremony',
  relatedTerms: ['family'],
};

const statusOf = (result: ContentScore, id: string) =>
  result.checks.find((c) => c.id === id)?.status;
const check = (category: ScoreCheck['category'], status: ScoreCheck['status']): ScoreCheck => ({
  id: `${category}-${status}`,
  category,
  status,
  message: '',
  why: '',
});

describe('analysePost', () => {
  it('passes a well-made post on keyword placement, structure, links, images and brand', () => {
    const result = analysePost(good, loose);
    for (const id of [
      'focus-keyword',
      'title-length',
      'description',
      'keyword-in-title',
      'keyword-in-description',
      'keyword-in-slug',
      'keyword-in-first-paragraph',
      'keyword-in-subheading',
      'keyword-uses',
      'related-terms',
      'heading-order',
      'no-h1',
      'featured-image',
      'alt-text',
      'internal-link',
      'link-text',
      'brand-never',
      'brand-avoid',
      'brand-spelling',
      'punctuation',
    ]) {
      expect([id, statusOf(result, id)]).toEqual([id, 'pass']);
    }
    // 3 uses in 36 words is far over 3%, which a real post would not be.
    expect(statusOf(result, 'keyword-stuffing')).toBe('warning');
  });

  it('skips the keyword checks until there is a focus keyword', () => {
    const result = analysePost({ ...good, focusKeyword: '' }, { ...loose, terms: [] });
    expect(statusOf(result, 'focus-keyword')).toBe('critical');
    expect(statusOf(result, 'keyword-in-title')).toBe('skipped');
    expect(statusOf(result, 'keyword-uses')).toBe('skipped');
    expect(statusOf(result, 'keyword-stuffing')).toBe('skipped');
  });

  it('does not judge the slug for keywords with symbols a permalink drops', () => {
    for (const focusKeyword of ['!!!', 'C++', 'C#']) {
      const result = analysePost({ ...good, focusKeyword, slug: 'c-sharp-tips' }, loose);
      expect([focusKeyword, statusOf(result, 'keyword-in-slug')]).toEqual([
        focusKeyword,
        'skipped',
      ]);
    }
  });

  it('counts brand problems once when the search title repeats the title', () => {
    const title = 'A grave matter for families';
    const result = analysePost({ ...good, title, seoTitle: title }, loose);
    expect(result.brand.find((f) => f.found === 'grave')?.count).toBe(1);
  });

  it('matches the keyword to whole slug segments', () => {
    const withSlug = (slug: string) =>
      statusOf(analysePost({ ...good, focusKeyword: 'tree', slug }, loose), 'keyword-in-slug');
    expect(withSlug('a-tree-for-mum')).toBe('pass');
    expect(withSlug('trees-for-mum')).toBe('warning');
  });

  it('falls back to the excerpt for the description, and is critical with neither', () => {
    expect(
      statusOf(
        analysePost({ ...good, seoDescription: '', excerpt: 'Too short.' }, loose),
        'description'
      )
    ).toBe('warning');
    expect(
      statusOf(analysePost({ ...good, seoDescription: '', excerpt: '' }, loose), 'description')
    ).toBe('critical');
  });

  it('flags missing alt text, skipped heading levels, an H1 and vague link text', () => {
    const result = analysePost(
      {
        ...good,
        body: doc(h(1, 'Title again'), h(2, 'A'), h(4, 'B'), p(t('click here', '/faqs/')), img()),
      },
      loose
    );
    expect(statusOf(result, 'alt-text')).toBe('critical');
    expect(result.checks.find((c) => c.id === 'alt-text')?.message).toBe(
      '1 image without alt text.'
    );
    expect(statusOf(result, 'heading-order')).toBe('warning');
    expect(statusOf(result, 'no-h1')).toBe('warning');
    expect(statusOf(result, 'link-text')).toBe('warning');
  });

  it('reports brand problems and house punctuation', () => {
    const result = analysePost(
      { ...good, body: doc(p(t('Visit the grave. EARTHSAPHE is great!'))) },
      loose
    );
    expect(statusOf(result, 'brand-never')).toBe('critical');
    expect(statusOf(result, 'brand-spelling')).toBe('critical');
    expect(statusOf(result, 'punctuation')).toBe('warning');
    expect(result.brand.map((f) => f.found)).toEqual(['grave', 'EARTHSAPHE']);
  });

  it('reads brand problems in image alt text too', () => {
    const result = analysePost({ ...good, body: doc(img('A cemetery plot')) }, loose);
    expect(result.brand.map((f) => f.found)).toContain('plot');
  });

  it('gives each structure count and term a state', () => {
    const result = analysePost(good, {
      ...loose,
      words: { min: 100, max: 200 },
      terms: [...loose.terms, { term: 'celebrant', min: 1, kind: 'related' }],
    });
    expect(result.structure.find((s) => s.key === 'words')).toMatchObject({
      value: 36,
      state: 'below',
    });
    expect(result.terms.find((term) => term.term === 'celebrant')).toMatchObject({
      count: 0,
      state: 'unused',
    });
    expect(result.terms.find((term) => term.kind === 'focus')).toMatchObject({
      count: 3,
      state: 'met',
    });
    expect(statusOf(result, 'related-terms')).toBe('warning');
  });

  it('scores an empty new post 0 and judges nothing it does not have', () => {
    const result = analysePost(
      {
        ...good,
        title: '',
        slug: '',
        body: null,
        focusKeyword: '',
        relatedTerms: [],
        featuredMediaId: null,
      },
      { ...loose, terms: [] }
    );
    expect(result.score).toBe(0);
    expect(statusOf(result, 'title-length')).toBe('critical');
    expect(statusOf(result, 'no-h1')).toBe('skipped');
    expect(statusOf(result, 'sentence-length')).toBe('skipped');
    expect(statusOf(result, 'alt-text')).toBe('skipped');
  });

  it('warns when the post is hidden from search engines', () => {
    expect(statusOf(analysePost({ ...good, noindex: true }, loose), 'indexing')).toBe('warning');
  });
});

describe('scoreChecks', () => {
  const allPass = SCORE_CATEGORIES.map((c) => check(c.id, 'pass'));
  const without = (id: ScoreCheck['category']) => allPass.filter((c) => c.category !== id);

  it('scores 100 when everything passes', () => {
    expect(scoreChecks(allPass).score).toBe(100);
  });

  it('weights categories, counts a warning as half and a critical issue as nothing', () => {
    const basicHalf = scoreChecks([
      ...without('basic'),
      check('basic', 'pass'),
      check('basic', 'critical'),
    ]);
    expect(basicHalf.categories.basic).toBe(50);
    expect(basicHalf.score).toBe(88); // 100 - 25 x 0.5 = 87.5
    expect(scoreChecks([...without('technical'), check('technical', 'warning')]).score).toBe(95);
  });

  it("uses a check's own credit when it has one", () => {
    const partWay = { ...check('content', 'warning'), credit: 0.2 };
    expect(scoreChecks([...without('content'), partWay]).score).toBe(80); // 100 - 25 x 0.8
  });

  it('leaves a category with nothing to check out of the total', () => {
    const result = scoreChecks([check('links', 'skipped'), check('images', 'critical')]);
    expect(result.categories.links).toBeNull();
    expect(result.score).toBe(0);
    expect(scoreChecks([check('basic', 'pass'), check('links', 'skipped')]).score).toBe(100);
  });
});

describe('guidelinesFromSettings', () => {
  const targets = contentTargetsFrom(SITE_SETTINGS_DEFAULTS);

  it('maps the targets and adds the post terms', () => {
    const g = guidelinesFromSettings(targets, { focusKeyword: ' Tree ', relatedTerms: ['family'] });
    expect(g.source).toBe('settings');
    expect(g.words).toEqual({ min: 600, max: 2000 });
    expect(g.paragraphs).toEqual({ min: 5, max: null });
    expect(g.terms).toEqual([
      { term: 'Tree', min: 2, kind: 'focus' },
      { term: 'family', min: 1, kind: 'related' },
    ]);
  });

  it('drops related terms that repeat the keyword or each other', () => {
    const g = guidelinesFromSettings(targets, {
      focusKeyword: 'tree',
      relatedTerms: ['Tree', 'family', 'FAMILY', ' '],
    });
    expect(g.terms.map((term) => term.term)).toEqual(['tree', 'family']);
  });
});

describe('formatRange and scoreBand', () => {
  it('format ranges and name score bands', () => {
    expect(formatRange({ min: 600, max: 2000 })).toBe('600 to 2,000');
    expect(formatRange({ min: 5, max: null })).toBe('at least 5');
    expect(scoreBand(49).label).toBe('Needs work');
    expect(scoreBand(50).label).toBe('Good');
    expect(scoreBand(80).label).toBe('Strong');
  });
});

describe('structureCaption and structureProgress', () => {
  const at = (value: number, min: number, max: number | null) => {
    const target = { min, max };
    const state = value < min ? 'below' : max !== null && value > max ? 'above' : 'within';
    return { key: 'words' as const, label: 'Words', value, target, state } as const;
  };

  it('says how many more are needed, and how far along the count is', () => {
    expect(structureCaption(at(3, 600, 2000))).toBe('Need 597 more');
    expect(structureProgress(at(3, 600, 2000))).toBeCloseTo(0.005);
    expect(structureCaption(at(0, 3, 12))).toBe('Need 3 more');
    expect(structureProgress(at(0, 3, 12))).toBe(0);
  });

  it('says when a count is in range or over, with a full bar', () => {
    expect(structureCaption(at(2, 1, 8))).toBe('In range');
    expect(structureCaption(at(9, 5, null))).toBe('In range');
    expect(structureCaption(at(10, 1, 8))).toBe('2 too many');
    expect(structureProgress(at(10, 1, 8))).toBe(1);
    expect(structureProgress(at(0, 0, 8))).toBe(1);
  });
});

describe('SCORE_BANDS', () => {
  it('sets where Good and Strong start, for the editor and the dashboard alike', () => {
    expect(SCORE_BANDS).toEqual({ good: 50, strong: 80 });
    expect(scoreBand(SCORE_BANDS.good - 1).band).toBe('low');
    expect(scoreBand(SCORE_BANDS.good).band).toBe('mid');
    expect(scoreBand(SCORE_BANDS.strong).band).toBe('high');
  });
});

describe('analysePost credit', () => {
  const words = (n: number) => doc(p(t(Array.from({ length: n }, () => 'tree').join(' '))));
  const credit = (result: ContentScore, id: string) =>
    result.checks.find((c) => c.id === id)?.credit;

  it('gives a count below its target credit for how far along it is', () => {
    const targets = { ...loose, words: { min: 600, max: 2000 } };
    expect(credit(analysePost({ ...good, body: words(300) }, targets), 'words-count')).toBe(0.5);
    expect(credit(analysePost({ ...good, body: words(0) }, targets), 'words-count')).toBe(0);
    expect(
      credit(analysePost({ ...good, body: words(700) }, targets), 'words-count')
    ).toBeUndefined();
  });

  it('gives no credit for a missing internal link', () => {
    const result = analysePost({ ...good, body: words(10) }, loose);
    expect(statusOf(result, 'internal-link')).toBe('warning');
    expect(credit(result, 'internal-link')).toBe(0);
  });

  it('skips brand language when there is no text to check', () => {
    const result = analysePost(
      { ...good, title: '', seoTitle: '', seoDescription: '', excerpt: '', body: null },
      loose
    );
    expect(statusOf(result, 'brand-never')).toBe('skipped');
    expect(statusOf(result, 'punctuation')).toBe('skipped');
    expect(result.categories.brand).toBeNull();
  });

  it("holds a short post's score down until it reaches the word target, and says so", () => {
    const targets = { ...loose, words: { min: 600, max: 2000 } };
    const short = analysePost({ ...good, body: words(13) }, targets);
    expect(short.score).toBe(41); // 40 + 60 x 13/600
    expect(short.held).toEqual({ score: 41, reason: 'Held at 41 until the post has 600 words.' });
    const half = analysePost({ ...good, body: words(300) }, targets);
    expect(half.score).toBeLessThanOrEqual(70);
    expect(analysePost(good, loose).held).toBeNull();
  });

  it('scores a few lines well below a full post', () => {
    const short = analysePost({ ...good, body: words(13) }, contentTargets);
    const full = analysePost(good, contentTargets);
    expect(short.score).toBeLessThan(50);
    expect(full.score).toBeGreaterThan(short.score);
  });
});

describe('brand language from Settings', () => {
  it('scores against the edited list instead of the built-in one', () => {
    const input = { ...good, body: doc(p(t('A cheap plot by the gate.'))) };
    const builtIn = analysePost(input, loose).brand.map((f) => f.found);
    expect(builtIn).toContain('plot');
    expect(builtIn).not.toContain('cheap');

    const edited = analysePost(input, {
      ...loose,
      brandRules: [{ match: 'cheap', instead: 'affordable', severity: 'critical' }],
    }).brand.map((f) => f.found);
    expect(edited).toEqual(['cheap']);
  });
});

describe('search listing and readability targets', () => {
  const base = {
    title: 'A title',
    seoTitle: 'Planting a tree',
    seoDescription: '',
    excerpt: '',
    slug: 'planting-a-tree-for-the-family',
    body: null,
    featuredMediaId: null,
    noindex: false,
    focusKeyword: '',
    relatedTerms: [],
  };
  const status = (id: string, targets: Parameters<typeof contentTargetsFrom>[0]) =>
    analysePost(base, guidelinesFromSettings(contentTargetsFrom(targets), base)).checks.find(
      (c) => c.id === id
    );

  it('judges the search title by the range in Settings', () => {
    // "Planting a tree" is 15 characters: short of the default 30.
    expect(status('title-length', SITE_SETTINGS_DEFAULTS)?.status).toBe('warning');
    const short = { ...SITE_SETTINGS_DEFAULTS, targetTitleMin: 10, targetTitleMax: 20 };
    expect(status('title-length', short)?.status).toBe('pass');
    expect(status('title-length', short)?.message).toContain('aim for 10 to 20');
  });

  it('judges the permalink by the limit in Settings', () => {
    expect(status('slug-length', SITE_SETTINGS_DEFAULTS)?.status).toBe('pass');
    const strict = { ...SITE_SETTINGS_DEFAULTS, targetSlugMax: 20 };
    expect(status('slug-length', strict)?.status).toBe('warning');
    expect(status('slug-length', strict)?.message).toContain('20 or fewer');
  });
});

describe('what the brand check looks at', () => {
  const input = {
    title: 'A quiet morning',
    seoTitle: 'The deceased in the forest',
    seoDescription: '',
    excerpt: '',
    slug: 'a-quiet-morning',
    body: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Come along! It is calm.' }] },
      ],
    },
    featuredMediaId: null,
    noindex: false,
    focusKeyword: '',
    relatedTerms: [],
  } as unknown as Parameters<typeof analysePost>[0];
  const run = (overrides: Partial<typeof SITE_SETTINGS_DEFAULTS>) =>
    analysePost(
      input,
      guidelinesFromSettings(contentTargetsFrom({ ...SITE_SETTINGS_DEFAULTS, ...overrides }), input)
    ).checks;
  const check = (checks: ReturnType<typeof run>, id: string) => checks.find((c) => c.id === id)!;

  it('flags a never-use word in the search title unless that is skipped', () => {
    expect(check(run({}), 'brand-never').status).toBe('critical');
    expect(check(run({ brandCheckSearchListing: false }), 'brand-never').status).toBe('pass');
  });

  it('flags exclamation marks unless they are ignored', () => {
    expect(check(run({}), 'punctuation').status).toBe('warning');
    expect(check(run({ brandFlagExclamations: false }), 'punctuation').status).toBe('pass');
  });

  it('skips the punctuation check when both kinds are ignored', () => {
    const checks = run({ brandFlagExclamations: false, brandFlagDashes: false });
    expect(check(checks, 'punctuation').status).toBe('skipped');
  });
});
