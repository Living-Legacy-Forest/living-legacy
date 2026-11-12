// Site-wide search and replace over every area's editable text. `findMatches`
// builds the preview; `replaceMatches` searches again (content may have changed
// since) and writes the areas chosen. Published posts and legal pages change
// live: they get a new revision, so the version before stays in their history,
// and a publish event for the website. Pending edits get the same replacement.
import {
  type LegalValues,
  type PostInput,
  type SearchReplaceInput,
  type Snippet,
  SITE_SETTINGS_DEFAULTS,
  blogPath,
  countIn,
  countInRichText,
  legalPath,
  parseSiteSettings,
  replaceIn,
  replaceInRichText,
  richTextTexts,
  searchPattern,
  snippetsIn,
} from '@ll/content';
import type { Db } from '@ll/db';
import {
  announcements,
  events,
  faqGroups,
  faqs,
  legalPages,
  locations,
  media,
  mediaCoverage,
  posts,
  publishEvents,
  revisions,
  siteSettings,
  teamMembers,
  terms,
  testimonials,
} from '@ll/db/schema';
import { eq, isNull } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { logActivity } from './activity-log';
import { loadContentTargets, scoreInputFromColumns, scorePost } from './post-score';
import { type Statement, type Statements, liveInput } from './post-store';

export const areaIds = [
  'posts',
  'legal',
  'events',
  'faqs',
  'testimonials',
  'team',
  'announcements',
  'mediaCoverage',
  'locations',
  'categories',
  'media',
  'settings',
] as const;
export type AreaId = (typeof areaIds)[number];

export const areaLabels: Record<AreaId, string> = {
  posts: 'Posts',
  legal: 'Legal pages',
  events: 'Events',
  faqs: 'FAQs',
  testimonials: 'Testimonials',
  team: 'Team',
  announcements: 'Announcements',
  mediaCoverage: 'Media coverage',
  locations: 'Locations',
  categories: 'Categories and tags',
  media: 'Media alt text and captions',
  settings: 'Settings',
};

type Field = { key: string; label: string; rich?: boolean };

/** The fields of a post searched, live and in pending edits alike. */
const POST_FIELDS: Field[] = [
  { key: 'title', label: 'Title' },
  { key: 'excerpt', label: 'Summary' },
  { key: 'body', label: 'Body', rich: true },
  { key: 'seoTitle', label: 'Search title' },
  { key: 'seoDescription', label: 'Search description' },
  { key: 'socialTitle', label: 'Social title' },
  { key: 'socialDescription', label: 'Social description' },
];
const LEGAL_FIELDS: Field[] = [
  { key: 'title', label: 'Title' },
  { key: 'body', label: 'Body', rich: true },
  { key: 'seoDescription', label: 'Search description' },
];
const SETTINGS_FIELDS: Field[] = [
  { key: 'siteTitle', label: 'Site title' },
  { key: 'tagline', label: 'Tagline' },
  { key: 'seoDescription', label: 'Search description' },
  { key: 'legalName', label: 'Legal name' },
  { key: 'address', label: 'Address' },
  { key: 'openingHours', label: 'Opening hours' },
];

/** Tables where a replacement is a plain update of the row. */
type SimpleTarget = {
  area: AreaId;
  table: SQLiteTable & { id: unknown };
  title: (row: Record<string, unknown>) => string;
  link: (row: Record<string, unknown>) => string;
  fields: Field[];
};

