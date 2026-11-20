# CMS AI suggestions

Status: draft, awaiting approval. Date: 2026-11-20.

## Intent and the why

Editors fill in the same small fields on every post and every image: the search title and
description, the excerpt, a focus keyword, tags, and alt text. It is slow, it is easy to skip, and
the skipped ones show up later as gaps on the Content checks page. The brand and content checks
already tell editors _what_ is wrong (a banned word, a description that is too long) but not how to
fix it.

The CMS should help while people work: a small **Suggest** button beside each field, and a
**Suggest a fix** button beside each brand problem. The model proposes; a person accepts, edits or
ignores. Nothing is saved or published by the AI.

The CMS itself has never called a model. The only AI today is the outside connector (`/mcp`), which
lets tools like Claude read posts and write drafts. This adds in-CMS help; it does not replace the
connector.

## Goals

- One-click suggestions for: post SEO title, SEO description, excerpt, focus keyword, tags (chosen
  from existing ones), and image alt text (the model looks at the image).
- "Suggest a fix" for each brand problem the checks already find.
- Every suggestion obeys the brand guide before an editor ever sees it.
- Works on phones (44pt targets, no hover-only controls).

## Non-goals

- No chat, no "ask the CMS" questions, no writing help inside the rich-text editor. Those are later
  features and each needs its own design (the question feature in particular touches guest data).
- No bulk or background runs in v1 (for example "write alt text for every image missing it").
  Worth doing later as a cleanup, once the single-item flow is trusted.
- No AI on the public website (`apps/web`).
- No change to the `/mcp` connector.
- No admin on/off switch in v1 (see Open for later). A daily limit per person was added after the
  first build: 100 suggestions a day, counted per press, starting again at midnight in the site's
  time zone (`ai_usage` table, `server/ai/usage.ts`).

## Anti-goals (a failure even if it technically works)

- A suggestion that contains a banned word, a wrong product name, an em or en dash, or an
  exclamation mark reaches the editor.
- The AI saves, publishes or overwrites anything without a person pressing the field's normal save.
- Any name, email address, phone number or guest detail is sent to the model.
- The API key reaches the browser, a log line, or the repository.
- A failed or refused request leaves a field blank or half-filled.

## Constraints

- Model: **Claude Haiku 5.5**, `claude-haiku-5-5`. Chosen by the product owner. It takes images,
  is the cheapest current model ($0.10 / $0.50 per million tokens up to 100K tokens), and the output
  is short.
- Runs on Cloudflare Workers with `nodejs_compat`. Use the official `@anthropic-ai/sdk` (not raw
  `fetch`). The builder confirms it bundles and runs on the Worker; if the SDK does not, raw HTTP is
  the only permitted fallback and must be noted in the PR.
- The key is a Worker secret, `ANTHROPIC_API_KEY`, set like `RESEND_API_KEY`: listed in
  `apps/cms/.dev.vars.example`, in the generated Worker env types, and in `README.md`. When it is not
  set, the Suggest buttons are not shown at all and the server functions refuse with a readable
  error.
- Haiku 5.5 request rules: no `temperature`, `top_p` or `top_k` (non-default values return 400); no
  assistant prefill; thinking is on by default, so set `output_config.effort: "low"` and leave
  `thinking` unset (or adaptive); use `output_config.format` (JSON schema) for structured replies;
  check `stop_reason` before reading `content`. There is no server-side refusal fallback for Haiku;
  a `refusal` is shown to the editor as a plain message.
- Repo rules apply: server functions use `createServerFn` with middleware and a Zod validator in the
  shape in `AGENTS.md`; permissions are checked on the server; copy is plain sentence-case Australian
  English; loading uses the shadcn `Spinner`; errors are Sonner toasts, never inline; icons come from
  `@/components/icons`; a change editors would notice gets an entry in `lib/whats-new.ts`.

## Approaches considered

1. **Suggest button beside each field (chosen).** The editor stays in control of each field; the
   server can check each suggestion against the field's own limits; easy to explain. Cost: one click
   per field, so slow for clearing a backlog.
2. **One "Fill in the gaps" button** that fills every empty field on a post, plus a bulk alt-text
   action. Fast for backlogs, but editors see less of what they accept and may save unread text. Kept
   as a possible later addition for alt text only.
3. **Extend the outside connector** so tools like Claude write these fields. Least new code, but
   editors would have to leave the CMS, which is not the goal. Dropped.

The product owner picked approach 1.

## The design

### Server

New file `apps/cms/src/server/ai.ts`, one area per the repo layout. Three server functions, all
`POST`, all behind the same permission that lets the person edit the thing being suggested for (the
builder looks up the right permission name in `@ll/content`; `content:write` is the one used by posts):

- `suggestPostFields({ field, post })` where `field` is one of `seoTitle`, `seoDescription`,
  `excerpt`, `focusKeyword`, `tags`. The input is the post's current title, excerpt, body (as
  Markdown via `richTextToMarkdown`) and, for tags, the list of existing tag names. Nothing else.
