/**
 * FAQs, managed in the CMS (FAQs page) and read from the shared D1 database.
 * The /faqs/ page shows every published FAQ that has a group, under its
 * group; other pages pick FAQs by tag (the home page uses "home").
 *
 * Answers are written in the CMS as plain text with a little Markdown:
 * a blank line starts a new paragraph and [text](https://…) makes a link.
 * They are rendered with the same rules as post bodies.
 */
import { markdownToRichText, renderRichText, richTextPlainText, slugify } from '@ll/content';
import { env } from 'cloudflare:workers';

/** The slice of the D1 binding used here, so the site needs no Workers type package. */
interface D1 {
  prepare(query: string): {
    all<T>(): Promise<{ results: T[] }>;
  };
}

const db = (env as { DB?: D1 }).DB;

export interface Faq {
  id: string;
  question: string;
  /** Trusted HTML from the CMS rich-text renderer. */
  answerHtml: string;
  /** For FAQPage structured data, which wants text, not markup. */
  answerText: string;
  tags: string[];
  groupId: string | null;
}

export interface FaqGroup {
  /** The #anchor on the FAQs page. */
  id: string;
  heading: string;
  navLabel: string;
  faqs: Faq[];
}

type GroupRow = { id: string; name: string; nav_label: string | null; slug: string | null };
type FaqRow = {
  id: string;
  question: string;
  answer: string | null;
  tags: string;
  group_id: string | null;
};

// Read fresh on every request, so publishing in the CMS shows at once; the
// last good copy is kept only to ride out a database error.
let lastGood: { groups: GroupRow[]; faqs: Faq[] } = { groups: [], faqs: [] };

async function load() {
  if (!db) return lastGood;
  try {
    const [{ results: groups }, { results: rows }] = await Promise.all([
      db
        .prepare('SELECT id, name, nav_label, slug FROM faq_groups ORDER BY sort_order, name')
        .all<GroupRow>(),
      db
        .prepare(
          `SELECT id, question, answer, tags, group_id FROM faqs
           WHERE status = 'published' AND deleted_at IS NULL
           ORDER BY sort_order, question`
        )
        .all<FaqRow>(),
    ]);
    const faqs = rows.map((r): Faq => {
      const text = r.answer ? ((JSON.parse(r.answer) as { text?: string }).text ?? '') : '';
      const doc = markdownToRichText(text);
      return {
        id: r.id,
        question: r.question,
        answerHtml: renderRichText(doc).html,
        answerText: richTextPlainText(doc).trim(),
        tags: JSON.parse(r.tags) as string[],
        groupId: r.group_id,
      };
    });
    lastGood = { groups, faqs };
    return lastGood;
  } catch (error) {
    // A database hiccup must not take the site down; serve the last known
    // FAQs, or none, and try again on the next request.
    console.error('[faqs] could not load', error);
    return lastGood;
  }
}

/** Groups in order, each with its published FAQs; empty groups are left out. */
export async function getFaqGroups(): Promise<FaqGroup[]> {
  const { groups, faqs } = await load();
  return groups
    .map((g) => ({
      id: g.slug || slugify(g.name),
      heading: g.name,
      navLabel: g.nav_label || g.name,
      faqs: faqs.filter((f) => f.groupId === g.id),
    }))
    .filter((g) => g.faqs.length > 0);
}

/** Published FAQs carrying a tag, e.g. "home", in order. */
export async function getFaqsByTag(tag: string): Promise<Faq[]> {
  const { faqs } = await load();
  return faqs.filter((f) => f.tags.includes(tag));
}

/** schema.org FAQPage data for a set of FAQs. */
export function faqJsonLd(faqs: Faq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answerText },
    })),
  };
}
