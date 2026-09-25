# shadcn/ui migration and golden-ratio type

**Date:** 2026-09-24. Applies on top of `2026-09-24-live-site-rebuild.md`.

## Decisions

- React is on (`@astrojs/react`), shadcn is initialised with `base-nova` (Base UI primitives, lucide icons), matching the sister Wellington Dam site. `components.json` is in the repo root.
- Every UI element that has a shadcn equivalent uses it. The site's look (paper, ink, moss, Fraunces headings, Instrument Sans body, growth rings) does not change: shadcn's tokens are mapped onto the palette in `src/styles/global.css`.
- Type is on a golden-ratio scale (step = sqrt(phi) = 1.272, two steps = phi = 1.618). Tailwind's size names are remapped to it in `global.css`.

## Installed components (`src/components/ui/*.tsx`)

accordion, alert, badge, breadcrumb, button, card, carousel, checkbox, dialog, field, hover-card, input, label, navigation-menu, pagination, select, separator, sheet, sonner, tabs, textarea, toggle, toggle-group.

`button.tsx`, `card.tsx` and `accordion.tsx` are already tuned to the site (pill buttons, paper cards, serif accordion triggers with a rotating plus, answers kept in HTML via `hiddenUntilFound`). **Do not edit files in `src/components/ui/`, `global.css`, `astro.config.mjs`, `package.json` or the lockfile.** If a component needs a variant or a new shadcn component is required, stop and report it.

## Type rules (golden scale)

| Class | Size | Use |
| --- | --- | --- |
| `text-xs` | 0.786rem | captions, legal small print, meta |
| `text-base` (`text-sm` is identical) | 1rem | body, UI, card body |
| `text-lg` | 1.272rem | card titles, lead on desktop |
| `text-xl` | 1.618rem | small headings |
| `text-2xl` | 2.058rem | |
| `text-3xl` | 2.618rem | |
| `text-5xl` | 4.236rem | |

Role utilities (prefer these): `display-title` (h1), `section-title` (every section h2), `eyebrow` (sentence-case label above a heading), `lead` (section intro), `card-title`, `card-body`.

- No arbitrary font sizes (`text-[0.9375rem]`, `text-[clamp(...)]`, `text-[0.6875rem]`). Replace each with the nearest scale step or role utility.
- No `uppercase` and no wide `tracking-[...]` on labels. Sentence case everywhere.
- Prefer `text-base` over `text-sm` in new code (they are the same size).

## shadcn rules (from the shadcn skill)

- Buttons and button-looking links: `<Button>` in React, or in `.astro` apply `buttonVariants({ variant, size })` from `@/components/ui/button` to an `<a>`. Delete uses of `src/components/ui/Button.astro` (the chrome owner deletes the file at the end).
- Icons inside buttons use `data-icon="inline-start" | "inline-end"`, no size classes. React files use `lucide-react`; `.astro` files may keep `lucide-astro`.
- `gap-*` not `space-y-*`; `size-*` when width equals height; `cn()` from `@/lib/utils` for conditional classes.
- Full Card composition (`CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`). `Separator` instead of `<hr>` or border-only divs where it is a divider. `Badge` for chips. `Alert` for callouts. `sonner` `toast()` for transient messages.
- Dialog and Sheet always have a Title (use `className="sr-only"` if hidden).
- Forms: `FieldGroup` + `Field` + `FieldLabel` + `FieldDescription`/`FieldError`; validation via `data-invalid` on Field and `aria-invalid` on the control.
- Base UI uses the `render` prop, not `asChild`.

## Astro island rules

- Static shadcn components (Card, Badge, Separator, Breadcrumb, Pagination, Alert, Button without handlers) render in `.astro` with **no** `client:` directive, so they ship no JS.
- Interactive ones need a directive: NavigationMenu and Sheet `client:load`; Accordion, Carousel, HoverCard, ToggleGroup/Tabs, forms `client:visible`; Dialog `client:idle`.
- Pass data as serialisable props. For anything composed (an accordion of FAQs, a form), write a small wrapper `.tsx` in the owning folder that takes plain props, rather than nesting React children inside `.astro` slots.
- Images: React islands cannot use `astro:assets`. Pre-compute image URLs in the `.astro` parent with `getImage()` and pass `src`/`width`/`height` strings down.
- Content that must be indexable (FAQ answers, article text) must be present in the server-rendered HTML.

## Done means

`pnpm type-check`, `pnpm lint`, `pnpm format:check`, `pnpm build` pass; every route still returns 200; no `uppercase`, no arbitrary `text-[...]` sizes remain in owned files; interactive islands work with keyboard.
