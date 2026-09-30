# Live Site Rebuild — Living Legacy Forest

**Date:** 2026-09-24
**Source of truth:** the live WordPress site at https://livinglegacyforest.com, crawled 2026-09-24.
**Goal:** every page that has real content on the live site exists on the new Astro site, styled in the
new design system (see `src/styles/global.css` and the current `src/pages/index.astro`). Every live URL
that has no page of its own gets a 301 to its closest new home. Nothing is lost.

Crawl artefacts (outlines per page, raw home text, WordPress REST dumps) live in the session scratchpad:
`/private/tmp/claude-501/-Users-warrenroberts-orca-workspaces-livinglegacy-lookdown/71395f5e-6c22-4b9e-b30d-ed21b07f26d1/scratchpad/`

- `live/out/<page>.txt` — structured outline of each live page (headings, paragraphs, images, links, forms)
- `live/home.raw.txt` — full home page including hand-coded HTML blocks the outline missed
- `live/<page>.html` — raw live HTML, if anything needs re-checking
- `real_posts.json` — the 21 real blog posts from `/wp-json/wp/v2/posts?_embed=1`
- `page-images.txt` — every image URL referenced by a page (not blog)

---

## 1. Decisions (made with the user)

| Topic | Decision |
| --- | --- |
| Design | Keep the new design system (paper / moss / Fraunces + Instrument Sans, growth rings). Carry the live **content**, not the Elementor look. |
| Blog | Sanity. New project **`6nf0cv12`** ("Living Legacy Forest", dataset `production`, public), in the same organisation as the two forest sites. |
| Legacy URLs | Consolidate + 301. One thank-you page. Empty `cache-N` posts dropped. |
| Forms | HubSpot Forms API (same approach as the sister forest sites). Portal ID and form GUIDs are config; missing GUIDs must not lose leads (see §6). |
| Copy | Carried from live, with house editorial rules applied to page copy (not blog bodies): Australian spelling, no em or en dashes, no exclamation marks in info copy, sentence case headings, obvious typos fixed. Facts, figures, names and claims unchanged. |

---

## 2. Page inventory and routes

Live pages that render the site's 404 template (no content on live today) are **not** rebuilt; they redirect.

| New route | Live source | Notes |
| --- | --- | --- |
| `/` | `/` (`live/home.raw.txt`) | Full rebuild of every live section, see §3 |
| `/faqs/` | `/faqs/` | 8 groups, ~30 Q&As, in-page group nav with ids `general-questions`, `the-process`, `protection`, `pricing`, `tree-selection`, `sustainability`, `locations`, `family-sharing`. Accordions. FAQPage JSON-LD. |
| `/about/in-the-media/` | same | 7 items, filter All / Video / News, see §4 |
| `/our-partners/` | same | Hero, 4 partner cards with logos, 3 benefits, partner form with id `become-a-partner-form`, photo gallery |
| `/contact/` | same | Contact form, hours, 4 location cards |
| `/locations/register-your-interest-for-locations-throughout-australia/` | same | Upcoming-locations form |
| `/register-interest/` | same | Embedded CRM form (LeadConnector form `7ra4NiPGM9jNSI5MPY9A`, script `https://link.msgsndr.com/js/form_embed.js`). Keep as embed, lazy-loaded. |
| `/intellectual-property/` | same | Patents list |
| `/privacy/` | same | Full policy text. Fix the broken mailto/links on live: email is `contact@livinglegacyforest.com`, site link `https://livinglegacyforest.com`. |
| `/terms-and-conditions/` | same | Live content is an old 2018 Wellington Dam event page: terms statement, customer waiver PDF link (`/181127-customer-waiver-for-conservation-zone/`, check it resolves; if not, keep the text and drop the link), Wellington Dam location. Carry it; flag for client review. |
| `/thank-you-contact/` | same | `noindex`. Single thank-you page. Optional `?type=` variant (`contact`, `partner`, `interest`) tweaks the sentence; default is the live copy. |
| `/blog/` + `/blog/page/[n]/` | same | Sanity-backed index, 12 per page |
| `/blog/[slug]/` | 21 posts | Sanity-backed article |
| `/blog/category/[slug]/` | `legacy-advice` | Archive |
| `/blog/tag/[slug]/` | 7 tags in sitemap | Archive |
| `/blog/author/[slug]/` | `warren` | Archive |
| `/rss.xml` | `/feed/` | Blog feed via `@astrojs/rss` |
| `404` | live 404 template | "This page is lost in the forest." + Back home |