const SIMPLE: SimpleTarget[] = [
  {
    area: 'events',
    table: events,
    // The dates of a repeating event share a title, so the date tells them apart.
    title: (r) =>
      `${r.title}, ${(r.startsAt as Date).toLocaleDateString('en-AU', {
        timeZone: String(r.timeZone),
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}`,
    link: (r) => `/events?open=${r.id}`,
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'venue', label: 'Venue' },
      { key: 'summary', label: 'Summary' },
      { key: 'description', label: 'Description', rich: true },
    ],
  },
  {
    area: 'faqs',
    table: faqs,
    title: (r) => String(r.question),
    link: () => '/faqs',
    fields: [
      { key: 'question', label: 'Question' },
      { key: 'answer', label: 'Answer', rich: true },
    ],
  },
  {
    area: 'faqs',
    table: faqGroups,
    title: (r) => `Group: ${r.name}`,
    link: () => '/faqs',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'navLabel', label: 'Menu label' },
    ],
  },
  {
    area: 'testimonials',
    table: testimonials,
    title: (r) => String(r.name),
    link: () => '/testimonials',
    fields: [
      { key: 'quote', label: 'Quote' },
      { key: 'name', label: 'Name' },
      { key: 'relationship', label: 'Relationship' },
      { key: 'location', label: 'Location' },
    ],
  },
  {
    area: 'team',
    table: teamMembers,
    title: (r) => String(r.name),
    link: () => '/team',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Role' },
      { key: 'bio', label: 'Bio', rich: true },
    ],
  },
  {
    area: 'announcements',
    table: announcements,
    title: (r) => String(r.title),
    link: () => '/announcements',
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'message', label: 'Message' },
      { key: 'messageTablet', label: 'Message on tablets' },
      { key: 'messageDesktop', label: 'Message on desktops' },
      { key: 'ctaLabel', label: 'Button label' },
    ],
  },
  {
    area: 'mediaCoverage',
    table: mediaCoverage,
    title: (r) => String(r.title),
    link: () => '/media-coverage',
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'source', label: 'Source' },
      { key: 'excerpt', label: 'Excerpt' },
    ],
  },
  {
    area: 'locations',
    table: locations,
    title: (r) => String(r.name),
    link: () => '/locations',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'region', label: 'Region' },
      { key: 'intro', label: 'Introduction' },
      { key: 'about', label: 'About' },
      { key: 'address', label: 'Address' },
      { key: 'hours', label: 'Hours' },
    ],
  },
  {
    area: 'categories',
    table: terms,
    title: (r) => String(r.name),
    link: (r) => (r.type === 'tag' ? '/posts/tags' : '/posts/categories'),
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description' },
    ],
  },
  {
    area: 'media',
    table: media,
    title: (r) => String(r.filename),
    link: () => '/media',
    fields: [
      { key: 'alt', label: 'Alt text' },
      { key: 'caption', label: 'Caption' },
    ],
  },
];

export type FieldMatch = { label: string; count: number; snippets: Snippet[] };
export type ItemMatch = {
  key: string;
  title: string;
  link: string;
  count: number;
  fields: FieldMatch[];
};
export type AreaMatch = { area: AreaId; label: string; count: number; items: ItemMatch[] };

type Values = Record<string, unknown>;

/** The matches in one set of field values. */
function fieldMatches(values: Values, fields: Field[], pattern: RegExp): FieldMatch[] {
  const out: FieldMatch[] = [];
  for (const f of fields) {
    const value = values[f.key];
    const texts = f.rich ? richTextTexts(value) : typeof value === 'string' && value ? [value] : [];
    const count = texts.reduce((sum, t) => sum + countIn(t, pattern), 0);
    if (count > 0) out.push({ label: f.label, count, snippets: snippetsIn(texts, pattern) });
  }
  return out;
}

/** The values with every field's matches replaced, and how many there were. */
function replaced(
  values: Values,
  fields: Field[],
  pattern: RegExp,
  replacement: string
): { values: Values; count: number } {
  const next: Values = { ...values };
  let count = 0;
  for (const f of fields) {
    const value = values[f.key];
    if (f.rich) {
      const n = countInRichText(value, pattern);
      if (n) next[f.key] = replaceInRichText(value, pattern, replacement);
      count += n;
    } else if (typeof value === 'string') {
      const n = countIn(value, pattern);
      if (n) next[f.key] = replaceIn(value, pattern, replacement);
      count += n;
    }
  }
  return { values: next, count };
}

