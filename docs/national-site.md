# National site rules

The rules the website follows as it becomes the one national Living Legacy site. Condensed from
the _National Digital Architecture_ working document (November 2026). The URL structure there is
marked "example, not final"; check it is still current before building against it.

## Where this is heading

- **One national site**, livinglegacy.com.au, with each forest as a page under `/locations/`.
- **Mid-January 2027:** national site and Living Legacy Logan launch. Organic first; Queensland
  ads start about two weeks later, once tracking is proven on real traffic.
- **About three months later (around April):** Living Legacy Mornington and Living Legacy
  Wellington Dam move in from their own domains.
- Old domains and their 301 redirects stay **long-term**. The migration is a sequence, not a
  reason to switch them off.

## URLs

```
/                       national homepage
/about/                 about Living Legacy
/services/              national services and approach
/locations/             directory of forests (states are filters, not pages)
/locations/logan/       QLD, first launch
/locations/mornington/  VIC (Living Legacy Mornington)
/locations/wellington-dam/   WA
/locations/wallerawang/ NSW (Piper Ridge)
/insights/              national articles and resources
```

- One level only: `/locations/<slug>/`. **No state pages** (`/locations/victoria/` must not
  exist). The state is a filter in the directory, not a URL level.
- Future forests (Brisbane, Sydney, Blue Mountains) get a page only when they are ready. Until
  then they show as "Coming soon" in the directory, with **no empty page** to land on.
- Use the slugs above in URLs, analytics (`location_slug`) and CMS data. The slug is not the
  public name: page copy always says "Living Legacy Mornington" (see
  [brand-language.md](brand-language.md)).
- The plan names the articles section `/insights/`; the site uses `/blog/` today. If it moves,
  redirect every old URL.

## Location directory

- Group forests under state labels. State labels expand or filter the list; only forest names
  link anywhere.
- Must work with a mouse, touch and keyboard. Nothing may depend on hover alone.

## Location page

Every forest uses **one shared template**, configured per forest:

- name, state and region
- genuine hero photography of that forest (never generic or stock imagery)
- a local introduction
- available memorial options and tree information
- facilities, landscape and visit details
- address, map, hours and booking information
- location-specific calls to action and forms

One national visual identity. Forests differ through real photos, local content and accurate
details, **never** separate colour palettes or brand systems.

Per-forest configuration lives in data, not code: slug, HubSpot form ID, CRM destination,
assets. A new forest should be content plus configuration, not a new build.

A forest not yet open to visitors shows a register-interest form instead of tour booking.

## Calls to action

Don't ask for a location the page already knows.

| Where         | CTA                                                                      | Behaviour                                           |
| ------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| Location page | Book a tour                                                              | That forest's tour form directly                    |
| Homepage      | Explore forests (the plan says "Explore Locations"; see open question 1) | Straight to the directory                           |
| Homepage      | Schedule a call                                                          | General form with a Preferred location field        |
| About         | Contact us                                                               | General enquiry form with a location choice         |
| Services      | Book a tour                                                              | Ask for the forest only if not already known        |
| Article       | Contact                                                                  | General enquiry, or the forest the article is about |
| Anywhere      | Download brochure                                                        | Direct download, no location selector               |

On national pages, prefer a Preferred location **field** in the form over a separate selection
step. Always offer "Not sure yet"; it routes to the central team.

## Forms

- HubSpot forms where practical, in one reusable form component configured per forest.
- Every submission passes: location, form type (tour, contact, brochure), page context and
  campaign attribution (UTMs). Keep three ideas separate: the page's location
  (`page_location`), the location receiving the enquiry (`conversion_location`) and the location
  the person asked about (`location_of_interest`).
- HubSpot routes leads to the Mornington, Wellington Dam, central and (when ready) Logan teams.
- Test responsive layout, success state, duplicate submissions and error handling.
- Open question before building routing: do Mornington and Wellington Dam share one HubSpot
  portal or two?

## Analytics

- One GA4 property for the national domain. Separate forests by page path and event parameters,
  not separate properties.
- Event parameters: `page_type` (national, location, blog), `location_slug`, `form_type`,
  `cta_name`, `conversion_location`, `page_location`, `location_of_interest`.
- Count **successful** submissions, confirmed bookings and completed downloads, not just button
  clicks.
- **Never send names, email addresses or phone numbers to GA4.**

## SEO and migration

- Map every old URL to the **closest relevant** new URL with a 301. Never redirect everything to
  the homepage.
- Keep old domains and their redirect rules in place.
- Check canonicals, the XML sitemap, robots and indexability on every launch.
- Test analytics, forms, CRM routing and consent end to end before launch. In launch week, watch
  404s, indexing, forms, routing and conversions daily.
- Historical GA4 and Search Console data does not carry over. Keep the old properties as the
  pre-migration baseline.

## Contact details shown on the site

- Public contact address: `contact@livinglegacy.com.au` (not hello@ or info@).
- Marketing email sends from `updates@livinglegacy.com.au`.

## Open questions from the documents

These conflict between the two documents. Raise them before building the affected part:

1. **"Location" in copy.** The tone guide bans "location" in customer copy (say forest), but the
   architecture uses "Explore Locations" and "location page". The `/locations/` URL is approved;
   visible labels should probably say forests.
2. **Short forest names.** The architecture lists "Wellington Dam" and "Logan" on their own; the
   tone guide says never use the place name alone. In visible copy, use the full name until told
   otherwise.
3. **Ceremony name.** The guide once says "LegacyAsh Infusion Ceremony" but everywhere else
   "Legacy Infusion Ceremony". Use the latter.