`/wellington-dam-wa/` on live is a copy of the Wellington Dam site whose canonical points there. It is **not** rebuilt here (brand separation); it 301s to `https://livinglegacywellingtondam.org.au/`.

## 3. Home page sections (in live order)

Keep live anchor ids so old links keep working: `about-section`, `how-it-works-section`, `location-section`.

1. **Announcement bar** (site-wide, in header): "New locations coming to Queensland and New South Wales" + "Register interest" → upcoming-locations form route.
2. **Hero**: H1 "Return to earth and live on through nature"; sub "We specialise in transforming cremated ashes into living memorials by infusing them into trees, creating lasting, sustainable tributes that grow and thrive in nature." Upcoming-locations banner image (`2026/09/Upcoming-locations-banner.jpeg.webp`) links to the upcoming-locations form. Growth rings motif stays.
3. **Legacy quote** (`id="about-section"`): logo mark, quote "Every life has the potential to create beauty, inspire connection, and leave a lasting legacy." + paragraph.
4. **Become a Living Legacy**: H2 "Change the way we leave the world", paragraph, "Get more info" → `https://living-legacy-forest.myflodesk.com/p79xkiruk8` (new tab), autoplay muted loop video (see §7).
5. **Core values**: 6 cards with icons (Connecting generations, Science and innovation, Sustainability, Earth's wisdom, Community empowerment, Growth in nature).
6. **Sustainability**: icon, H2, paragraph, "Get more info" (same Flodesk link), image.
7. **Pre-plan carousel**: eyebrow "Pre-plan or planning for someone else?", H2 "We've helped thousands of Australians create lasting legacies.", paragraph, carousel of photos `2025/01/1..19` (embla-carousel is installed). The live 20th slide repeats photo 2; drop the duplicate.
8. **Locations** (`id="location-section"`): H2 "Locations in Australia"; 4 cards linking out (Wellington Dam → livinglegacywellingtondam.org.au, Mornington Green → morningtongreen.com.au, Centennial Park Adelaide → centennialpark.org Living Legacy Forever Flowers, Metropolitan Memorial Parks → metropolitanmemorialparks.com.au page); Australia map with 4 pins and address/phone per pin (use the live home values; Metropolitan phone is `1300 389 888`, tel `+61300389888`).
9. **Action tiles**: Schedule a call / Book a tour / Open days, each with a Wellington Dam and a Mornington Green link (exact URLs in `live/home.raw.txt` lines 282–310). Then "Curious about bringing Living Legacy to your area? Fill out the form here." → upcoming-locations form.
10. **The soil science**: H2, H3 "The science behind our patented ash treatment process.", paragraph, 4 steps with illustrations (Soil development, Soil revitalisation, Root integration, Intelligence exchange).
11. **In the media teaser**: 4 images, eyebrow "Latest coverage and highlights", H2, paragraph, "Read more" → `/about/in-the-media/`.
12. **How it works** (`id="how-it-works-section"`): H2 "3 steps to create your Living Legacy", paragraph, 3 steps with illustrations (`NAT-LLF-WEB-LAYOUT-18/19/20.png`).
13. **FAQ**: 5 Q&As from the live home block (text in `live/home.raw.txt` lines 432–456), "More FAQs" → `/faqs/`.

The existing "Patented in Australia (2016358312) and the United States (10,946,421)" line may stay; the UK patent GB2561476 is also listed on live.

## 4. In the media items

| Title | Outlet line | Type | Link | Thumbnail |
| --- | --- | --- | --- | --- |
| How human ashes can be treated to become part of living memorials | The Senior | News | https://www.thesenior.com.au/story/8816635/how-human-ashes-can-be-treated-to-become-part-of-living-memorials/ | `2025/03/news-2.webp` |
| Weird science brings eternal life to Peninsula | Herald Sun | News | https://www.heraldsun.com.au/leader/south-east/funeral-cost-living-legacy-forest-opens-mornington-green/news-story/b378415dba3f734ccd9ff571442d9630 | `2025/03/news-4.webp` |
| Australian scientists in Melbourne turn human cremated ashes into plant food | Daily Mail | News | https://www.dailymail.co.uk/news/article-3597861/Australian-scientists-Melbourne-turn-humans-cremated-ashes-turned-plant-food.html | `2025/03/news-1.webp` |
| Living Legacy Forest, Western Australia | Today Tonight | Video | YouTube `_fxvSz2XfU8` | YouTube thumbnail |
| Studio 10 | Network 10 | Video | YouTube `TZTP7yN7kfE` | YouTube thumbnail |
| The Project | Studio 10 | Video | YouTube `IpvLFePdRlQ` | YouTube thumbnail |
| Allan for Breakfast | Triple M | Video | YouTube `b_yZqCOx3EU` | YouTube thumbnail |

Videos: click-to-load `youtube-nocookie.com` embed (thumbnail first, no third-party request until click).

## 5. Site chrome

**Header:** logo (mark + wordmark) → `/`. Nav: About (About us → `/#about-section`, In the media → `/about/in-the-media/`), How it works → `/#how-it-works-section`, Locations (`/#location-section`; children Victoria → morningtongreen.com.au, Perth → livinglegacywellingtondam.org.au, Upcoming location → upcoming-locations form), Contact → `/contact/`, Blog → `/blog/`. CTA "Learn more" → `/contact/`. Accessible mobile menu (dialog/drawer, focus-trapped, Escape closes).

**Footer:** logo; "Welcome to Living Legacy, where we transform grief into growth by bringing communities together to create memorial forests and gardens."; Explore us (Home, About, Locations, Contact, FAQs); Media and community (In the media, Blog, Our partners); Find us (4/349 Collins St, Melbourne VIC 3000; Facebook https://www.facebook.com/livinglegacyforest/, Instagram https://www.instagram.com/living_legacy_forest/, YouTube https://www.youtube.com/channel/UCA3aDohvY5Y8Hr2oviiH-gw); Privacy, Terms, Intellectual property; Forest Conservation Australia Pty Ltd, ABN 59 639 330 617; "Living Legacy Forest © {year}. Protected by international patents" opening a patents `<dialog>` with the three patents (US 10,946,421; UK GB2561476; AU 2016358312) and the trademark line.

**Tracking (same tags as live):** Google Tag Manager `GTM-T7769GVH`, Meta pixel `2198197110470347`, Google tag `GT-KVFLGVB` and Ads `AW-621100887`. Read from env (`PUBLIC_GTM_ID`, `PUBLIC_META_PIXEL_ID`, `PUBLIC_GA_MEASUREMENT_ID` accepting a comma-separated list). Load only when `isIndexableHost()` is true so previews never pollute data. Add to `.env.example` and `astro.config.mjs` env schema.

## 6. Forms (HubSpot)

Port the pattern from the sister site `~/Developer/Project/wellington-dam/src/lib/forms.ts` (pure payload builders, honeypot, validation, `hutk` cookie, `legalConsentOptions`). Config in `src/lib/forms.ts`:

```ts
export const hubspot = { portalId: PUBLIC_HUBSPOT_PORTAL_ID, region: 'ap1' | 'na1', forms: { contact: null, partner: null, upcomingLocation: null } }
```

GUIDs are `null` until the client supplies them. While a GUID is null the form still renders, and submit shows a clear message with the phone and email fallback instead of pretending to succeed. Never drop a lead silently. On success, navigate to `/thank-you-contact/?type=<form>` (live behaviour).

| Form | Fields (required *) | Extra |
| --- | --- | --- |
| Contact | First name *, Last name, Email *, Phone *, Message | |
| Partner | First name *, Company name *, Email *, Phone *, Partnership interest (select), Message | Options: Corporate social responsibility (CSR); Donation / sponsorship; Memorial program partnership; Eco-tourism collaboration; Educational / institutional collaboration; Land or tree adoption program; Event partnership; Other (please specify) |
| Upcoming location | Name *, Email *, Which part of Australia are you located in * (select), Other location (required only when "Other"), Why did you choose this area for a Living Legacy Forest? | Options: NSW, VIC, QLD, SA, WA, TAS, NT, ACT, Other (full names as on live) |

Non-standard values (company, interest, location, reason) fold into `message` rather than new HubSpot properties, for the same reason the sister site documents.

## 7. Assets

- Download every image in `page-images.txt` that a rebuilt page uses into `src/assets/` (grouped by page) and render through `astro:assets` so the build optimises them. Keep meaningful alt text (fix live's empty or filename-style alts).
- The home video (`2025/01/20250122_FINAL_RES_LIVINGLEGACY_MOV.mov`, 39 MB) exceeds the 25 MiB Workers asset limit. Transcode with ffmpeg to 1280px-wide H.264 MP4 (and optionally WebM), no audio, target under 8 MB, plus a poster frame. Serve from `public/media/`.
- Logos: `2025/01/legacy-memorial-logo.png.webp` (mark), `2025/02/Living-Legacy-Forest-Logo-Type-For-Footer.png` (wordmark).
- Blog images go to Sanity via the migration (§8), not the repo.

## 8. Blog in Sanity

Port from `~/Developer/Project/wellington-dam`: schema types `blog`, `author`, `category` (add `tag`), `scripts/migrate-blog-to-sanity.ts` and its `scripts/lib/*` helpers, `src/lib/blog.ts`, `src/components/blog/*`, `src/pages/blog/*`. Restyle to this site's design system. Adjust:

- Source: `https://livinglegacyforest.com/wp-json/wp/v2/posts`, skip slugs starting `cache`. 21 posts, all by author `warren` (Warren Roberts, "Founder of Living Legacy Memorial Gardens, writing about natural burial options and environmental conservation in Australia."), all in category Legacy Advice.
- Keep WordPress slug, published date, modified date, excerpt, Yoast SEO title/description, featured image with alt, tags.
- Rewrite absolute internal links `https://livinglegacyforest.com/...` in bodies to root-relative.
- Env: `SANITY_PROJECT_ID=6nf0cv12`; the write token is only needed to run the migration and is never committed.
- Blog body copy is migrated verbatim (no editorial pass).

## 9. Redirects (`public/_redirects`, 301)

```
/about/                               /#about-section
/how-it-works/                        /#how-it-works-section
/locations/                           /#location-section
/pricing/                             /faqs/#pricing
/welcome/                             /
/5-shocking-truths-about-death/       /
/product-customer-list/               /
/wooling-hill-vic/                    /#location-section
/schedule-tour/                       /#location-section
/schedule-call/                       /contact/
/request-a-callback/                  /contact/
/cp-mornington-green/                 /contact/
/cp-wellington-dam/                   /contact/
/cemetery-partners/                   /our-partners/
/our-partners/become-a-partner-form/  /our-partners/#become-a-partner-form
/locations/upcoming-location/         /locations/register-your-interest-for-locations-throughout-australia/
/wellington-dam-wa/                   https://livinglegacywellingtondam.org.au/
/thank-you/ and every /thank-you-*/ variant in the sitemap  /thank-you-contact/
/blog/cache/  and /blog/cache-*       /blog/
/feed/  /blog/feed/                   /rss.xml
```

Both with and without trailing slash where `_redirects` needs it. Note: `_redirects` only covers static assets on Workers; confirm Astro-on-Workers actually honours it, and if not implement the same map in `src/middleware.ts` (or an `astro.config` `redirects` block) and delete the stub.

## 10. Done means

- `pnpm type-check`, `pnpm lint`, `pnpm format:check`, `pnpm build` all pass.
- Every route in §2 renders in `pnpm dev` / `pnpm preview`; every redirect in §9 resolves.
- Blog index lists 21 posts from Sanity; each post renders its full body and images.
- Sitemap includes all public routes and blog posts, excludes `/thank-you-contact/`.
- Each page has a title and meta description (use live Yoast values where present; write house-style ones where live had none).
