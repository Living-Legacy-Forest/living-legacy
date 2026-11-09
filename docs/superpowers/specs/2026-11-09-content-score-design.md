# Content score panel: design

Date: 2026-11-09
Status: approved in conversation, awaiting spec review

## Purpose

Editors get live, measurable feedback on a blog post while they write it: a score out of 100,
structure counts against targets, focus keyword and related term usage, and brand language
problems. It is the first of four search-related pieces (see "Later pieces"). The score is
editorial advice. It does not predict rankings and never blocks saving or publishing.

## Decisions

- **Targets come from us first, built to swap.** The panel reads its targets from a
  `ContentGuidelines` object. In this piece they come from Settings (ranges) and the post itself
  (terms). A later competitor source can fill the same shape from top-ranking pages without
  touching the panel.
- **No keyword density target.** The panel checks where the focus keyword appears and warns
  only when it looks stuffed.
- **Brand language is a scored category.** The rules in `docs/brand-language.md` are the most
  likely way a post goes wrong on this site, so they are checked alongside search checks.
- **The score is not stored.** It is cheap to compute from the post; the audit dashboard can
  run the same function on the server later.
- **The focus keyword stays inside the CMS.** The website never renders it (no `meta keywords`).

## Panel

A new collapsible **Content score** section at the top of the editor side panel
(`properties-panel.tsx`), open by default, above "Search listing". Below `lg` the panel already
sits under the editor, so the section follows with no layout work.

Contents, top to bottom:

1. **Gauge.** A semicircle with the score out of 100. Bands: 0 to 49 red, 50 to 79 amber,
   80 to 100 green. The number and a word ("Needs work", "Good", "Strong") are always shown, so
   colour is never the only signal. A "Details" toggle opens the check list.
2. **Structure.** Four counts: words, headings, paragraphs, images. Each shows its target range
   under it and an up arrow (below range), down arrow (above range) or tick.
3. **Terms.** The focus keyword and related terms as chips reading `term  used/target`. Green
   when the target is met, amber when partly met, red when unused. Empty state: "Add a focus
   keyword in Search listing to see how it is used."
4. **Brand language.** Each problem found: the word as written, how many times, and what to
   write instead. Empty state: "No brand language problems."
5. **Details** (collapsed by default). Checks grouped by category, critical issues first, then
   warnings, then passes. Each line has a short message and one sentence on why it matters.
6. A source line: "Targets from Settings" (later: "Targets from top-ranking pages").

Tappable rows meet the 44pt rule (`touch:min-h-11`). Nothing relies on hover.

## Analysis engine

Pure TypeScript in `packages/content`, no DOM, no database, so the CMS client and later the
server can both run it.

```ts
type Range = { min: number; max: number | null };
type TermTarget = { term: string; min: number; kind: 'focus' | 'related' };

interface ContentGuidelines {
  source: 'settings' | 'competitors';
  words: Range;
  headings: Range;
  paragraphs: Range;
  images: Range;
  terms: TermTarget[];
}

interface ScoreInput {
  title: string;
  seoTitle: string;
  seoDescription: string;
  excerpt: string;
  slug: string;
  body: RichTextDoc;
  featuredMediaId: string | null;
  ogMediaId: string | null;
  noindex: boolean;
  focusKeyword: string;
  relatedTerms: string[];
}

type CheckStatus = 'pass' | 'warning' | 'critical' | 'skipped';
type Category = 'basic' | 'content' | 'technical' | 'images' | 'links' | 'brand';

interface Check {
  id: string; // stable, e.g. 'keyword-in-title'
  category: Category;
  status: CheckStatus;
  message: string; // what was found
  why: string; // why it matters
}

interface ContentScore {
  score: number; // 0 to 100, rounded
  categories: Record<Category, number>; // 0 to 100 each
  checks: Check[];
  structure: { words: number; headings: number; paragraphs: number; images: number };
  terms: { term: string; kind: 'focus' | 'related'; count: number; min: number }[];
  brand: { found: string; count: number; instead: string; severity: 'warning' | 'critical' }[];
}

function analysePost(input: ScoreInput, guidelines: ContentGuidelines): ContentScore;
function guidelinesFromSettings(targets: ContentTargets, input: ScoreInput): ContentGuidelines;
```

### Reading the body

`outlineRichText(doc)` walks the editor's rich-text JSON once and returns:

- plain text (reusing `richTextPlainText`), word count, sentences;
- paragraphs: non-empty `paragraph` nodes outside lists and tables;
- headings: `heading` nodes with their level and text;
- the first paragraph's text;
- images: each `image` node and whether it has non-empty `alt`;
- links: each `link` mark's `href` and text, classed as internal (relative, or host
  `livinglegacy.com.au` / `www.livinglegacy.com.au`) or external.

Matching is case-insensitive on whole words and phrases, with Unicode letters and digits as
word characters.

### Checks

| Category              | Check                         | Pass                                       | Otherwise                                             |
| --------------------- | ----------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| Basic SEO (25)        | Focus keyword set             | set                                        | critical; keyword checks below become `skipped`       |
|                       | Search title length           | effective title 30 to 60 characters        | warning                                               |
|                       | Search description            | effective description 70 to 160 characters | critical if empty, warning if outside range           |
|                       | Keyword in search title       | present                                    | warning                                               |
|                       | Keyword in description        | present                                    | warning                                               |
|                       | Keyword in slug               | slugified keyword is in the slug           | warning                                               |
|                       | Keyword in first paragraph    | present                                    | warning                                               |
|                       | Keyword in a subheading       | in at least one H2 or H3                   | warning                                               |
| Content quality (25)  | Word count                    | within `words`                             | warning                                               |
|                       | Headings                      | within `headings`                          | warning                                               |
|                       | Paragraphs                    | within `paragraphs`                        | warning                                               |
|                       | Focus keyword use             | at least its `min` uses in the body        | warning                                               |
|                       | Keyword stuffing              | focus keyword under 3% of words            | warning                                               |
|                       | Related terms                 | each used at least its `min`               | warning when any are unused                           |
|                       | Sentence length               | average 20 words or fewer                  | warning                                               |
|                       | Long sentences                | 25% or fewer are over 25 words             | warning                                               |
|                       | Long paragraphs               | none over 150 words                        | warning                                               |
| Technical (10)        | Heading order                 | no skipped levels, first heading is H2     | warning                                               |
|                       | No H1 in body                 | none (the post title is the H1)            | warning                                               |
|                       | Slug length                   | 60 characters or fewer                     | warning                                               |
|                       | Indexing                      | not hidden from search engines             | warning ("This post will not appear in search")       |
| Images (15)           | Featured image                | set                                        | critical                                              |
|                       | Image count                   | within `images`                            | warning                                               |
|                       | Alt text                      | every body image has alt text              | critical, naming how many are missing                 |
| Links (10)            | Internal link                 | at least one                               | warning                                               |
|                       | Link text                     | none are "click here", "here", "read more", or a bare URL | warning                                |
| Brand language (15)   | Never-write terms             | none found                                 | critical (see rules)                                  |
|                       | Words to avoid                | none found                                 | warning                                               |
|                       | EarthSApHE spelling           | every match of `earth\s?saphe` is exactly `EarthSApHE` | critical                                  |
|                       | Dashes and exclamation marks  | no em or en dashes, no `!`                 | warning                                               |

"Effective" title and description follow the website's fallbacks: search title, else post
title; search description, else excerpt.

Brand checks read the title, search title, search description, excerpt, body text and image alt
text.

### Score maths

Within a category every non-skipped check counts equally: pass is 1, warning 0.5, critical 0.
The category score is the average times 100; a category with no applicable checks scores 100.
The overall score is the weighted sum of category scores using the weights in brackets above
(they total 100), rounded to a whole number.

### Brand language rules

`packages/content/src/brand-language.ts` exports a typed list built from
`docs/brand-language.md`: `{ match: string; instead: string; severity: 'critical' | 'warning' }`.

- **Critical (never write):** plot, grave, cremains, the deceased, final resting place, resting
  place, paramagnetic, SoilSAFE, SSAFE, Living Legacy Formula, Living Legacy Liquid, limited
  availability, act now, enquire for pricing, Mornington Green.
- **Warning (usually wrong, sometimes fine):** remains (also an ordinary verb), cemetery (fine
  when comparing), formula, liquid, loved one, the departed, memorial garden, memorial park,
  sanctuary, treated ashes, interment, burial, salesperson, officiant.

The file links back to the guide; a comment says to update both together.

## Targets

Defaults, used until someone saves their own:

| Target     | Default        |
| ---------- | -------------- |
| Words      | 600 to 2,000   |
| Headings   | 3 to 12        |
| Paragraphs | at least 5     |
| Images     | 1 to 8         |
| Focus keyword uses | at least 2 |
| Related term uses  | at least 1 |