const pick = (values: Values, fields: Field[]) =>
  Object.fromEntries(fields.map((f) => [f.key, values[f.key]]));

/** A field label that says it is in pending edits rather than the live version. */
const pending = (matches: FieldMatch[]) =>
  matches.map((m) => ({ ...m, label: `${m.label} (pending edits)` }));

function item(key: string, title: string, link: string, fields: FieldMatch[]): ItemMatch {
  return { key, title, link, fields, count: fields.reduce((sum, f) => sum + f.count, 0) };
}

export async function findMatches(db: Db, input: SearchReplaceInput): Promise<AreaMatch[]> {
  const pattern = searchPattern(input);
  const items = new Map<AreaId, ItemMatch[]>(areaIds.map((a) => [a, []]));

  const postRows = await db.select().from(posts).where(isNull(posts.deletedAt));
  for (const row of postRows) {
    const fields = [
      ...fieldMatches(row as Values, POST_FIELDS, pattern),
      ...(row.draft ? pending(fieldMatches(row.draft as Values, POST_FIELDS, pattern)) : []),
    ];
    if (fields.length)
      items.get('posts')!.push(item(row.id, row.title, `/posts/${row.id}`, fields));
  }

  for (const row of await db.select().from(legalPages)) {
    const fields = [
      ...fieldMatches(row as Values, LEGAL_FIELDS, pattern),
      ...(row.draft ? pending(fieldMatches(row.draft as Values, LEGAL_FIELDS, pattern)) : []),
    ];
    if (fields.length) {
      items.get('legal')!.push(item(row.id, row.title, `/legal/${row.slug}`, fields));
    }
  }

  for (const target of SIMPLE) {
    for (const row of (await db.select().from(target.table as never)) as Values[]) {
      const fields = fieldMatches(row, target.fields, pattern);
      if (fields.length) {
        items
          .get(target.area)!
          .push(item(`${target.area}:${row.id}`, target.title(row), target.link(row), fields));
      }
    }
  }

  const settings = await loadSettings(db);
  const settingsFields = fieldMatches(settings, SETTINGS_FIELDS, pattern);
  if (settingsFields.length) {
    items.get('settings')!.push(item('settings', 'Site settings', '/settings', settingsFields));
  }

  return areaIds
    .map((area) => {
      const list = items.get(area)!;
      return {
        area,
        label: areaLabels[area],
        items: list,
        count: list.reduce((sum, i) => sum + i.count, 0),
      };
    })
    .filter((a) => a.items.length > 0);
}

async function loadSettings(db: Db): Promise<Values> {
  const row = await db.query.siteSettings.findFirst({ where: eq(siteSettings.id, 'site') });
  return (row ? parseSiteSettings(row.data) : SITE_SETTINGS_DEFAULTS) as unknown as Values;
}

export type ReplaceResult = { matches: number; items: number };

