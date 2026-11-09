# Content score on the dashboard: design

Date: 2026-11-09
Status: decided by the implementer on instruction ("do it all"); builds on the content score panel
(PR #123, `docs/superpowers/specs/2026-11-09-content-score-design.md`)

## Purpose

Editors can see how published posts score overall and which posts need work first, without opening
each one. The score stays advice only.

## Decisions

- **Store the score.** `posts.content_score` (integer, nullable). It always describes the post's
  columns, which for a published post are its live version. Pending draft edits do not change it
  until they are published.
- **Set it on every column write.** `columnWrites` (create, save of an unpublished post, publish,
  scheduled publish) and `savePostSeo` compute it with `analysePost` and the Settings targets.
  `columnWrites` scores with the resolved permalink when it has one, otherwise the slug the server
  would derive from the title.
- **Rescore nightly.** The daily cron (17:00 UTC) rescores every post that is not in the trash. This
  fills existing posts after the migration and catches target changes in Settings, so the card says
  "Scores update when a post is saved, and each night."
- **Bands are shared.** `SCORE_BANDS` in `@ll/content` (Good from 50, Strong from 80) drives both
  `scoreBand` and the SQL that counts posts per band.
- **Who sees it.** People who can publish or manage SEO, the same people who see content checks.
  Others do not get the card, and the server does not send them the data.

## Dashboard card

"Content score", two columns wide, after Needs attention:

- the average score of scored published posts, with "across N published posts";
- a horizontal bar chart of published posts per band (Needs work, Good, Strong), coloured like the
  editor gauge, using the shadcn chart component (recharts, already a dependency). The card is
  lazy-loaded like the Locations card, so the chart library does not hold up the page;
- "Lowest scores": up to 5 published posts, lowest first, each with its score, linking to its editor;
- "N not scored yet" when some published posts have no score;
- an empty state when nothing is published.

## Data

Migration `post-content-score`: `ALTER TABLE posts ADD content_score integer`. No index; the table
is small and the dashboard reads it in one batch.

## Testing

- Unit: `SCORE_BANDS` boundaries through `scoreBand`.
- Integration: a created draft stores the score `analysePost` gives; publishing stores it; the nightly
  rescore fills missing scores and skips trashed posts; the dashboard summary counts bands, averages,
  lists the lowest five and counts unscored posts, published only.
- Manual: the card on desktop and at 390px; the links open the editor.

## Out of scope

Filters, export and site-wide check lists (the rest of the audit dashboard), and scoring the pending
draft of a published post.
