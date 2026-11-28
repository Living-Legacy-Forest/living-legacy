# Launch readiness page (design)

Status: awaiting approval. Size: small (one page, one small table, mostly reuse).

## Intent

The national site launches in mid-January 2027. The CMS can already say what is wrong with
content (`/checks`). It cannot say whether the site as a whole is ready: whether each forest has
what its page needs, whether tracking, consent, monitoring and forms are set up, or whether the
by-hand tests in `docs/national-site.md` were done. One page that answers "are we ready, and if
not, what is left?" protects the launch date and the first weeks after it.

## Goals

- One screen at `/launch` with an overall state ("Ready" or "N things to fix") and a list of
  what is left, grouped, each with a link to where it is fixed.
- Automated checks that read live data, and a manual list for things only a person can confirm.
- Reuse what exists. Content problems come from `loadContentChecks`, not a second scan.

## Non-goals

- Not a publish gate. Nothing is blocked by this page.
- No pasted-list tester for old URLs in the first version (see "Left to the builder").
- No dashboard tile and no notifications in the first version.
- Nothing sent to analytics, and no names, emails or phone numbers shown from enquiries.

## Anti-goals

- A green tick that lies. Each automated check says what it looked at. If the CMS cannot tell
  (a service is unreachable, a setting is unreadable) it shows "Couldn't check", never a pass.
- A second place that duplicates `/checks`. Content issues show here as a count and a link.

## Approaches considered

- **A. More checks on `/checks`.** Cheapest, but that page is for content problems that get
  fixed and disappear. Launch items are one-off configuration and would clutter it afterwards.
- **B. A new Launch page (chosen).** Automated checks, a manual sign-off list, reuse of the
  existing check code. Costs one small table for the ticks.
- **C. A static checklist in the docs.** Trivial, but goes stale and cannot see the data.

Chosen: B. The user left the pick to me; this is my call.

## What the page shows

1. **Each forest** (every live location; "coming soon" ones need only a register-interest
   form; "external" ones need their outside link). For live forests: hero photo, address, map
   pin, hours, phone or email, HubSpot form ID, search title and description (or a usable
   fallback), and that it is not set to `noindex` by accident.
2. **Site setup.** Tracking ids present (Integrations, Website tracking), cookie banner words
   set (Settings, Cookies & privacy), uptime monitors present and up, daily job heartbeats
   recent, email sending configured.
3. **Redirects.** Every enabled redirect lands on a live page, never the homepage by default,
   never a loop or a chain.
4. **Content.** Counts from `/checks`: banned words, broken links, pages with no description
   or alt text. Banned words and broken links count as things to fix; the rest are advice.
5. **By hand.** A fixed list taken from `docs/national-site.md` (GA4 events seen on real
   traffic, HubSpot routing tested per team, consent banner tested, form success, duplicate and
   error states, old domains and their redirects kept, sitemap and robots checked). Each item
   can be ticked, with who and when.

```
Launch readiness                               3 things to fix
─────────────────────────────────────────────────────────────
Forests
  Living Legacy Mornington      ✓ ready
  Living Legacy Wellington Dam  ✗ no HubSpot form · no opening hours   Edit
Site setup
  Tracking ids                  ✓
  Uptime monitors               ✓ 4 up
Redirects                       ✗ 2 point at the homepage              Open
Content                         ✓ no banned words · 1 broken link      Open Checks
By hand                         5 of 8 done
  [x] Consent banner tested     Dede, 20 Nov
  [ ] HubSpot routing tested per team
```

## Constraints

- Follows the CMS conventions in `AGENTS.md`: a server function per area
  (`apps/cms/src/server/launch.ts`), a route that loads and renders one page component
  (`components/launch/`), `useAction()` for ticking, shadcn `Spinner` for loading.
- Access: the same rule as `/checks` (`posts:publish` or `seo:write`). Ticking a manual item
  needs the same.
- Wording is sentence case, Australian English, and follows `docs/brand-language.md`.
- A new table for manual ticks: a migration under `packages/db/migrations/`; never edit a
  shipped one.
- Entry at the top of `lib/whats-new.ts` when it ships, and a sidebar item.

## Decisions I made (my calls, change any)

- The manual list is fixed in code for v1, not editable in the CMS.
- Page lives at `/launch`, separate from `/checks`, and is visible to the roles that see Checks.
- "Land on the homepage" counts as a fix, because `docs/national-site.md` says never redirect
  everything there.

## Left to the builder

- Exact shape of the ticks table and the check result type.
- How "uptime up" and "heartbeats recent" are read (the uptime and cron-monitor code already
  does this).
- Whether a pasted-list tester for old URLs is worth a second piece; it needs the real list of
  old URLs, which isn't in the repo.
- Whether to retire the page after launch or keep it for new forests (a new forest is "content
  plus configuration", so the forest checks stay useful).

## Testing

Integration tests (local D1, as in `content-checks.integration.test.ts`) for each automated
check with a passing and a failing fixture, including the "couldn't check" path, and for ticking
and un-ticking a manual item.