export async function replaceMatches(
  db: Db,
  input: SearchReplaceInput,
  areas: AreaId[],
  actor: { id: string; name: string }
): Promise<ReplaceResult> {
  const pattern = searchPattern(input);
  const chosen = new Set(areas);
  const statements: Statement[] = [];
  const now = new Date();
  let matches = 0;
  let changedItems = 0;

  if (chosen.has('posts')) {
    const targets = await loadContentTargets(db);
    const rows = await db.select().from(posts).where(isNull(posts.deletedAt));
    for (const row of rows) {
      const live = replaced(row as Values, POST_FIELDS, pattern, input.replace);
      const draft = row.draft
        ? replaced(row.draft as Values, POST_FIELDS, pattern, input.replace)
        : null;
      const count = live.count + (draft?.count ?? 0);
      if (count === 0) continue;
      matches += count;
      changedItems++;
      const columns = pick(live.values, POST_FIELDS) as Partial<typeof posts.$inferInsert>;
      const next = { ...row, ...columns };
      statements.push(
        db
          .update(posts)
          .set({
            ...columns,
            contentScore: scorePost(scoreInputFromColumns(next), targets),
            ...(draft ? { draft: draft.values } : {}),
            updatedAt: now,
            updatedBy: actor.id,
          })
          .where(eq(posts.id, row.id))
      );
      // The live version changed: record it, as publishing does, and tell the website.
      if (row.status === 'published' && live.count > 0) {
        statements.push(
          db.insert(revisions).values({
            entityType: 'post',
            entityId: row.id,
            snapshot: (await liveInput(db, next)) as PostInput,
            createdBy: actor.id,
            createdAt: now,
          }),
          db.insert(publishEvents).values({
            entityType: 'post',
            entityId: row.id,
            action: 'update',
            paths: [blogPath(row.slug), '/blog'],
          })
        );
      }
    }
  }

  if (chosen.has('legal')) {
    for (const row of await db.select().from(legalPages)) {
      const live = replaced(row as Values, LEGAL_FIELDS, pattern, input.replace);
      const draft = row.draft
        ? replaced(row.draft as Values, LEGAL_FIELDS, pattern, input.replace)
        : null;
      const count = live.count + (draft?.count ?? 0);
      if (count === 0) continue;
      matches += count;
      changedItems++;
      const columns = pick(live.values, LEGAL_FIELDS) as Partial<typeof legalPages.$inferInsert>;
      statements.push(
        db
          .update(legalPages)
          .set({
            ...columns,
            ...(draft ? { draft: draft.values as LegalValues } : {}),
            updatedAt: now,
            updatedBy: actor.id,
          })
          .where(eq(legalPages.id, row.id))
      );
      if (row.status === 'published' && live.count > 0) {
        const snapshot: LegalValues = {
          title: String(live.values.title),
          body: live.values.body as LegalValues['body'],
          seoDescription: String(live.values.seoDescription ?? ''),
        };
        statements.push(
          db.insert(revisions).values({
            entityType: 'legal_page',
            entityId: row.id,
            snapshot,
            createdBy: actor.id,
            createdAt: now,
          }),
          db.insert(publishEvents).values({
            entityType: 'legal_page',
            entityId: row.id,
            action: 'update',
            paths: [legalPath(row.slug as Parameters<typeof legalPath>[0])],
          })
        );
      }
    }
  }

  for (const target of SIMPLE) {
    if (!chosen.has(target.area)) continue;
    const table = target.table as SQLiteTable & { id: never };
    for (const row of (await db.select().from(table as never)) as Values[]) {
      const next = replaced(row, target.fields, pattern, input.replace);
      if (next.count === 0) continue;
      matches += next.count;
      changedItems++;
      statements.push(
        db
          .update(table)
          .set(pick(next.values, target.fields) as never)
          .where(eq(table.id, row.id as never))
      );
    }
  }

  if (chosen.has('settings')) {
    const settings = await loadSettings(db);
    const next = replaced(settings, SETTINGS_FIELDS, pattern, input.replace);
    if (next.count > 0) {
      matches += next.count;
      changedItems++;
      statements.push(
        db
          .insert(siteSettings)
          .values({ id: 'site', data: next.values as never, updatedBy: actor.id })
          .onConflictDoUpdate({
            target: siteSettings.id,
            set: { data: next.values as never, updatedBy: actor.id, updatedAt: now },
          })
      );
    }
  }

  if (matches === 0) return { matches: 0, items: 0 };
  statements.push(
    logActivity(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: 'content.replaced',
      summary: `Replaced “${input.find}” with “${input.replace}”: ${matches} ${
        matches === 1 ? 'match' : 'matches'
      } in ${changedItems} ${changedItems === 1 ? 'item' : 'items'}`,
    })
  );
  // One batch, so one transaction: either every change lands or none does.
  await db.batch(statements as Statements);
  return { matches, items: changedItems };
}
