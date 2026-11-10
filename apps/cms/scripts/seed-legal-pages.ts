// Writes the migration that seeds the two legal pages from the Markdown next
// to this file. Run once; the migration holds the output, this keeps it
// reviewable and repeatable.
//   bun apps/cms/scripts/seed-legal-pages.ts packages/db/migrations/00NN_legal-pages-seed.sql
import { readFileSync, writeFileSync } from 'node:fs';
import { markdownToRichText } from '@ll/content';

const out = process.argv[2];
if (!out) throw new Error('Pass the migration file to write.');

const pages = [
  {
    id: 'legal_privacy',
    slug: 'privacy',
    title: 'Privacy policy',
    seoDescription:
      'How Living Legacy collects, holds, uses and discloses personal information, in line with the Privacy Act 1988 (Cth) and the Australian Privacy Principles.',
  },
  {
    id: 'legal_terms',
    slug: 'terms-and-conditions',
    title: 'Terms and conditions',
    seoDescription:
      'Terms and conditions and the customer waiver for the Wellington Dam Memorial Forest conservation zone.',
  },
];

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const now = Date.now();

const statements = pages.flatMap((p) => {
  const body = markdownToRichText(
    readFileSync(new URL(`./legal-pages/${p.slug}.md`, import.meta.url), 'utf8')
  );
  const snapshot = { title: p.title, body, seoDescription: p.seoDescription };
  return [
    `INSERT INTO legal_pages (id, slug, title, body, seo_description, status, published_at, last_published_at, created_at, updated_at) VALUES (${q(p.id)}, ${q(p.slug)}, ${q(p.title)}, ${q(JSON.stringify(body))}, ${q(p.seoDescription)}, 'published', ${now}, ${now}, ${now}, ${now});`,
    `INSERT INTO revisions (id, entity_type, entity_id, snapshot, created_at) VALUES (${q(`${p.id}_r1`)}, 'legal_page', ${q(p.id)}, ${q(JSON.stringify(snapshot))}, ${now});`,
  ];
});

writeFileSync(out, `${statements.join('\n--> statement-breakpoint\n')}\n`);
process.stdout.write(`Wrote ${statements.length} statements to ${out}\n`);