`ContentTargets` lives in `packages/content/src/settings.ts` as a Zod schema with these defaults,
stored as a `contentTargets` key in the existing `site_settings` JSON (no migration). Validation:
whole numbers, 0 or more, min not above max. A "Content targets" group on the Settings page edits
it, behind `seo:write` like the other search settings. The post editor's loader returns the
targets with the post.

## Data

One migration (`bun run --filter @ll/db generate -- --name post-focus-keyword`) adds to `posts`:

- `focus_keyword` text, nullable;
- `related_terms` JSON text, not null, default `[]`.

Existing posts get no keyword and no terms, so their Basic SEO checks show "Add a focus keyword".

`postInputSchema` gains `focusKeyword` (trimmed, up to 80 characters) and `relatedTerms` (up to
10 distinct terms, each trimmed, 1 to 60 characters, compared case-insensitively). The server
saves them the same way it saves `seoTitle` and `seoDescription`, revisions included.

## Editor fields

The "Search listing" section gains, under Description:

- **Focus keyword:** a single input. Hint: "The phrase people search for. Used only for the
  content score."
- **Related terms:** a tag input (type, Enter to add, × to remove) with the same limits as the
  schema.

They are disabled when the post is read-only, like the fields around them.

## Behaviour

- `useContentScore(values, targets)` debounces its input by 500 ms and memoises the result, so
  typing never runs the analysis on every keystroke.
- The panel shows the last result while a new one is pending; no spinner, as the work is fast.
- A body the analyser cannot read (unexpected node shapes) is treated as empty text rather than
  throwing; the panel shows the result for what it could read.

## Files

| Path                                                               | Change                                    |
| ------------------------------------------------------------------ | ----------------------------------------- |
| `packages/db/src/schema/content.ts`, `packages/db/migrations/`     | two columns, one migration                |
| `packages/content/src/content-score.ts` (+ test)                   | types, `analysePost`, `guidelinesFromSettings` |
| `packages/content/src/rich-text-outline.ts` (+ test)               | `outlineRichText`                         |
| `packages/content/src/brand-language.ts` (+ test)                  | rules and matcher                         |
| `packages/content/src/posts.ts`, `settings.ts`                     | schema fields, `ContentTargets`           |
| `apps/cms/src/server/posts.ts`, `post-store.ts`, `settings.ts`     | save and load the new fields and targets  |
| `apps/cms/src/components/posts/post-editor/content-score/`         | section, gauge, structure, terms, brand list, details, `use-content-score.ts` |
| `apps/cms/src/components/posts/post-editor/seo-fields.tsx`         | focus keyword and related terms inputs    |
| `apps/cms/src/components/posts/post-editor/properties-panel.tsx`   | mount the section                         |
| `apps/cms/src/components/settings/settings-page.tsx`               | Content targets group                     |

The website (`apps/web`) does not change.

## Testing

- **Unit (`packages/content`):** `outlineRichText` on headings, nested lists, images with and
  without alt, internal and external links; every check's pass and failure cases; skipped
  keyword checks when no keyword is set; score maths (weights, empty categories, rounding);
  brand rules (whole-word matching, `remains` as a warning, EarthSApHE spelling, a correct
  `EarthSApHE™` passing); `ContentTargets` validation and defaults; the new `postInputSchema`
  limits.
- **Integration (`apps/cms`):** saving a post with a focus keyword and related terms and reading
  them back; saving and reading content targets, including the defaults when none are saved.
- **Manual:** the panel at 390px with touch emulation and on desktop; the score updating as the
  body, keyword and title change; a read-only post showing the panel with disabled inputs.

## Limitations

- Brand warnings cannot read context ("the question remains", a fair cemetery comparison). They
  cost half a check, and there is no per-post dismiss in this piece.
- Readability is sentence and paragraph length only. No reading-age formula.
- Targets are one site-wide set, not per category.

## Later pieces (separate specs)

1. **Competitor targets:** a second `ContentGuidelines` source from top-ranking pages for the
   focus keyword, through a paid search data service, cached per keyword.
2. **Metadata layer:** central head tag builder for the website, article Open Graph tags,
   BreadcrumbList, Organization and WebSite JSON-LD, sitemap coverage for every on-request page.
3. **Post search fields and redirects:** canonical override, social title and description,
   finer robots directives, a 301 offered when a published slug changes, redirect loop and
   chain checks, 307 and 308.
4. **Audit dashboard:** extend Content checks with site-wide scores, filters and export, running
   `analysePost` on the server.