- `suggestAltText({ mediaId })`. The server reads the image from R2 itself (the browser sends only
  the id), prefers a stored smaller variant, and sends it as a base64 image block. Supported types
  are JPEG, PNG, GIF and WebP; anything else (SVG, PDF) returns "Alt text can only be suggested for
  photos and images." The image's caption, if any, may go along as context. Its filename does not.
- `suggestBrandFix({ text, found })`. `text` is the sentence or field value containing a finding;
  `found` is the flagged word. It returns a rewrite of that text only.

Shared plumbing in the same file (or a small `ai/` folder if it grows):

- **Prompt.** The system prompt is the brand guide (`docs/brand-language.md`, imported with `?raw`
  as `mcp.ts` already does) plus a short per-field brief and the field's limit. The brand guide is
  the stable prefix, so use top-level `cache_control: { type: "ephemeral" }`; Haiku's minimum
  cacheable size may mean it does not cache, which is fine.
- **Reply shape.** JSON via `output_config.format`, validated again with Zod. Tags reply with names
  from the supplied list only; anything not in the list is dropped.
- **The brand guard.** Every suggestion goes through `findBrandProblems(text, brandRules)` with the
  site's rules from `loadContentTargets(db)`, plus checks for em and en dashes, exclamation marks and
  the field's length limit (`SEO_TITLE_LIMIT`, `SEO_DESCRIPTION_LIMIT`, and so on, from
  `@ll/content`). If it fails, retry **once**, telling the model exactly what was wrong. If it fails
  again, return an error ("Couldn't write one that follows the brand guide. Try again or write it
  yourself.") and never the text.
- **Errors.** Typed SDK errors, most specific first. Throw `Error` with a sentence the editor can
  read (rate limit: "The writing assistant is busy. Try again in a moment."). Never include the
  provider's raw message or any request content.
- **Logging.** Log field name, model, token usage and outcome (ok, guard retry, guard fail, error).
  Never log post text, image data or the key.
- `max_tokens` is small (around 1,000); these replies are one line to a short paragraph.

### Client

- A `SuggestButton` in `components/ai/`: a small outline button with a sparkle icon and the label
  "Suggest". Pending state is the shadcn `Spinner`. On success it puts the suggestion into the field
  through the form's normal `onChange`, so it appears as an ordinary unsaved edit, and shows a toast
  with **Undo** that restores the previous value. On failure it shows the error as a toast.
- Placed in: `seo-fields.tsx` (title, description, focus keyword), the post properties panel
  (excerpt, tags), the media detail panel and `image-field.tsx` (alt text, only once an image is
  chosen), and next to each finding in the post editor's content-score Brand section and on the
  Content checks page's brand rows.
- If the field already has text, the button reads "Rewrite" and Undo is what keeps that safe.
- Whether the buttons show at all comes from a boolean the route loader exposes (key present and
  viewer allowed to edit). The key is never sent to the client.
- Suggest a fix: for plain-text fields (title, excerpt, SEO) the rewrite can be applied with one
  click. For findings inside the rich-text body, v1 shows the original sentence and the rewrite with a
  **Copy** button; applying into the rich-text editor is out of scope.
- Phones: targets are at least 44pt (`touch:min-h-11`); nothing depends on hover. Check at 390px
  with touch emulation.

### Privacy

Only the text or image of the item being edited, and the brand guide, are sent. No team, event,
guest, enquiry or user data, and no filenames or email addresses. This matches the rule that names,
emails and phone numbers do not go to analytics, and applies it to the model as well. The builder
should state in the PR that content is sent to Anthropic's API.

### Tests

- Unit (`*.test.ts`, no network, no database): the guard (banned word, dash, exclamation mark, over
  length, tag not in list), the retry-once-then-fail flow, and prompt assembly, all against an
  injected fake client. No test calls the real API.
- Integration (`*.integration.test.ts`): `suggestAltText` reads a real object from the local R2 and
  refuses an unsupported type; permission is enforced; behaviour when the key is unset.
- A short manual check against the real model with a handful of real posts and images before merge,
  by the builder, to see that suggestions read well. Not part of CI.

### What's new

One entry at the top of `lib/whats-new.ts`: Suggest buttons on post search fields, excerpt, tags and
alt text, and Suggest a fix on brand problems, with links to where to find them.

## Left to the builder

These are small calls with a sensible default; none changes what gets built.

- Exact brief wording per field, within the brand guide and the field limits.
- Exact `max_tokens`, image size choice (which stored variant) and the JPEG/PNG cap that keeps a
  request under the API's image limit.
- Where `ANTHROPIC_API_KEY` is read (`getDb`-style helper beside `lib/db`).
- Whether `SuggestButton` reuses `useAction()` or is a lighter hook (it must not trigger a loader
  refresh, since nothing is saved).
- Whether the focus keyword and related terms suggestions share one request.

## Open for later (not decided)

- An admin switch in Settings to turn suggestions off.
- Bulk alt-text for existing images missing it.
- Applying a brand fix directly inside the rich-text body.
