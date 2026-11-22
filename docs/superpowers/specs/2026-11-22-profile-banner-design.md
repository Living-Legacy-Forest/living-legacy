# Profile banner and a polished profile header

Approved 2026-11-22.

## Intent

The CMS profile page is plain: a small avatar and a name. Give it an X-style header: a wide banner
across the top with the avatar overlapping its lower edge, the name, role and bio beneath. People
can upload their own banner; until they do, a soft gradient fills the space so it is never bare.

## Goals

1. Upload a banner image: cropped to 3:1, up to 5 MB, JPEG, PNG, WebP, AVIF or GIF (as avatars).
2. Replace or remove it. The old file is deleted; remove brings the default back.
3. Default look: a soft gradient drawn from the CMS colour palette (the `--tint-*` variables), in
   light and dark, varying slightly per person so two people do not look identical.
4. Header polish: larger avatar with a ring that overlaps the banner; name, role, member-since and
   bio beneath; centred on phones with a shorter banner.
5. The banner is decorative: hidden from screen readers, no description field.

## Non-goals

- Showing the banner anywhere but a person's own profile (Users page, team page): a follow-up.
- Preset images, patterns or colour pickers.
- An admin setting someone else's banner.

## Constraints

- One new optional column, `user.banner`, through a new migration. Never edit a shipped migration.
- Stored in the existing R2 bucket as `banner-<uuid>.<ext>`, served publicly from
  `/api/banner/<key>`, tagged with the owner in `customMetadata.userId`, like avatars.
- `banner` is not client-settable through Better Auth (`input: false`): it changes only through two
  server functions that check the file is the caller's own.
- The orphan sweep (`server/media-sweep.ts`) must keep every file a user's `banner` points at.
- Follow the repo: loading uses `Spinner`; icons from `@/components/icons`; touch targets at least
  44pt (`touch:min-h-11`); check at 390px; copy in plain Australian English; What's new entry.

## Approaches considered

1. **Mirror the avatar: upload route, then a server function saves the URL (chosen).** Familiar
   flow, ownership is checked on the server, and avatar code stays untouched.
2. **Reuse the shared Media library.** Needs `media:write`, and every person's banner would show up
   in the library. Rejected.
3. **Save through Better Auth's `updateUser` like the avatar photo does.** Simpler, but the client
   could then point `banner` at any URL or someone else's file. Rejected.

## Left to the builder

- Exact gradient stops: check all five palettes in light and dark. No text sits on the gradient.
- The banner's height (suggest `aspect-[3/1]`, capped near 13rem on desktop, shorter on phones).
